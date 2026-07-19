import { Badge } from '../components/chrome/Badge'
import { Panel } from '../components/chrome/Panel'
import { cn } from '../utils/cn'
import type { ChangelogEntry } from './parseChangelog'

type ChangelogProps = {
  entries: ChangelogEntry[]
  className?: string
}

function entryHeadline(entry: ChangelogEntry): string {
  if (entry.version) return `v${entry.version}`
  return entry.title ?? entry.date
}

/**
 * Presentational, data-source-agnostic changelog renderer. Each entry is a
 * paper panel with a headline (version or title), a muted date, an area badge,
 * and a semantic bullet list. Shared by both sites so they render identically.
 */
export function Changelog({ entries, className }: ChangelogProps) {
  if (entries.length === 0) {
    return (
      <p className={cn('font-body text-[13px] text-wk-muted', className)}>
        No changelog entries yet.
      </p>
    )
  }

  return (
    <ol className={cn('flex list-none flex-col gap-4', className)}>
      {entries.map((entry, index) => (
        <li key={`${entry.area}-${entry.date}-${entry.version ?? entry.title ?? index}`}>
          <Panel className="p-4">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-cond text-lg font-bold uppercase leading-tight tracking-[0.02em] text-ink">
                {entryHeadline(entry)}
              </h3>
              <Badge surface="outline" className="shrink-0">
                {entry.area}
              </Badge>
              <time
                dateTime={entry.date}
                className="ml-auto font-body text-xs text-wk-muted tabular-nums"
              >
                {entry.date}
              </time>
            </div>
            {entry.items.length > 0 && (
              <ul className="ml-4 list-disc space-y-1 font-body text-sm text-ink-2 marker:text-wk-muted">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </Panel>
        </li>
      ))}
    </ol>
  )
}
