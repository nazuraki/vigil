import { timeAgo } from '../utils/time'

const PRIORITY_BADGE = {
  0: { label: 'REVIEW',   cls: 'text-on-surface-variant' },
  1: { label: 'CHANGES',  cls: 'text-error' },
  2: { label: 'APPROVED', cls: 'text-primary' },
}

const BORDER = {
  failing: 'border-error',
  pending: 'border-primary/40',
  passing: 'border-primary',
  unknown: 'border-outline',
}

const CI_BADGE = {
  passing: { icon: 'check_circle', fill: true,  label: 'PASSED',  cls: 'text-primary' },
  failing: { icon: 'cancel',       fill: true,  label: 'FAILED',  cls: 'text-error' },
  pending: { icon: 'pending',      fill: true,  label: 'RUNNING', cls: 'text-on-surface-variant animate-pulse' },
  unknown: { icon: 'help',         fill: false, label: 'NO CI',   cls: 'text-on-surface-variant/40' },
}

export default function PrCard({ pr, onOpen }) {
  const { title, updated_at, draft, _repoKey, _ciStatus, _priority, _unresolvedComments } = pr
  const [owner, repo] = _repoKey.split('/')
  const isNew = (Date.now() - new Date(updated_at).getTime()) < 10 * 60 * 1000
  const border = BORDER[_ciStatus] ?? BORDER.unknown
  const badge  = CI_BADGE[_ciStatus] ?? CI_BADGE.unknown
  const priorityBadge = PRIORITY_BADGE[_priority]

  return (
    <div
      className={`group relative bg-surface hover:bg-surface-bright transition-all duration-150 p-3 rounded border-l-2 ${border} cursor-pointer`}
      onClick={() => onOpen(pr.html_url)}
    >
      {/* Repo label + new-update dot */}
      <div className="flex justify-between items-start">
        <span className="font-label text-[0.625rem] uppercase tracking-[0.1em] text-on-surface-variant font-medium truncate pr-2">
          {owner} / {repo}
          {draft && <span className="ml-1.5 text-on-surface-variant/40">[draft]</span>}
        </span>
        {isNew && (
          <div className="shrink-0 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(188,128,248,0.4)]" />
        )}
      </div>

      {/* PR title */}
      <h2 className="text-[0.875rem] font-semibold text-on-surface leading-snug line-clamp-2 mt-0.5 pr-2">
        {title}
      </h2>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-outline-variant/30">
        <div className="flex items-center gap-3">
          {/* CI status */}
          <div className={`flex items-center gap-1 text-[0.625rem] font-mono font-medium ${badge.cls}`}>
            <span
              className="material-symbols-outlined !text-[0.75rem]"
              style={badge.fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {badge.icon}
            </span>
            <span>{badge.label}</span>
          </div>

          {/* Priority */}
          {priorityBadge && (
            <span className={`text-[0.625rem] font-mono font-medium ${priorityBadge.cls}`}>
              {priorityBadge.label}
            </span>
          )}

          {/* Unresolved comments */}
          {_unresolvedComments > 0 && (
            <div className="flex items-center gap-0.5 text-error/70">
              <span className="material-symbols-outlined !text-[0.75rem]">chat_bubble</span>
              <span className="text-[0.625rem]">{_unresolvedComments}</span>
            </div>
          )}
        </div>

        <span className="text-[0.625rem] text-on-surface-variant/50 shrink-0">{timeAgo(updated_at)}</span>
      </div>
    </div>
  )
}
