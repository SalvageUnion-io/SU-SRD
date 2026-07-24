import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { ControlButtons } from './ControlButtons'
import type { ReferenceEntityControl } from '../referenceEntity/referenceEntityControlTypes'

type CardControlRailProps = {
  /** Every card affordance — action buttons and the typed item variants
   * (stepper / badge / status / link). */
  controls?: ReferenceEntityControl[]
  /** Compact geometry: the rail rides straddling the frame edge rather than
   * hanging above it. */
  compact?: boolean
  /** Extra nodes rendered between the status cell and the action cluster —
   * the entity card's selection and multi-select seals, which carry bespoke
   * tone styling the `controls` variants deliberately don't cover. Falsy
   * entries are dropped, so a caller can pass conditionals positionally. */
  seals?: ReactNode[]
}

/**
 * THE card control rail — ONE absolutely-positioned row, riding the card's
 * top-right frame edge, holding every seal and the action cluster so they sit
 * NEXT TO each other.
 *
 * This was two separate implementations. `Card` pinned a lone controls
 * cluster at `right-0` and rendered the condition badge somewhere else entirely
 * (inline, inside the header row), while `ReferenceEntityCard` grew the real
 * thing: a flex row collapsing the status seal, selection seal, count seal and
 * controls into one line, because any card carrying two of them had been
 * stacking them on top of one another at the same coordinate. Lifting the
 * entity card's version here gives both layers the working geometry, and gives
 * `status` exactly one rendering path — a `controls` entry — instead of two.
 *
 * The rail is pinned to the card's TOP-RIGHT corner (`right-2` +
 * `justify-end`). It briefly rode centred (`left-1/2 -translate-x-1/2` +
 * `justify-center`); that put the action cluster over the middle of the header
 * band, where it read as content rather than as chrome and crowded the title.
 * The corner is also the only free edge — the seam stamp owns the top-LEFT on
 * both shells (`Card`'s callout at `ml-3`, the entity card's at `left-[15px]`),
 * so a centred rail was drifting toward an occupied corner as it grew.
 *
 * Alignment is NOT what contains the rail: the containment comes from
 * `flex-wrap` + `max-w-[calc(100%-1rem)]`, which cap the row at the card width
 * minus a 0.5rem gutter and wrap a crowded rail (status seal + selection seal +
 * count seal + three controls) onto stacked, equal-height lines rather than
 * letting it escape the frame. `justify` only sets how those wrapped lines align
 * INSIDE that capped box, so the switch back to `justify-end` keeps the exact
 * same bound. Cell order is unchanged either way: `status` stays the first child
 * so a card carrying both a condition and a selection seal keeps the condition
 * leftmost within the row.
 */
export function CardControlRail({ controls, compact = false, seals }: CardControlRailProps) {
  const visible = (controls ?? []).filter((c) => !c.hidden)
  // Status rides the FIRST cell — ahead of the seals and the action cluster —
  // so a card carrying both a condition and a selection seal keeps the
  // condition leftmost, where it has always sat.
  const statusControls = visible.filter((c) => c.status)
  const actionControls = visible.filter((c) => !c.status)
  const visibleSeals = (seals ?? []).filter(Boolean)

  if (statusControls.length === 0 && actionControls.length === 0 && visibleSeals.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'absolute right-2 z-30 flex max-w-[calc(100%-1rem)] flex-wrap items-center justify-end gap-1.5',
        compact ? 'top-0 -translate-y-1/2' : '-mt-2'
      )}
    >
      {statusControls.length > 0 && <ControlButtons controls={statusControls} compact={compact} />}
      {visibleSeals.map((seal, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed positional rail (selection seal, then count seal) — the index IS the identity
        <Fragment key={i}>{seal}</Fragment>
      ))}
      {actionControls.length > 0 && <ControlButtons controls={actionControls} compact={compact} />}
    </div>
  )
}
