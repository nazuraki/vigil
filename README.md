# Vigil

A native desktop app that watches GitHub pull requests across multiple repositories and surfaces them in a compact, always-accessible window.

## Features

- Polls GitHub for open PRs across any number of repos
- Shows CI/check status per PR
- Desktop notifications for new or updated PRs
- Compact 400×580px window — stays out of the way
- Config persisted locally (GitHub PAT, repos, polling interval)

## Stack

| Layer | Tech |
|---|---|
| Desktop wrapper | Tauri 2 (Rust) |
| Frontend | React 18 + Vite 6 |
| Styles | TailwindCSS 3 |
| GitHub API | `@octokit/rest` v21 |
| Config persistence | `@tauri-apps/plugin-store` |

## Prerequisites

- [Rust](https://rustup.rs/) (stable)
- Node.js 20+
- On macOS: Xcode Command Line Tools (`xcode-select --install`)
- On Windows: [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 11)

## Setup

```bash
npm install
```

## Development

```bash
npm run tauri dev
```

This starts Vite in dev mode and launches the Tauri window with hot reload.

### Rebuilding the icon

```bash
npm run tauri icon icon.png
```

## Build

```bash
# Production bundle
npm run tauri build
```

Output is in `src-tauri/target/release/vigil` (binary) and `src-tauri/target/release/bundle/` (installer).

### Mac

The application will be in `src-tauri/target/release/bundle/macos/Vigil.app`.

The disk image will be in `src-tauri/target/release/bundle/dmg/Vigil_<version>_aarch64.dmg`.

## Configuration

On first launch, open Settings and enter:

- **GitHub PAT** — personal access token (see [GitHub Token Requirements](#github-token-requirements) below)
- **Repositories** — one or more `owner/repo` entries to watch
- **Polling interval** — how often to check (default: 5 minutes)

Config is stored in the OS app data directory as `config.json`.

## GitHub Token Requirements

Vigil supports both classic and fine-grained GitHub Personal Access Tokens.
Create one at <https://github.com/settings/tokens>.

### Classic PAT

Grant the **`repo`** scope. This gives Vigil read access to pull requests, commits, and CI check statuses.

### Fine-grained PAT (recommended)

Under **Repository permissions**, set the following to **Read-only**:

| Permission | Why it's needed |
|---|---|
| **Pull requests** | List open PRs and their metadata |
| **Commits** | Fetch commit statuses and CI check results |

All other permissions can remain at their default (no access).
