import { useState, useEffect, useRef } from 'react'
import { loadConfig, saveConfig, sortRepos, newAccountId } from '../store'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const isMac   = isTauri && typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac')

const INTERVALS = [
  { label: '1m  (real-time)',    value: 60_000 },
  { label: '5m  (standard)',     value: 300_000 },
  { label: '15m (conservative)', value: 900_000 },
]

export default function Settings() {
  const [accounts,  setAccounts]  = useState([])
  const [interval,  setInterval]  = useState(300_000)
  const [saved,     setSaved]     = useState(false)
  const [isDirty,   setIsDirty]   = useState(false)
  const savedTimerRef = useRef(null)

  useEffect(() => {
    loadConfig().then(cfg => {
      setAccounts(cfg.accounts || [])
      setInterval(cfg.pollingInterval || 300_000)
    })
  }, [])

  // Auto-save 600ms after the last change; emit so main window refreshes
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(async () => {
      await saveConfig({ accounts, pollingInterval: interval })
      if (isTauri) {
        const { emit } = await import('@tauri-apps/api/event')
        await emit('config-updated')
      }
      setIsDirty(false)
      setSaved(true)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000)
    }, 600)
    return () => clearTimeout(timer)
  }, [isDirty, accounts, interval])

  function addAccount() {
    setAccounts(prev => [...prev, { id: newAccountId(), label: '', token: '', repos: [] }])
    setIsDirty(true)
  }

  function removeAccount(id) {
    setAccounts(prev => prev.filter(a => a.id !== id))
    setIsDirty(true)
  }

  function updateAccount(id, patch) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    setIsDirty(true)
  }

  function addRepo(accountId, repoInput, setRepoInput, setError) {
    const input = repoInput.trim().replace(/^https?:\/\/github\.com\//, '')
    const parts = input.split('/')
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      setError('Enter as owner/repo')
      return
    }
    const owner = parts[0]
    const repo  = parts[1].replace(/\.git$/, '')
    const account = accounts.find(a => a.id === accountId)
    if (account?.repos.some(r => r.owner === owner && r.repo === repo)) {
      setError('Already tracked')
      return
    }
    updateAccount(accountId, {
      repos: sortRepos([...(account?.repos || []), { owner, repo }]),
    })
    setRepoInput('')
    setError('')
  }

  function removeRepo(accountId, owner, repo) {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return
    updateAccount(accountId, {
      repos: account.repos.filter(r => !(r.owner === owner && r.repo === repo)),
    })
  }

  return (
    <div className="flex flex-col h-screen bg-background">

      {/* Header */}
      <header
        data-tauri-drag-region
        className={`shrink-0 flex items-center px-4 border-b border-outline-variant/10 bg-background ${isMac ? 'pt-7 pb-2.5' : 'py-2.5'}`}
      >
        <h1 className="flex-1 text-base font-bold tracking-tighter text-on-surface font-headline">Settings</h1>
        {saved && (
          <div className="flex items-center gap-1 text-[0.625rem] font-mono text-emerald-400/80 transition-opacity">
            <span
              className="material-symbols-outlined !text-[0.75rem]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >save</span>
            <span>Saved</span>
          </div>
        )}
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3.5">

        {/* GitHub Accounts */}
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[0.625rem] font-mono uppercase tracking-widest text-on-surface-variant">
              GitHub Accounts
            </label>
            <button
              onClick={addAccount}
              className="flex items-center gap-1 px-2 py-0.5 bg-primary-container text-on-primary-container text-[0.625rem] font-headline font-bold rounded hover:opacity-90 transition-opacity active:scale-95"
            >
              <span className="material-symbols-outlined !text-[0.75rem]">add</span>
              Add account
            </button>
          </div>

          {accounts.length === 0 && (
            <p className="text-[0.625rem] text-on-surface-variant/40 py-1.5">No accounts configured. Add one above.</p>
          )}

          <div className="flex flex-col gap-3">
            {accounts.map((account, idx) => (
              <AccountCard
                key={account.id}
                account={account}
                index={idx}
                onUpdate={(patch) => updateAccount(account.id, patch)}
                onRemove={() => removeAccount(account.id)}
                onAddRepo={(repoInput, setRepoInput, setError) =>
                  addRepo(account.id, repoInput, setRepoInput, setError)
                }
                onRemoveRepo={(owner, repo) => removeRepo(account.id, owner, repo)}
              />
            ))}
          </div>
        </section>

        {/* Polling interval */}
        <section>
          <label className="block text-[0.625rem] font-mono uppercase tracking-widest text-on-surface-variant mb-1.5">
            Polling Interval
          </label>
          <div className="flex flex-col gap-1">
            {INTERVALS.map(opt => (
              <label
                key={opt.value}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors rounded ${
                  interval === opt.value
                    ? 'bg-surface-container-high border border-primary/30'
                    : 'bg-surface-container-low border border-transparent hover:bg-surface-bright'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${interval === opt.value ? 'bg-primary' : 'bg-on-surface-variant/30'}`} />
                  <span className={`text-sm font-mono ${interval === opt.value ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>
                    {opt.label}
                  </span>
                </div>
                <input
                  type="radio"
                  name="interval"
                  checked={interval === opt.value}
                  onChange={() => { setInterval(opt.value); setIsDirty(true) }}
                  className="sr-only"
                />
              </label>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}

function AccountCard({ account, index, onUpdate, onRemove, onAddRepo, onRemoveRepo }) {
  const [repoInput, setRepoInput] = useState('')
  const [error,     setError]     = useState('')

  return (
    <div className="border border-outline-variant/20 bg-surface-container-low rounded">
      {/* Account header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant/10">
        <span className="text-[0.625rem] font-mono text-on-surface-variant/50 shrink-0">#{index + 1}</span>
        <input
          type="text"
          value={account.label}
          onChange={e => onUpdate({ label: e.target.value })}
          placeholder="Label (optional)"
          className="flex-1 bg-transparent text-sm font-headline text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none"
        />
        <button
          onClick={onRemove}
          className="p-1 text-on-surface-variant/30 hover:text-error transition-colors"
          title="Remove account"
        >
          <span className="material-symbols-outlined !text-[1rem]">delete</span>
        </button>
      </div>

      <div className="px-3 py-2.5 flex flex-col gap-2.5">
        {/* Token */}
        <div>
          <div className="text-[0.5625rem] font-mono uppercase tracking-widest text-on-surface-variant/50 mb-1">Token</div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 !text-[0.875rem]">
              key
            </span>
            <input
              type="password"
              value={account.token}
              onChange={e => onUpdate({ token: e.target.value })}
              placeholder="ghp_••••••••••••••••••••"
              className="w-full bg-surface-container-high border-0 border-b-2 border-outline-variant text-on-surface placeholder:text-on-surface-variant/30 py-1.5 pl-8 pr-3 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <p className="mt-1 text-[0.5625rem] text-on-surface-variant/40">
            Classic PAT: <span className="font-mono">repo</span> scope.{' '}
            Fine-grained: <span className="font-mono">Pull requests</span> + <span className="font-mono">Commits</span> (read-only).
          </p>
        </div>

        {/* Repos */}
        <div>
          <div className="text-[0.5625rem] font-mono uppercase tracking-widest text-on-surface-variant/50 mb-1">Repositories</div>
          <div className="flex gap-2 mb-1.5">
            <input
              type="text"
              value={repoInput}
              onChange={e => { setRepoInput(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && onAddRepo(repoInput, setRepoInput, setError)}
              placeholder="owner/repo"
              className="flex-1 bg-surface-container-high border-0 border-b-2 border-outline-variant text-on-surface placeholder:text-on-surface-variant/30 py-1.5 px-3 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={() => onAddRepo(repoInput, setRepoInput, setError)}
              className="px-2.5 py-1.5 bg-primary-container text-on-primary-container text-xs font-headline font-bold rounded hover:opacity-90 transition-opacity active:scale-95"
            >
              <span className="material-symbols-outlined !text-[1rem]">add</span>
            </button>
          </div>

          {error && (
            <p className="text-[0.625rem] text-error mb-1.5">{error}</p>
          )}

          <div className="flex flex-col gap-0.5">
            {account.repos.length === 0 && (
              <p className="text-[0.5625rem] text-on-surface-variant/40 py-1">No repositories tracked yet.</p>
            )}
            {account.repos.map(({ owner, repo }) => (
              <div
                key={`${owner}/${repo}`}
                className="flex items-center justify-between py-1 px-2 bg-surface-container hover:bg-surface-bright transition-colors group rounded"
              >
                <div className="flex items-center gap-2">
                  <div className="w-0.5 h-3.5 bg-primary/60 shrink-0" />
                  <span className="text-[0.8125rem] font-headline text-on-surface">{owner}/{repo}</span>
                </div>
                <button
                  onClick={() => onRemoveRepo(owner, repo)}
                  className="p-0.5 text-on-surface-variant/30 hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined !text-[0.875rem]">delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
