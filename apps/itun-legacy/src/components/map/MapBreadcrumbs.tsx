import { ChevronRight } from 'lucide-react'
import type { BreadcrumbEntry } from './mapTypes'

type MapBreadcrumbsProps = {
  breadcrumbs: BreadcrumbEntry[]
  onNavigate: (entry: BreadcrumbEntry) => void
}

export function MapBreadcrumbs({ breadcrumbs, onNavigate }: MapBreadcrumbsProps) {
  if (breadcrumbs.length <= 1) return null

  return (
    <nav className="flex items-center gap-1 font-mono text-xs text-su-white/60">
      {breadcrumbs.map((entry, i) => {
        const isLast = i === breadcrumbs.length - 1
        return (
          <span key={`${entry.tier}-${entry.parentZoneId}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            {isLast ? (
              <span className="text-su-white/90">{entry.label}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(entry)}
                className="underline underline-offset-2 hover:text-su-white"
              >
                {entry.label}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
