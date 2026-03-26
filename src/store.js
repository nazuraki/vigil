// Wraps @tauri-apps/plugin-store with a simple config API.
// Config is stored in {appDataDir}/config.json.

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

let _store = null

async function getStore() {
  if (_store) return _store
  if (!isTauri) return null
  const { load } = await import('@tauri-apps/plugin-store')
  _store = await load('config.json', { autoSave: true })
  return _store
}

const DEFAULTS = {
  token: '',
  repos: [],
  pollingInterval: 300000, // 5 minutes
}

/**
 * Sorts an array of { owner, repo } objects alphabetically by "owner/repo",
 * case-insensitive. Returns a new sorted array; does not mutate the input.
 */
export function sortRepos(repos) {
  return [...repos].sort((a, b) => {
    const keyA = `${a.owner}/${a.repo}`.toLowerCase()
    const keyB = `${b.owner}/${b.repo}`.toLowerCase()
    return keyA.localeCompare(keyB)
  })
}

export async function loadConfig() {
  const store = await getStore()
  if (!store) {
    // Fallback for browser dev (no Tauri)
    try {
      const cfg = JSON.parse(localStorage.getItem('vigil_config') || '{}')
      return {
        ...cfg,
        repos: sortRepos(cfg.repos || []),
      }
    } catch {
      return { ...DEFAULTS }
    }
  }
  return {
    token:           (await store.get('token'))           ?? DEFAULTS.token,
    repos:           sortRepos((await store.get('repos')) ?? DEFAULTS.repos),
    pollingInterval: (await store.get('pollingInterval')) ?? DEFAULTS.pollingInterval,
  }
}

export async function saveConfig(config) {
  const store = await getStore()
  if (!store) {
    localStorage.setItem('vigil_config', JSON.stringify(config))
    return
  }
  await store.set('token', config.token)
  await store.set('repos', config.repos)
  await store.set('pollingInterval', config.pollingInterval)
}
