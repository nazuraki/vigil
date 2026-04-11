import PrList from './views/PrList'
import Settings from './views/Settings'

// In Tauri 2, __TAURI_INTERNALS__.metadata.currentWebview.label is synchronous.
// Outside Tauri (Vite dev in browser), fall back to URL hash: /#settings
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const windowLabel = isTauri
  ? (/** @type {any} */ (window).__TAURI_INTERNALS__?.metadata?.currentWebview?.label ?? 'main')
  : (window.location.hash === '#settings' ? 'settings' : 'main')

export default function App() {
  return (
    <div className="bg-background text-on-surface font-body h-screen overflow-hidden select-none">
      {windowLabel === 'settings' ? <Settings /> : <PrList />}
    </div>
  )
}
