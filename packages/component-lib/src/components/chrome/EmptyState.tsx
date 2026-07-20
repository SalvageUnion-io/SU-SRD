import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Badge } from './Badge'

type EmptyStateProps = {
  /** The stamp headline (ruleset: "stamp voice"). */
  headline: string
  /** Explainer line under the headline. */
  body?: ReactNode
  /** A single rust action (usually a primary Button). */
  action?: ReactNode
  className?: string
}

/**
 * EmptyState — the one empty-slot primitive (ruleset §"Empty state").
 *
 * A **dashed** off-white panel (`dashed = fillable`), a **Stamp** headline
 * ("stamp voice"), an explainer, and **one rust action** — **left-aligned**.
 * Replaces ad-hoc muted-grey paragraphs; distinct from `Panel`'s centred
 * `Empty` (which is the muted app-chrome placeholder).
 */
export function EmptyState({ headline, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-card border-chrome border-dashed border-ink/40 bg-paper p-4 text-left',
        className
      )}
    >
      <Badge shape="stamp" size="mini">
        {headline}
      </Badge>
      {body && <p className="font-body text-caption text-wk-muted">{body}</p>}
      {action}
    </div>
  )
}
