import { Octokit } from "@octokit/rest";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadConfig } from "../store";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ─── ETag cache ──────────────────────────────────────────────────────────────
// Module-level: survives re-renders, cleared on full reload/reload().
// Keys: "pulls:{owner}/{repo}" and "checks:{owner}/{repo}/{sha}"
const etagCache = new Map();

// Authenticated user login per account — keyed by account ID.
// Cleared on reload (token/config change).
const cachedUserLogins = new Map();

// ─── hook ────────────────────────────────────────────────────────────────────

export function useGitHub() {
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [hasConfig, setHasConfig] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const intervalRef = useRef(null);

  // Keyed by `${repoKey}#${number}` → { sha }
  // Null until the first successful fetch — prevents notifying on initial load.
  const prevPrsRef = useRef(null);

  // Last known-good PR list — used to preserve the displayed list when a poll
  // cycle fails entirely (network error, all repos unreachable, etc.) so that
  // PRs never disappear due to transient failures.
  // Shape: { prs: PR[], timestamp: number } | null
  const lastGoodPrsRef = useRef(null);

  const fetchPRs = useCallback(async () => {
    const config = await loadConfig();

    const activeAccounts = (config.accounts || []).filter((a) => a.token && a.repos?.length);
    if (!activeAccounts.length) {
      setHasConfig(false);
      setPrs([]);
      lastGoodPrsRef.current = null;
      return;
    }
    setHasConfig(true);
    setLoading(true);
    setError(null);

    try {
      const allPrs = [];
      let anySucceeded = false;

      for (const account of activeAccounts) {
        const octokit = new Octokit({ auth: account.token });

        // Fetch authenticated user once per account; cached until reload
        if (!cachedUserLogins.has(account.id)) {
          try {
            const { data } = await octokit.users.getAuthenticated();
            cachedUserLogins.set(account.id, data.login);
          } catch {
            cachedUserLogins.set(account.id, null);
          }
        }
        const userLogin = cachedUserLogins.get(account.id);

        for (const { owner, repo } of account.repos) {
          try {
            const pulls = await fetchPulls(octokit, owner, repo);
            anySucceeded = true;
            for (const pr of pulls) {
              if (pr.state !== "open") continue;
              const [ciStatus, { data: reviews, fromCache: reviewsCached }] = await Promise.all([
                fetchCiStatus(octokit, owner, repo, pr.head.sha),
                fetchReviews(octokit, owner, repo, pr.number),
              ]);
              const unresolvedKey = `unresolved:${owner}/${repo}/${pr.number}`;
              let unresolvedComments;
              if (reviewsCached && etagCache.has(unresolvedKey)) {
                unresolvedComments = etagCache.get(unresolvedKey);
              } else {
                unresolvedComments = await fetchUnresolvedCommentCount(
                  octokit,
                  owner,
                  repo,
                  pr.number,
                );
                etagCache.set(unresolvedKey, unresolvedComments);
              }
              allPrs.push({
                ...pr,
                _repoKey: `${owner}/${repo}`,
                _ciStatus: ciStatus,
                _priority: getPrPriority(pr, reviews),
                _unresolvedComments: unresolvedComments,
                _isOwn: userLogin ? pr.user.login === userLogin : false,
              });
            }
          } catch (repoErr) {
            console.warn(`Failed to fetch ${owner}/${repo}:`, repoErr.message);
          }
        }
      }

      // If not a single repo call succeeded, treat this cycle as a failure and
      // keep the last known-good list visible rather than showing an empty list.
      // Stale data is only preserved for up to 2× the polling interval to prevent
      // closed/merged PRs from persisting indefinitely during repeated failures.
      if (!anySucceeded && activeAccounts.length > 0) {
        setError("Could not reach GitHub — showing last known data");
        setIsStale(true);
        if (lastGoodPrsRef.current !== null) {
          const staleTtl = (config.pollingInterval || 300_000) * 2;
          if (Date.now() - lastGoodPrsRef.current.timestamp <= staleTtl) {
            setPrs(lastGoodPrsRef.current.prs);
          }
        }
        return;
      }

      allPrs.sort(sortPrs);

      // Diff against previous state and fire notifications (skip on first load)
      if (prevPrsRef.current !== null) {
        await diffAndNotify(allPrs, prevPrsRef.current);
      }
      prevPrsRef.current = new Map(allPrs.map((pr) => [`${pr._repoKey}#${pr.number}`, pr]));

      // Commit the fresh list as the new known-good baseline
      lastGoodPrsRef.current = { prs: allPrs, timestamp: Date.now() };
      setIsStale(false);
      setPrs(allPrs);
      setLastSync(new Date());
    } catch (err) {
      // Outer catch: something unexpected went wrong (auth failure, etc.)
      // Surface the error but preserve whatever was previously displayed.
      setError(fmtError(err));
      setIsStale(true);
      if (lastGoodPrsRef.current !== null) {
        const cfg = await loadConfig().catch(() => ({ pollingInterval: 300_000 }));
        const staleTtl = (cfg.pollingInterval || 300_000) * 2;
        if (Date.now() - lastGoodPrsRef.current.timestamp <= staleTtl) {
          setPrs(lastGoodPrsRef.current.prs);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const setupPolling = useCallback(async () => {
    const config = await loadConfig();
    const interval = config.pollingInterval || 300_000;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchPRs, interval);
  }, [fetchPRs]);

  useEffect(() => {
    fetchPRs().then(() => setupPolling());
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPRs, setupPolling]);

  const reload = useCallback(async () => {
    etagCache.clear();
    cachedUserLogins.clear(); // tokens may have changed
    prevPrsRef.current = null; // reset so next fetch re-establishes baseline
    lastGoodPrsRef.current = null; // clear preserved list so a fresh one is committed
    await fetchPRs();
    await setupPolling();
  }, [fetchPRs, setupPolling]);

  // User-initiated refresh: clear ETag cache so every repo gets a forced fresh
  // fetch from GitHub rather than relying on potentially stale cached data.
  const refresh = useCallback(async () => {
    etagCache.clear();
    await fetchPRs();
  }, [fetchPRs]);

  return { prs, loading, error, lastSync, hasConfig, isStale, refresh, reload };
}

// ─── notification diff ───────────────────────────────────────────────────────

/**
 * Compare fresh PR list against previous snapshot.
 * Fires OS notifications for:
 *   - New PR opened on a tracked repo
 *   - Commits pushed to an existing PR (head SHA changed = re-review needed)
 */
async function diffAndNotify(freshPrs, prevMap) {
  const toNotify = [];

  for (const pr of freshPrs) {
    const key = `${pr._repoKey}#${pr.number}`;
    const prev = prevMap.get(key);

    if (!prev) {
      // Brand-new PR
      toNotify.push({
        title: `New PR — ${pr._repoKey}`,
        body: `#${pr.number} · ${pr.title}`,
      });
    } else if (prev.head.sha !== pr.head.sha) {
      // Commits pushed since last poll — existing review is stale
      toNotify.push({
        title: `Changes pushed — ${pr._repoKey}`,
        body: `#${pr.number} · ${pr.title}`,
      });
    }

    if (pr._isOwn && prev) {
      // CI status changed
      if (prev._ciStatus !== pr._ciStatus) {
        if (pr._ciStatus === "failing") {
          toNotify.push({
            title: `CI failing — ${pr._repoKey}`,
            body: `#${pr.number} · ${pr.title}`,
          });
        } else if (pr._ciStatus === "passing" && prev._ciStatus !== "passing") {
          toNotify.push({
            title: `CI passed — ${pr._repoKey}`,
            body: `#${pr.number} · ${pr.title}`,
          });
        }
      }

      // Review state changed
      if (prev._priority !== pr._priority) {
        if (pr._priority === 1) {
          toNotify.push({
            title: `Changes requested — ${pr._repoKey}`,
            body: `#${pr.number} · ${pr.title}`,
          });
        } else if (pr._priority === 2) {
          toNotify.push({
            title: `Approved — ${pr._repoKey}`,
            body: `#${pr.number} · ${pr.title}`,
          });
        }
      }

      // New unresolved comments added
      if (pr._unresolvedComments > (prev._unresolvedComments ?? 0)) {
        toNotify.push({
          title: `New comments — ${pr._repoKey}`,
          body: `#${pr.number} · ${pr.title}`,
        });
      }
    }
  }

  if (!toNotify.length || !isTauri) return;

  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import(
      "@tauri-apps/plugin-notification"
    );

    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === "granted";
    }
    if (!granted) return;

    for (const n of toNotify) {
      sendNotification(n);
    }
  } catch (err) {
    console.warn("Notification error:", err);
  }
}

// ─── API helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch open PRs for a repo with ETag caching.
 * Iterates all pages (per_page: 100) so repos with >100 open PRs are fully
 * covered — no PRs are silently dropped.
 * Returns cached data unchanged on 304.
 */
async function fetchPulls(octokit, owner, repo) {
  const key = `pulls:${owner}/${repo}`;
  const cached = etagCache.get(key);

  // WKWebView's disk HTTP cache completely ignores the fetch `cache` option —
  // the only reliable bypass is a URL it has never seen.  When we have no
  // cached ETag (first fetch of a session, or after manual refresh clears the
  // cache) we append a per-call timestamp so the URL is always new.
  // On subsequent polls we DO have an ETag, so we send If-None-Match ourselves;
  // Octokit v21 throws RequestError("Not modified", 304) on that response.
  let firstResponse;
  try {
    if (cached?.etag) {
      firstResponse = await withRateLimit(() =>
        octokit.request("GET /repos/{owner}/{repo}/pulls", {
          owner,
          repo,
          state: "open",
          sort: "updated",
          per_page: 100,
          headers: { "if-none-match": cached.etag },
        }),
      );
    } else {
      firstResponse = await withRateLimit(() =>
        octokit.request(
          `GET /repos/${owner}/${repo}/pulls?state=open&sort=updated&per_page=100&_t=${Date.now()}`,
        ),
      );
    }
  } catch (err) {
    if (err.status === 304) return cached?.data ?? [];
    throw err;
  }

  let allPulls = [...firstResponse.data];

  // Follow subsequent pages when there are more than 100 open PRs.
  // The Link header's `rel="next"` url is parsed by Octokit automatically via
  // the paginate helper, but since we need ETag support on the first page we
  // drive pagination manually here.
  const linkHeader = firstResponse.headers?.link ?? "";
  let nextUrl = parseLinkNext(linkHeader);

  while (nextUrl) {
    const pageResp = await withRateLimit(() => octokit.request(`GET ${nextUrl}`));
    allPulls = allPulls.concat(pageResp.data);
    nextUrl = parseLinkNext(pageResp.headers?.link ?? "");
  }

  const etag = firstResponse.headers?.etag;
  if (etag) etagCache.set(key, { etag, data: allPulls });
  return allPulls;
}

/**
 * Fetch CI check status for a commit SHA with ETag caching.
 * CI results are immutable once complete, so cache hits are common.
 * Failures are isolated — a bad check-run fetch leaves the PR in the list
 * with an 'unknown' CI status rather than dropping the PR entirely.
 */
async function fetchCiStatus(octokit, owner, repo, sha) {
  const key = `checks:${owner}/${repo}/${sha}`;
  const cached = etagCache.get(key);

  try {
    const response = await withRateLimit(() =>
      octokit.request("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
        owner,
        repo,
        ref: sha,
        per_page: 50,
        headers: cached?.etag ? { "if-none-match": cached.etag } : {},
      }),
    );

    if (response.status === 304) return cached?.data ?? "unknown"; // CI unchanged

    const etag = response.headers?.etag;
    const status = ciStatusFromRuns(response.data.check_runs);
    if (etag) etagCache.set(key, { etag, data: status });
    return status;
  } catch (err) {
    if (err.status === 304 && cached) return cached.data;
    // Do NOT re-throw — a failed CI fetch must never remove the PR from the
    // list.  Fall back to 'unknown' so the card is still rendered.
    console.warn(`CI status fetch failed for ${owner}/${repo}@${sha}:`, err.message);
    return "unknown";
  }
}

/**
 * Fetch the review list for a PR with ETag caching.
 * Returns [] on failure so a bad fetch never removes the PR from the list.
 */
async function fetchReviews(octokit, owner, repo, pullNumber) {
  const key = `reviews:${owner}/${repo}/${pullNumber}`;
  const cached = etagCache.get(key);

  try {
    const response = await withRateLimit(() =>
      octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 50,
        headers: cached?.etag ? { "if-none-match": cached.etag } : {},
      }),
    );

    if (response.status === 304) return { data: cached?.data ?? [], fromCache: true };

    const etag = response.headers?.etag;
    const data = response.data;
    if (etag) etagCache.set(key, { etag, data });
    return { data, fromCache: false };
  } catch (err) {
    if (err.status === 304 && cached) return { data: cached.data, fromCache: true };
    console.warn(`Reviews fetch failed for ${owner}/${repo}#${pullNumber}:`, err.message);
    return { data: [], fromCache: false };
  }
}

