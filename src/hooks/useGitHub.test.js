import { describe, expect, it } from "vitest";
import { ciStatusFromRuns, fmtError, getPrPriority, parseLinkNext, sortPrs } from "./useGitHub.js";

// ─── ciStatusFromRuns ─────────────────────────────────────────────────────────

describe("ciStatusFromRuns", () => {
  it("returns 'unknown' for empty / null input", () => {
    expect(ciStatusFromRuns([])).toBe("unknown");
    expect(ciStatusFromRuns(null)).toBe("unknown");
    expect(ciStatusFromRuns(undefined)).toBe("unknown");
  });

  it("returns 'failing' when any run has a failure conclusion", () => {
    for (const c of ["failure", "timed_out", "cancelled", "action_required"]) {
      expect(
        ciStatusFromRuns([
          { status: "completed", conclusion: "success" },
          { status: "completed", conclusion: c },
        ]),
      ).toBe("failing");
    }
  });

  it("returns 'pending' when any run is in-progress/queued (and none failing)", () => {
    for (const s of ["in_progress", "queued", "waiting", "requested"]) {
      expect(
        ciStatusFromRuns([
          { status: "completed", conclusion: "success" },
          { status: s, conclusion: null },
        ]),
      ).toBe("pending");
    }
  });

  it("returns 'passing' when all runs are success/skipped/neutral", () => {
    expect(
      ciStatusFromRuns([
        { status: "completed", conclusion: "success" },
        { status: "completed", conclusion: "skipped" },
        { status: "completed", conclusion: "neutral" },
      ]),
    ).toBe("passing");
  });

  it("failure takes precedence over pending", () => {
    expect(
      ciStatusFromRuns([
        { status: "in_progress", conclusion: null },
        { status: "completed", conclusion: "failure" },
      ]),
    ).toBe("failing");
  });
});

// ─── getPrPriority ────────────────────────────────────────────────────────────

function makeReviews(states) {
  return states.map((state, i) => ({
    user: { login: `reviewer${i}` },
    state,
  }));
}

describe("getPrPriority", () => {
  it("returns 3 for drafts regardless of reviews", () => {
    expect(getPrPriority({ draft: true }, makeReviews(["APPROVED"]))).toBe(3);
  });

  it("returns 0 when there are no actionable reviews", () => {
    expect(getPrPriority({ draft: false }, [])).toBe(0);
    expect(getPrPriority({ draft: false }, makeReviews(["PENDING", "DISMISSED"]))).toBe(0);
  });

  it("returns 1 when changes are requested", () => {
    expect(getPrPriority({ draft: false }, makeReviews(["APPROVED", "CHANGES_REQUESTED"]))).toBe(1);
  });

  it("returns 2 when approved and no changes requested", () => {
    expect(getPrPriority({ draft: false }, makeReviews(["APPROVED"]))).toBe(2);
  });

  it("uses only the latest review per reviewer", () => {
    // Two reviews from the same reviewer: first CHANGES_REQUESTED, then APPROVED
    const reviews = [
      { user: { login: "alice" }, state: "CHANGES_REQUESTED" },
      { user: { login: "alice" }, state: "APPROVED" },
    ];
    expect(getPrPriority({ draft: false }, reviews)).toBe(2);
  });
});

// ─── sortPrs ──────────────────────────────────────────────────────────────────

function makePr(overrides) {
  return {
    _isOwn: false,
    _priority: 0,
    _repoKey: "org/repo",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("sortPrs", () => {
  it("own PRs sort before others", () => {
    const a = makePr({ _isOwn: false });
    const b = makePr({ _isOwn: true });
    expect(sortPrs(a, b)).toBeGreaterThan(0); // b before a
    expect(sortPrs(b, a)).toBeLessThan(0);
  });

  it("lower priority number sorts first within same ownership", () => {
    const a = makePr({ _priority: 2 });
    const b = makePr({ _priority: 0 });
    expect(sortPrs(a, b)).toBeGreaterThan(0);
  });

  it("sorts by repo key when priority and ownership match", () => {
    const a = makePr({ _repoKey: "z-org/repo" });
    const b = makePr({ _repoKey: "a-org/repo" });
    expect(sortPrs(a, b)).toBeGreaterThan(0);
  });

  it("sorts by updated_at descending within same repo", () => {
    const older = makePr({ updated_at: "2024-01-01T00:00:00Z" });
    const newer = makePr({ updated_at: "2024-06-01T00:00:00Z" });
    expect(sortPrs(older, newer)).toBeGreaterThan(0); // newer first
  });
});

// ─── parseLinkNext ────────────────────────────────────────────────────────────

describe("parseLinkNext", () => {
  it("returns null for empty / missing header", () => {
    expect(parseLinkNext("")).toBeNull();
    expect(parseLinkNext(null)).toBeNull();
    expect(parseLinkNext(undefined)).toBeNull();
  });

  it("extracts the next URL from a Link header", () => {
    const header =
      '<https://api.github.com/repos/o/r/pulls?page=2>; rel="next", <https://api.github.com/repos/o/r/pulls?page=5>; rel="last"';
    expect(parseLinkNext(header)).toBe("https://api.github.com/repos/o/r/pulls?page=2");
  });

  it("returns null when there is no rel=next", () => {
    const header = '<https://api.github.com/repos/o/r/pulls?page=5>; rel="last"';
    expect(parseLinkNext(header)).toBeNull();
  });
});

// ─── fmtError ─────────────────────────────────────────────────────────────────

describe("fmtError", () => {
  it("describes a 401 error", () => {
    expect(fmtError({ status: 401 })).toMatch(/invalid|expired/i);
  });

  it("describes a 404 error", () => {
    expect(fmtError({ status: 404 })).toMatch(/not found/i);
  });

  it("describes a rate-limit 403 with reset time", () => {
    const reset = Math.floor(Date.now() / 1000) + 600; // 10 min from now
    const msg = fmtError({
      status: 403,
      response: { headers: { "x-ratelimit-reset": String(reset) } },
    });
    expect(msg).toMatch(/rate limit/i);
    expect(msg).toMatch(/\d+m/);
  });

  it("describes a 403 without reset as scope/token issue", () => {
    const msg = fmtError({ status: 403, response: { headers: {} } });
    expect(msg).toMatch(/forbidden|scope/i);
  });

  it("falls through to err.message for unknown errors", () => {
    expect(fmtError({ message: "something unexpected" })).toBe("something unexpected");
  });
});
