import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { CONDITION_LABELS } from 'salvageunion-reference'
import type { BadgeTone } from '../atoms/Badge'
import { Badge } from '../atoms/Badge'
import type { EntityStatus } from '../atoms/entityStatus'

/** The domain vocabulary maps onto the shared badge tones — one rendering. */
const STATUS_TONES: Record<EntityStatus, BadgeTone> = {
  intact: 'ok',
  damaged: 'warn',
  destroyed: 'bad',
}

/** The cycle the handler walks, so the label can name the state it leads to. */
const NEXT_STATUS: Record<EntityStatus, EntityStatus> = {
  intact: 'damaged',
  damaged: 'destroyed',
  destroyed: 'intact',
}

const CYCLE_BUTTON = { cursor: 'pointer', display: 'inline-flex' } satisfies CSSProperties

type StatusBadgeProps = {
  status: EntityStatus
  /** Cycle handler (Intact → Damaged → Destroyed → Intact) */
  onClick?: () => void
  /**
   * Entity name for the accessible label ("<subject> status: <Label>. Activate
   * to mark <Next>") so multiple badges on one page get distinct accessible
   * names. Without it the label opens with the generic "Status: <Label>".
   */
  subject?: string
  className?: string
}

/**
 * Entity status badge (ruleset §5: a composition = Badge(tone) with the entity
 * condition vocabulary). Renders the one canonical badge; clickable when a cycle
 * handler is provided. The clickable badge names the state activation leads to,
 * and announces the new state in a polite live region once the write lands —
 * the handler may be async, so the announcement waits for the `status` prop.
 */
export function StatusBadge({ status, onClick, subject, className }: StatusBadgeProps) {
  const label = CONDITION_LABELS[status]
  const tone = STATUS_TONES[status]
  const current = subject ? `${subject} status: ${label}` : `Status: ${label}`
  // Set on activation, consumed by the next status change: a change made
  // elsewhere (another device, a rule) is not announced as this control's.
  const awaitingWrite = useRef(false)
  const [announcement, setAnnouncement] = useState('')
  useEffect(() => {
    if (!awaitingWrite.current) return
    awaitingWrite.current = false
    setAnnouncement(current)
  }, [current])

  const badge = (
    <Badge surface="tone" tone={tone} className={className}>
      {label}
    </Badge>
  )
  if (onClick) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            awaitingWrite.current = true
            onClick()
          }}
          aria-label={`${current}. Activate to mark ${CONDITION_LABELS[NEXT_STATUS[status]]}`}
          style={CYCLE_BUTTON}
        >
          {badge}
        </button>
        <span role="status" aria-live="polite" className="su-sr-only">
          {announcement}
        </span>
      </>
    )
  }
  return badge
}
