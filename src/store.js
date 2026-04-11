// Wraps @tauri-apps/plugin-store with a simple config API.
// Config is stored in {appDataDir}/config.json.

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let _store = null;

async function getStore() {
  if (_store) return _store;
  if (!isTauri) return null;
  const { load } = await import("@tauri-apps/plugin-store");
  _store = await load("config.json", { defaults: {}, autoSave: true });
  return _store;
}

const DEFAULT_POLLING_INTERVAL = 300000; // 5 minutes

/**
 * Sorts an array of { owner, repo } objects alphabetically by "owner/repo",
 * case-insensitive. Returns a new sorted array; does not mutate the input.
 */
export function sortRepos(repos) {
  return [...repos].sort((a, b) => {
    const keyA = `${a.owner}/${a.repo}`.toLowerCase();
    const keyB = `${b.owner}/${b.repo}`.toLowerCase();
    return keyA.localeCompare(keyB);
  });
}

export function newAccountId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function loadConfig() {
  const store = await getStore();

  if (!store) {
    // Fallback for browser dev (no Tauri)
    try {
      const raw = JSON.parse(localStorage.getItem("vigil_config") || "{}");
      return migrateConfig(raw);
    } catch {
      return { accounts: [], pollingInterval: DEFAULT_POLLING_INTERVAL };
    }
  }

  const accountsFromStore = await store.get("accounts");

  if (accountsFromStore !== null && accountsFromStore !== undefined) {
    // New multi-account format
    return {
      accounts: (accountsFromStore || []).map((a) => ({
        ...a,
        repos: sortRepos(a.repos || []),
      })),
      pollingInterval: (await store.get("pollingInterval")) ?? DEFAULT_POLLING_INTERVAL,
    };
  }

  // Legacy single-token format — migrate transparently
  const token = await store.get("token");
  const repos = await store.get("repos");
  return migrateConfig({
    token,
    repos,
    pollingInterval: await store.get("pollingInterval"),
  });
}

function migrateConfig(raw) {
  const pollingInterval = raw.pollingInterval ?? DEFAULT_POLLING_INTERVAL;
  if (raw.token || raw.repos?.length) {
    return {
      accounts: [
        {
          id: newAccountId(),
          label: "",
          token: raw.token || "",
          repos: sortRepos(raw.repos || []),
        },
      ],
      pollingInterval,
    };
  }
  return { accounts: raw.accounts || [], pollingInterval };
}

export async function saveConfig(config) {
  const store = await getStore();
  if (!store) {
    localStorage.setItem("vigil_config", JSON.stringify(config));
    return;
  }
  await store.set("accounts", config.accounts);
  await store.set("pollingInterval", config.pollingInterval);
}
