import type { CSSProperties } from 'react'
import type { BadgeTone } from '../atoms/Badge'
import { Badge } from '../atoms/Badge'
import type { EntityStatus } from '../atoms/entityStatus'

/** The domain vocabulary maps onto the shared badge tones — one rendering. */
const STATUS_STYLES: Record<EntityStatus, { label: string; tone: BadgeTone }> = {
  intact: { label: 'Intact', tone: 'ok' },
  damaged: { label: 'Damaged', tone: 'warn' },
  destroyed: { label: 'Destroyed', tone: 'bad' },
}

const CYCLE_BUTTON = { cursor: 'pointer', display: 'inline-flex' } satisfies CSSProperties

type StatusBadgeProps = {
  status: EntityStatus
  /** Cycle handler (Intact → Damaged → Destroyed → Intact) */
  onClick?: () => void
  /**
   * Entity name for the accessible label ("<subject> status: <Label>") so
   * multiple badges on one page get distinct accessible names. Without it
   * the label is the generic "Status: <Label>".
   */
  subject?: string
  className?: string
}

/**
 * Entity status badge (ruleset §5: a composition = Badge(tone) with the entity
 * condition vocabulary). Renders the one canonical badge; clickable when a cycle
 * handler is provided.
 */
export function StatusBadge({ status, onClick, subject, className }: StatusBadgeProps) {
  const { label, tone } = STATUS_STYLES[status]
  const badge = (
    <Badge surface="tone" tone={tone} className={className}>
      {label}
    </Badge>
  )
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={
          subject
            ? `${subject} status: ${label} — click to change`
            : `Status: ${label} — click to change`
        }
        style={CYCLE_BUTTON}
      >
        {badge}
      </button>
    )
  }
  return badge
}
