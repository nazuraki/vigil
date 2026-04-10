---
name: views
description: "Skill for the Views area of vigil. 12 symbols across 2 files."
---

# Views

12 symbols | 2 files | Cohesion: 79%

## When to Use

- Working with code in `src/`
- Understanding how sortRepos, newAccountId, loadConfig work
- Modifying views-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/store.js` | getStore, sortRepos, newAccountId, loadConfig, migrateConfig (+1) |
| `src/views/Settings.jsx` | addAccount, Settings, removeAccount, updateAccount, addRepo (+1) |

## Entry Points

Start here when exploring this area:

- **`sortRepos`** (Function) — `src/store.js:21`
- **`newAccountId`** (Function) — `src/store.js:29`
- **`loadConfig`** (Function) — `src/store.js:33`
- **`saveConfig`** (Function) — `src/store.js:85`
- **`addAccount`** (Function) — `src/views/Settings.jsx:43`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `sortRepos` | Function | `src/store.js` | 21 |
| `newAccountId` | Function | `src/store.js` | 29 |
| `loadConfig` | Function | `src/store.js` | 33 |
| `saveConfig` | Function | `src/store.js` | 85 |
| `addAccount` | Function | `src/views/Settings.jsx` | 43 |
| `Settings` | Function | `src/views/Settings.jsx` | 12 |
| `removeAccount` | Function | `src/views/Settings.jsx` | 48 |
| `updateAccount` | Function | `src/views/Settings.jsx` | 53 |
| `addRepo` | Function | `src/views/Settings.jsx` | 58 |
| `removeRepo` | Function | `src/views/Settings.jsx` | 79 |
| `getStore` | Function | `src/store.js` | 7 |
| `migrateConfig` | Function | `src/store.js` | 69 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PrList → NewAccountId` | cross_community | 5 |
| `PrList → SortRepos` | cross_community | 5 |
| `Settings → NewAccountId` | cross_community | 4 |
| `Settings → SortRepos` | cross_community | 4 |
| `PrList → GetStore` | cross_community | 4 |
| `Settings → GetStore` | cross_community | 3 |

## How to Explore

1. `gitnexus_context({name: "sortRepos"})` — see callers and callees
2. `gitnexus_query({query: "views"})` — find related execution flows
3. Read key files listed above for implementation details
