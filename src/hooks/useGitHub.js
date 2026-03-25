import { useState, useEffect, useCallback, useRef } from 'react'
import { Octokit } from '@octokit/rest'
import { loadConfig } from '../store'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// ─── ETag cache ──────────────────────────────────────────────────────────────
// Module-level: survives re-renders, cleared on full reload/reload().
// Keys: "pulls:{owner}/{repo}" and "checks:{owner}/{repo}/{sha}"
const etagCache = new Map()

// ─── hook ────────────────────────────────────────────────────────────────────

export function useGitHub() {
  const [prs, setPrs]             = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [lastSync, setLastSync]   = useState(null)
  const [hasConfig, setHasConfig] = useState(true)
  const intervalRef               = useRef(null)

  // Keyed by `${repoKey}#${number}` → { sha }
  // Null until the first successful fetch — prevents notifying on initial load.
  const prevPrsRef = useRef(null)

  const fetchPRs = useCallback(async () => {
    const config = await loadConfig()

    if (!config.token || !config.repos?.length) {
      setHasConfig(false)
      setPrs([])
      return
    }
    setHasConfig(true)
    setLoading(true)
    setError(null)

    try {
      const octokit = new Octokit({ auth: config.token })
      const allPrs  = []

      for (const { owner, repo } of config.repos) {
        try {
          const pulls = await fetchPulls(octokit, owner, repo)
          for (const pr of pulls) {
            const ciStatus = await fetchCiStatus(octokit, owner, repo, pr.head.sha)
            allPrs.push({ ...pr, _repoKey: `${owner}/${repo}`, _ciStatus: ciStatus })
          }
        } catch (repoErr) {
          console.warn(`Failed to fetch ${owner}/${repo}:`, repoErr.message)
        }
      }

      allPrs.sort(sortPrs)

      // Diff against previous state and fire notifications (skip on first load)
      if (prevPrsRef.current !== null) {
        await diffAndNotify(allPrs, prevPrsRef.current)
      }
      prevPrsRef.current = new Map(allPrs.map(pr => [`${pr._repoKey}#${pr.number}`, pr]))

      setPrs(allPrs)
      setLastSync(new Date())
    } catch (err) {
      setError(fmtError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const setupPolling = useCallback(async () => {
    const config   = await loadConfig()
    const interval = config.pollingInterval || 300_000
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(fetchPRs, interval)
  }, [fetchPRs])

  useEffect(() => {
    fetchPRs().then(() => setupPolling())
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchPRs, setupPolling])

  const reload = useCallback(async () => {
    etagCache.clear()
    prevPrsRef.current = null   // reset so next fetch re-establishes baseline
    await fetchPRs()
    await setupPolling()
  }, [fetchPRs, setupPolling])

  return { prs, loading, error, lastSync, hasConfig, refresh: fetchPRs, reload }
}

// ─── notification diff ───────────────────────────────────────────────────────

/**
 * Compare fresh PR list against previous snapshot.
 * Fires OS notifications for:
 *   - New PR opened on a tracked repo
 *   - Commits pushed to an existing PR (head SHA changed = re-review needed)
 */
async function diffAndNotify(freshPrs, prevMap) {
  const toNotify = []

  for (const pr of freshPrs) {
    const key  = `${pr._repoKey}#${pr.number}`
    const prev = prevMap.get(key)

    if (!prev) {
      // Brand-new PR
      toNotify.push({
        title: `New PR — ${pr._repoKey}`,
        body:  `#${pr.number} · ${pr.title}`,
      })
    } else if (prev.head.sha !== pr.head.sha) {
      // Commits pushed since last poll — existing review is stale
      toNotify.push({
        title: `Changes pushed — ${pr._repoKey}`,
        body:  `#${pr.number} · ${pr.title}`,
      })
    }
  }

  if (!toNotify.length || !isTauri) return

  try {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import('@tauri-apps/plugin-notification')

    let granted = await isPermissionGranted()
    if (!granted) {
      granted = (await requestPermission()) === 'granted'
    }
    if (!granted) return

    for (const n of toNotify) {
      sendNotification(n)
    }
  } catch (err) {
    console.warn('Notification error:', err)
  }
}

// ─── API helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch open PRs for a repo with ETag caching.
 * Uses per_page:100 (covers all but the most PR-heavy monorepos).
 * Returns cached data unchanged on 304.
 */
async function fetchPulls(octokit, owner, repo) {
  const key    = `pulls:${owner}/${repo}`
  const cached = etagCache.get(key)

  const response = await withRateLimit(() =>
    octokit.request('GET /repos/{owner}/{repo}/pulls', {
      owner, repo,
      state: 'open', sort: 'updated', per_page: 100,
      headers: cached?.etag ? { 'if-none-match': cached.etag } : {},
    })
  )

  if (response.status === 304) return cached.data   // nothing changed

  const etag = response.headers?.etag
  if (etag) etagCache.set(key, { etag, data: response.data })
  return response.data
}

/**
 * Fetch CI check status for a commit SHA with ETag caching.
 * CI results are immutable once complete, so cache hits are common.
 */
async function fetchCiStatus(octokit, owner, repo, sha) {
  const key    = `checks:${owner}/${repo}/${sha}`
  const cached = etagCache.get(key)

  try {
    const response = await withRateLimit(() =>
      octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
        owner, repo, ref: sha, per_page: 50,
        headers: cached?.etag ? { 'if-none-match': cached.etag } : {},
      })
    )

    if (response.status === 304) return cached.data   // CI unchanged

    const etag = response.headers?.etag
    const status = ciStatusFromRuns(response.data.check_runs)
    if (etag) etagCache.set(key, { etag, data: status })
    return status
  } catch (err) {
    if (err.status === 304 && cached) return cached.data
    return 'unknown'
  }
}

/**
 * Wraps a GitHub API call with one retry on rate-limit (403/429).
 * Waits until x-ratelimit-reset if header is present, else 65s.
 */
async function withRateLimit(fn) {
  try {
    return await fn()
  } catch (err) {
    const remaining = err.response?.headers?.['x-ratelimit-remaining']
    const reset     = err.response?.headers?.['x-ratelimit-reset']
    const isRateLimit = (err.status === 429) ||
      (err.status === 403 && remaining === '0')

    if (isRateLimit && reset) {
      const waitMs = Math.max(parseInt(reset) * 1000 - Date.now() + 2000, 2000)
      if (waitMs <= 70_000) {
        await sleep(waitMs)
        return await fn()
      }
    }

    if (err.status === 403 && err.message?.toLowerCase().includes('secondary')) {
      await sleep(60_000)
      return await fn()
    }

    throw err
  }
}

// ─── pure helpers ────────────────────────────────────────────────────────────

function ciStatusFromRuns(runs) {
  if (!runs?.length) return 'unknown'
  if (runs.some(r => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(r.conclusion))) return 'failing'
  if (runs.some(r => ['in_progress', 'queued', 'waiting', 'requested'].includes(r.status))) return 'pending'
  if (runs.every(r => ['success', 'skipped', 'neutral'].includes(r.conclusion))) return 'passing'
  return 'unknown'
}

const STATUS_ORDER = { failing: 0, pending: 1, passing: 2, unknown: 3 }

function sortPrs(a, b) {
  const diff = (STATUS_ORDER[a._ciStatus] ?? 3) - (STATUS_ORDER[b._ciStatus] ?? 3)
  if (diff !== 0) return diff
  return new Date(b.updated_at) - new Date(a.updated_at)
}

function fmtError(err) {
  if (err.status === 401) return 'GitHub token invalid or expired'
  if (err.status === 403) {
    const reset = err.response?.headers?.['x-ratelimit-reset']
    if (reset) {
      const mins = Math.ceil((parseInt(reset) * 1000 - Date.now()) / 60_000)
      return `Rate limit exceeded — resets in ${mins}m`
    }
    return 'GitHub access forbidden (check token scopes)'
  }
  if (err.status === 404) return 'Repository not found (check name or token scope)'
  return err.message
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}
