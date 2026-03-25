import { useState, useEffect, useRef } from 'react'
import { loadConfig, saveConfig } from '../store'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const isMac   = isTauri && typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac')

const INTERVALS = [
  { label: '1m  (real-time)',    value: 60_000 },
  { label: '5m  (standard)',     value: 300_000 },
  { label: '15m (conservative)', value: 900_000 },
]

export default function Settings() {
  const [token,     setToken]     = useState('')
  const [repoInput, setRepoInput] = useState('')
  const [repos,     setRepos]     = useState([])
  const [interval,  setInterval]  = useState(300_000)
  const [saved,     setSaved]     = useState(false)
  const [isDirty,   setIsDirty]   = useState(false)
  const [error,     setError]     = useState('')
  const savedTimerRef = useRef(null)

  useEffect(() => {
    loadConfig().then(cfg => {
      setToken(cfg.token || '')
      setRepos(cfg.repos || [])
      setInterval(cfg.pollingInterval || 300_000)
    })
  }, [])

  // Auto-save 600ms after the last change; emit so main window refreshes
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(async () => {
      await saveConfig({ token, repos, pollingInterval: interval })
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
  }, [isDirty, token, repos, interval])

  function addRepo() {
    const input = repoInput.trim().replace(/^https?:\/\/github\.com\//, '')
    const parts = input.split('/')
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      setError('Enter as owner/repo')
      return
    }
    const owner = parts[0]
    const repo  = parts[1].replace(/\.git$/, '')
    if (repos.some(r => r.owner === owner && r.repo === repo)) {
      setError('Already tracked')
      return
    }
    setRepos(prev => [...prev, { owner, repo }])
    setRepoInput('')
    setError('')
    setIsDirty(true)
  }

  function removeRepo(owner, repo) {
    setRepos(prev => prev.filter(r => !(r.owner === owner && r.repo === repo)))
    setIsDirty(true)
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

        {/* GitHub Token */}
        <section>
          <label className="block text-[0.625rem] font-mono uppercase tracking-widest text-on-surface-variant mb-1.5">
            GitHub Token
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 !text-[1rem]">
              key
            </span>
            <input
              type="password"
              value={token}
              onChange={e => { setToken(e.target.value); setIsDirty(true) }}
              placeholder="ghp_••••••••••••••••••••"
              className="w-full bg-surface-container-high border-0 border-b-2 border-outline-variant text-on-surface placeholder:text-on-surface-variant/30 py-2 pl-9 pr-3 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <p className="mt-1 text-[0.625rem] text-on-surface-variant/40">
            Needs <span className="font-mono">repo</span> scope. Stored locally, never transmitted.
          </p>
        </section>

        {/* Tracked Repos */}
        <section>
          <label className="block text-[0.625rem] font-mono uppercase tracking-widest text-on-surface-variant mb-1.5">
            Tracked Repositories
          </label>

          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={repoInput}
              onChange={e => { setRepoInput(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && addRepo()}
              placeholder="owner/repo"
              className="flex-1 bg-surface-container-high border-0 border-b-2 border-outline-variant text-on-surface placeholder:text-on-surface-variant/30 py-1.5 px-3 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={addRepo}
              className="px-3 py-1.5 bg-primary-container text-on-primary-container text-xs font-headline font-bold rounded hover:opacity-90 transition-opacity active:scale-95"
            >
              <span className="material-symbols-outlined !text-[1rem]">add</span>
            </button>
          </div>

          {error && (
            <p className="text-[0.625rem] text-error mb-1.5">{error}</p>
          )}

          <div className="flex flex-col gap-0.5">
            {repos.length === 0 && (
              <p className="text-[0.625rem] text-on-surface-variant/40 py-1.5">No repositories tracked yet.</p>
            )}
            {repos.map(({ owner, repo }) => (
              <div
                key={`${owner}/${repo}`}
                className="flex items-center justify-between py-1.5 px-3 bg-surface-container-low hover:bg-surface-bright transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-0.5 h-4 bg-primary/60 shrink-0" />
                  <span className="text-sm font-headline text-on-surface">{owner}/{repo}</span>
                </div>
                <button
                  onClick={() => removeRepo(owner, repo)}
                  className="p-1 text-on-surface-variant/30 hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined !text-[1rem]">delete</span>
                </button>
              </div>
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
