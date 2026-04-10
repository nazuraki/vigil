---
name: hooks
description: "Skill for the Hooks area of vigil. 13 symbols across 2 files."
---

# Hooks

13 symbols | 2 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how PrList, useGitHub work
- Modifying hooks-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/hooks/useGitHub.js` | useGitHub, diffAndNotify, fetchCiStatus, ciStatusFromRuns, getPrPriority (+7) |
| `src/views/PrList.jsx` | PrList |

## Entry Points

Start here when exploring this area:

- **`PrList`** (Function) — `src/views/PrList.jsx:42`
- **`useGitHub`** (Function) — `src/hooks/useGitHub.js:18`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PrList` | Function | `src/views/PrList.jsx` | 42 |
| `useGitHub` | Function | `src/hooks/useGitHub.js` | 18 |
| `diffAndNotify` | Function | `src/hooks/useGitHub.js` | 187 |
| `fetchCiStatus` | Function | `src/hooks/useGitHub.js` | 320 |
| `ciStatusFromRuns` | Function | `src/hooks/useGitHub.js` | 439 |
| `getPrPriority` | Function | `src/hooks/useGitHub.js` | 461 |
| `fmtError` | Function | `src/hooks/useGitHub.js` | 480 |
| `fetchPulls` | Function | `src/hooks/useGitHub.js` | 262 |
| `fetchReviews` | Function | `src/hooks/useGitHub.js` | 351 |
| `fetchUnresolvedCommentCount` | Function | `src/hooks/useGitHub.js` | 381 |
| `withRateLimit` | Function | `src/hooks/useGitHub.js` | 411 |
| `parseLinkNext` | Function | `src/hooks/useGitHub.js` | 498 |
| `sleep` | Function | `src/hooks/useGitHub.js` | 505 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PrList → NewAccountId` | cross_community | 5 |
| `PrList → SortRepos` | cross_community | 5 |
| `PrList → Sleep` | cross_community | 5 |
| `PrList → GetStore` | cross_community | 4 |
| `PrList → ParseLinkNext` | cross_community | 4 |
| `PrList → CiStatusFromRuns` | intra_community | 4 |
| `FetchUnresolvedCommentCount → Sleep` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Views | 1 calls |

## How to Explore

1. `gitnexus_context({name: "PrList"})` — see callers and callees
2. `gitnexus_query({query: "hooks"})` — find related execution flows
3. Read key files listed above for implementation details
