import type { ReactNode } from 'react'
import { Fragment } from 'react'
import { cn } from '../../utils/cn'
import type { ReferenceEntityControl } from '../referenceEntity/referenceEntityControlTypes'
import { ControlButtons } from './ControlButtons'

type CardControlRailProps = {
  /** Every card affordance — action buttons and the typed item variants
   * (stepper / badge / status / link). */
  controls?: ReferenceEntityControl[]
  /** Compact geometry for the BUTTONS (smaller squares); the rail's own
   * position is the same at every density — see below. */
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
 * The rail rides the card's top-RIGHT corner (`right-2` + `justify-end`),
 * CENTRED on the frame line (`top-0 -translate-y-1/2`) at every density — the
 * StampSeam signature, half above the border and half over it. The non-compact
 * case used a bare `-mt-2` on an absolutely-positioned element, which has no
 * `top` to resolve against, so the rail floated clear of the card and sat on
 * the page above it instead of riding the edge. It
 * was briefly centred (`left-1/2 -translate-x-1/2` + `justify-center`); centring
 * put the controls over the card's title, which is the one thing a reader scans
 * a collapsed listing for, so they are back in the corner they came from.
 *
 * Position has no bearing on overflow either way: containment comes from
 * `flex-wrap` + `max-w-[calc(100%-1rem)]`, which cap the row at the card width
 * minus a 0.5rem gutter and wrap a crowded rail (status seal + selection seal +
 * count seal + three controls) onto stacked, equal-height lines rather than
 * letting it escape the frame. `justify` only aligns those wrapped lines INSIDE
 * that capped box. Cell ORDER is unchanged: `status` stays the first child, so a
 * card carrying both a condition and a selection seal keeps the condition
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
        'absolute right-2 top-0 z-30 flex max-w-[calc(100%-1rem)] -translate-y-1/2 flex-wrap items-center justify-end gap-1.5'
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