/**
 * Fetch the count of unresolved review threads for a PR via GraphQL.
 * The REST API does not expose thread resolution status; GraphQL is required.
 * Returns 0 on failure so a bad fetch never removes the PR from the list.
 */
async function fetchUnresolvedCommentCount(octokit, owner, repo, pullNumber) {
  try {
    const response = await withRateLimit(() =>
      octokit.request("POST /graphql", {
        query: `
          query($owner: String!, $repo: String!, $number: Int!) {
            repository(owner: $owner, name: $repo) {
              pullRequest(number: $number) {
                reviewThreads(first: 100) {
                  nodes { isResolved }
                }
              }
            }
          }
        `,
        variables: { owner, repo, number: pullNumber },
      }),
    );
    const threads = response.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];
    return threads.filter((t) => !t.isResolved).length;
  } catch (err) {
    console.warn(
      `Unresolved comments fetch failed for ${owner}/${repo}#${pullNumber}:`,
      err.message,
    );
    return 0;
  }
}

/**
 * Wraps a GitHub API call with one retry on rate-limit (403/429).
 * Waits until x-ratelimit-reset if header is present, else 65s.
 */
async function withRateLimit(fn) {
  try {
    return await fn();
  } catch (err) {
    const remaining = err.response?.headers?.["x-ratelimit-remaining"];
    const reset = err.response?.headers?.["x-ratelimit-reset"];
    const isRateLimit = err.status === 429 || (err.status === 403 && remaining === "0");

    if (isRateLimit && reset) {
      const waitMs = Math.max(parseInt(reset, 10) * 1000 - Date.now() + 2000, 2000);
      if (waitMs <= 70_000) {
        await sleep(waitMs);
        return await fn();
      }
    }

    if (err.status === 403 && err.message?.toLowerCase().includes("secondary")) {
      await sleep(60_000);
      return await fn();
    }

    throw err;
  }
}

