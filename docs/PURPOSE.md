# Vigil — Purpose & Design

## What it does

Vigil is a native macOS desktop app that monitors GitHub pull requests across multiple repositories and accounts. It polls GitHub on a configurable interval, surfaces open PRs in a compact list, and fires OS notifications when something requires your attention.

## Problems it solves

Developers working across many repos — or with multiple GitHub accounts — have no lightweight, always-visible dashboard for PR state. Browser tabs go stale. GitHub's own notification system is noisy and coarse. Vigil stays in the menu bar and surfaces only what matters.

## Core behaviors

**Polling with ETag caching.** Every poll cycle sends `If-None-Match` headers so GitHub returns 304 (no data transfer) when nothing changed. This keeps API usage well within rate limits even at short intervals.

**Stale-data preservation.** If a poll cycle fails entirely (network down, all repos unreachable), Vigil keeps the last known-good PR list visible rather than blanking the screen. Stale data is held for up to 2× the polling interval, after which it is discarded to prevent closed/merged PRs from persisting indefinitely.

**Priority sorting.** PRs are sorted by a computed priority tier:
- `0` — needs review (no reviews yet)
- `1` — changes requested or open comments
- `2` — approved
- `3` — draft

Within a tier, the authenticated user's own PRs float to the top, then PRs are sorted by repo name, then by most-recently-updated.

**Unresolved comment count.** The REST API does not expose thread resolution state; Vigil uses GraphQL to count unresolved review threads per PR.

**Targeted OS notifications.** Vigil notifies on:
- New PR opened on a tracked repo
- Commits pushed to an existing PR (head SHA changed)
- CI status changed on your own PR (pass/fail)
- Review state changed on your own PR (approved / changes requested)
- New unresolved comments added to your own PR

## Architecture

| Layer | Technology |
|-------|-----------|
| Desktop runtime | Tauri 2 (Rust shell + WebView) |
| Frontend | React 18 + Vite 6 |
| Styling | TailwindCSS 3 |
| GitHub API | @octokit/rest v21 |
| Config persistence | @tauri-apps/plugin-store (OS app data dir) |

The frontend is a single-page React app. State lives in the `useGitHub` hook, which drives polling, diff/notify logic, and error handling. Config is loaded from and saved to a Tauri store (`config.json`) in the OS app data directory; a `localStorage` fallback enables browser-based development without a Tauri runtime.

## Multi-account support

Config holds an array of accounts, each with its own GitHub PAT and list of `{ owner, repo }` pairs. Repos are stored sorted alphabetically. On first load, legacy single-token configs are transparently migrated to the multi-account format.
