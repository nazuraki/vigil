# Vigil — Context

## What it is
A native desktop utility (Tauri 2) that polls GitHub for open PRs across multiple repositories and renders them in a compact, always-accessible window. Mac-first; also builds a portable Windows exe.

## Stack
| Layer | Tech |
|---|---|
| Desktop wrapper | Tauri 2 (Rust) |
| Frontend | React 18 + Vite 6 |
| Styles | TailwindCSS 3 (custom design tokens) |
| GitHub API | `@octokit/rest` v21 |
| Config persistence | `@tauri-apps/plugin-store` (JSON in app data dir) |
| URL opening | `@tauri-apps/plugin-opener` |

## Design system
**Kinetic Ledger (Muted)** — dark slate palette, Space Grotesk headlines, Inter body, no hard borders (background shifts for hierarchy). See `docs/design/kinetic_obsidian/DESIGN.md`.

## Window
400 × 580 px, resizable, min 340 × 400.

## Views
- **PrList** (`src/views/PrList.jsx`) — compact PR list, fixed header + scrollable cards + status footer
- **Settings** (`src/views/Settings.jsx`) — GitHub accounts (token + repos per account), polling interval

## Key files
```
src/
  hooks/useGitHub.js   — polling logic, CI status enrichment, sort
  store.js             — Tauri plugin-store wrapper (falls back to localStorage in browser)
  components/PrCard.jsx
  utils/time.js
src-tauri/
  tauri.conf.json      — window size, bundle config
  capabilities/        — Tauri 2 permissions
```

## Running
```bash
npm run tauri dev      # dev mode (starts Vite + Tauri)
npm run tauri build    # production bundle
```

Icons must be generated before `tauri build`:
```bash
npx tauri icon path/to/icon.png   # generates all required icon sizes
```

## Config storage
Stored in OS app data dir as `config.json`:
- `accounts` — `[{ id, label, token, repos: [{ owner, repo }] }]` — multiple GitHub accounts, each with own PAT and repo list
- `pollingInterval` — ms (default 300000 = 5 min)

Old single-account format (`token` + `repos` keys) is auto-migrated to `accounts` on first load.