// ─── pure helpers ────────────────────────────────────────────────────────────

export function ciStatusFromRuns(runs) {
  if (!runs?.length) return "unknown";
  if (
    runs.some((r) =>
      ["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusion),
    )
  )
    return "failing";
  if (runs.some((r) => ["in_progress", "queued", "waiting", "requested"].includes(r.status)))
    return "pending";
  if (runs.every((r) => ["success", "skipped", "neutral"].includes(r.conclusion))) return "passing";
  return "unknown";
}

export function sortPrs(a, b) {
  if (a._isOwn !== b._isOwn) return a._isOwn ? -1 : 1;
  if (a._priority !== b._priority) return a._priority - b._priority;
  if (a._repoKey !== b._repoKey) return a._repoKey.localeCompare(b._repoKey);
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

/**
 * Priority tiers:
 *   0 — needs review   (no review activity, awaiting first look)
 *   1 — open comments  (changes requested or reviewer left comments)
 *   2 — ready          (approved, no outstanding changes requested)
 *   3 — draft / other
 */
export function getPrPriority(pr, reviews) {
  if (pr.draft) return 3;

  // Collapse to the latest review state per reviewer, ignoring PENDING/DISMISSED
  const latestByReviewer = new Map();
  for (const r of reviews) {
    if (r.state === "PENDING" || r.state === "DISMISSED") continue;
    latestByReviewer.set(r.user.login, r.state);
  }

  const states = [...latestByReviewer.values()];
  const hasApproval = states.some((s) => s === "APPROVED");
  const hasChangesRequested = states.some((s) => s === "CHANGES_REQUESTED");

  if (hasChangesRequested) return 1;
  if (hasApproval) return 2;
  return 0; // no reviews yet — needs first look
}

export function fmtError(err) {
  if (err.status === 401) return "GitHub token invalid or expired";
  if (err.status === 403) {
    const reset = err.response?.headers?.["x-ratelimit-reset"];
    if (reset) {
      const mins = Math.ceil((parseInt(reset, 10) * 1000 - Date.now()) / 60_000);
      return `Rate limit exceeded — resets in ${mins}m`;
    }
    return "GitHub access forbidden (check token scopes)";
  }
  if (err.status === 404) return "Repository not found (check name or token scope)";
  return err.message;
}

/**
 * Parse the `rel="next"` URL out of a GitHub Link header.
 * Returns null when there is no next page.
 */
export function parseLinkNext(linkHeader) {
  if (!linkHeader) return null;
  // Link header format: <url>; rel="next", <url>; rel="last"
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
