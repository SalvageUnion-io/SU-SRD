import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Badge } from './Badge'

type StampEmptyStateProps = {
  /** Default 'stamp' — the dashed, stamp-headlined empty slot. */
  variant?: 'stamp'
  /** The stamp headline (ruleset: "stamp voice"). */
  headline: string
  /** Explainer line under the headline. */
  body?: ReactNode
  /** A single rust action (usually a primary Button). */
  action?: ReactNode
  icon?: never
  className?: string
}

type QuietEmptyStateProps = {
  /**
   * 'quiet' — the muted app-chrome placeholder (absorbed from `Panel`'s
   * retired `Empty` sub-component): centered, faint dashed frame, decorative
   * glyph, no stamp headline.
   */
  variant: 'quiet'
  headline?: never
  /** The muted message line. */
  body: ReactNode
  /** Decorative glyph above the message (e.g. an entity-tone lucide icon). */
  icon?: ReactNode
  /** CTA slot (usually a primary sm Button). */
  action?: ReactNode
  className?: string
}

type EmptyStateProps = StampEmptyStateProps | QuietEmptyStateProps

/**
 * EmptyState — the one empty-slot primitive (ruleset §"Empty state").
 *
 * Default ('stamp'): a **dashed** off-white panel (`dashed = fillable`), a
 * **Stamp** headline ("stamp voice"), an explainer, and **one rust action** —
 * **left-aligned**. Replaces ad-hoc muted-grey paragraphs.
 *
 * 'quiet': the muted app-chrome placeholder (design-spec §2.10 `.empty`,
 * formerly `Panel`'s `Empty`): 1.5px dashed faint frame, centered muted
 * message + CTA, with an optional decorative glyph on top.
 */
export function EmptyState({
  variant = 'stamp',
  headline,
  body,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const quiet = variant === 'quiet'
  return (
    <div
      className={cn(
        'flex flex-col rounded-card border-chrome border-dashed',
        quiet
          ? 'items-center justify-center gap-3.5 border-wk-faint p-6 text-center'
          : 'items-start gap-3 border-ink/40 bg-paper p-4 text-left',
        className
      )}
    >
      {quiet ? (
        icon && (
          <span aria-hidden="true" className="flex items-center justify-center">
            {icon}
          </span>
        )
      ) : (
        <Badge shape="stamp" size="mini">
          {headline}
        </Badge>
      )}
      {body && <p className="font-body text-caption text-wk-muted">{body}</p>}
      {action}
    </div>
  )
}
