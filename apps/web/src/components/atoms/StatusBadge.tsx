import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { CONDITION_LABELS } from 'salvageunion-reference'
import type { BadgeTone } from './Badge'
import { Badge } from './Badge'
import type { EntityStatus } from './entityStatus'

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
  /**
   * The state activation leads to, where the handler walks a shorter cycle
   * than the three (a crawler bay: Intact ↔ Damaged). Defaults to the next of
   * Intact → Damaged → Destroyed.
   */
  next?: EntityStatus
}

/**
 * CONDITION — the one rendering of an entity's condition (ruleset §2.3, §5.9:
 * an atom, Badge(tone) in the condition vocabulary): in a strip it is the chip
 * group's state slot (`chips-and-actions.md` C8), a card's, a Row's or a sheet
 * item's alike. Clickable when a cycle handler is provided: it names the state
 * activation leads to, and announces the new state in a polite live region once
 * the write lands — the handler may be async, so the announcement waits for the
 * `status` prop.
 */
export function StatusBadge({ status, onClick, subject, next }: StatusBadgeProps) {
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
    <Badge surface="tone" tone={tone}>
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
          aria-label={`${current}. Activate to mark ${CONDITION_LABELS[next ?? NEXT_STATUS[status]]}`}
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
