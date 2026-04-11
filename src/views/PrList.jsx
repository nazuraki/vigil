import { useEffect } from "react";
import PrCard from "../components/PrCard";
import { useGitHub } from "../hooks/useGitHub";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const isMac = isTauri && typeof navigator !== "undefined" && navigator.platform.startsWith("Mac");

async function openUrl(url) {
  if (isTauri) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank");
  }
}

async function openSettings() {
  if (!isTauri) {
    window.location.hash = "#settings";
    window.location.reload();
    return;
  }
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel("settings");
  if (existing) {
    await existing.setFocus();
    return;
  }
  const win = new WebviewWindow("settings", {
    url: "/",
    title: "Vigil — Settings",
    width: 460,
    height: 600,
    resizable: false,
    center: true,
    decorations: true,
    titleBarStyle: "overlay",
    hiddenTitle: true,
  });
  win.once("tauri://error", (e) => console.error("[settings window]", e));
}

export default function PrList() {
  const { prs, loading, error, lastSync, hasConfig, isStale, refresh, reload } = useGitHub();

  // Listen for config changes saved from the settings window
  useEffect(() => {
    if (!isTauri) return;
    let unlisten;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("config-updated", reload).then((fn) => {
        unlisten = fn;
      });
    });
    return () => {
      unlisten?.();
    };
  }, [reload]);

  const active = prs.filter((p) => p._ciStatus !== "failing").length;
  const alerts = prs.filter((p) => p._ciStatus === "failing").length;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header — data-tauri-drag-region makes it a drag handle for the window.
           On macOS with Overlay titlebar, pt-7 clears the traffic lights. */}
      <header
        data-tauri-drag-region
        className={`shrink-0 flex justify-between items-center px-4 border-b border-outline-variant/10 bg-background ${isMac ? "pt-7 pb-2.5" : "py-2.5"}`}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-primary material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            terminal
          </span>
          <h1 className="text-base font-bold tracking-tighter text-on-surface font-headline">
            Vigil
          </h1>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={`p-1.5 text-on-surface-variant hover:bg-surface-bright rounded transition-colors ${loading ? "animate-spin" : ""}`}
            onClick={refresh}
            title="Refresh"
          >
            <span className="material-symbols-outlined">sync</span>
          </button>
          <button
            type="button"
            className="p-1.5 text-on-surface-variant hover:bg-surface-bright rounded transition-colors"
            onClick={openSettings}
            title="Settings"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </header>

      {/* PR list */}
      <main className="flex-1 overflow-y-auto px-3 py-1.5 flex flex-col gap-1">
        {!hasConfig && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <span className="material-symbols-outlined text-4xl text-primary/40">terminal</span>
            <p className="text-on-surface-variant text-sm">No repositories configured.</p>
            <button
              type="button"
              className="text-[0.75rem] text-primary hover:text-on-primary-container transition-colors"
              onClick={openSettings}
            >
              Open settings →
            </button>
          </div>
        )}

        {hasConfig && !loading && prs.length === 0 && !error && !isStale && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">
              check_circle
            </span>
            <p className="text-on-surface-variant/60 text-xs">No open pull requests</p>
          </div>
        )}

        {error && (
          <div className="mx-1 mt-1 p-3 bg-error-container rounded text-error text-xs font-mono">
            ERROR: {error}
          </div>
        )}

        {(() => {
          const ownPrs = prs.filter((pr) => pr._isOwn);
          const otherPrs = prs.filter((pr) => !pr._isOwn);
          return (
            <>
              {ownPrs.map((pr) => (
                <PrCard key={`${pr._repoKey}#${pr.number}`} pr={pr} onOpen={openUrl} />
              ))}
              {ownPrs.length > 0 && otherPrs.length > 0 && (
                <div className="flex items-center gap-2 px-1 py-0.5">
                  <div className="flex-1 h-px bg-outline-variant/20" />
                  <span className="text-[0.5rem] font-mono text-on-surface-variant/30 uppercase tracking-widest">
                    others
                  </span>
                  <div className="flex-1 h-px bg-outline-variant/20" />
                </div>
              )}
              {otherPrs.map((pr) => (
                <PrCard key={`${pr._repoKey}#${pr.number}`} pr={pr} onOpen={openUrl} />
              ))}
            </>
          );
        })()}
      </main>

      {/* Status bar */}
      <footer className="shrink-0 px-4 py-1.5 flex justify-between items-center text-[0.625rem] font-mono text-on-surface-variant/50 border-t border-outline-variant/10 bg-surface">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>{active} ACTIVE</span>
          </div>
          {alerts > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-error" />
              <span>{alerts} ALERT</span>
            </div>
          )}
        </div>
        <span>
          {isStale && lastSync
            ? `stale · last synced ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : isStale
              ? "refresh failed"
              : lastSync
                ? `synced ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : loading
                  ? "syncing…"
                  : "—"}
        </span>
      </footer>
    </div>
  );
}
