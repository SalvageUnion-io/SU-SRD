import type { CSSProperties, ReactNode } from 'react'
import { Fragment } from 'react'
import { space } from '../../design/tokens'
import { ControlButtons } from '../compositions/ControlButtons'
import type { ReferenceEntityControl } from '../referenceEntity/referenceEntityControlTypes'

type CardControlRailProps = {
  /** Every card affordance — action buttons and the typed item variants
   * (stepper / badge / status / link). */
  controls?: ReferenceEntityControl[]
  /** Extra nodes rendered between the status cell and the action cluster —
   * the entity card's status and selection seals, which carry bespoke
   * tone styling the `controls` variants deliberately don't cover. Falsy
   * entries are dropped, so a caller can pass conditionals positionally. */
  seals?: ReactNode[]
}

const RAIL = {
  position: 'absolute',
  right: space[8],
  top: 0,
  // Local stacking (0–3, chrome K4): over the header band and any seam stamp.
  zIndex: 3,
  display: 'flex',
  maxWidth: 'calc(100% - 1rem)',
  translate: '0 -50%',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: space[6],
} satisfies CSSProperties

/**
 * THE card control rail — ONE absolutely-positioned row, riding the card's
 * top-right frame edge, holding every seal and the action cluster so they sit
 * NEXT TO each other.
 *
 * Both card layers (`Card` and `ReferenceEntityCard`) render through it, so the
 * status seal, selection seal, count seal and controls share one line instead
 * of stacking at the same coordinate, and `status` has exactly one rendering
 * path: a `controls` entry.
 *
 * The rail rides the card's top-RIGHT corner (`right: 8px` + `justify-content: flex-end`),
 * CENTRED on the frame line (`top: 0` + `translate: 0 -50%`) at every density — the
 * StampSeam signature, half above the border and half over it. The corner
 * keeps the controls off the card's title, which is the one thing a reader
 * scans a collapsed listing for.
 *
 * Position has no bearing on overflow either way: containment comes from
 * `flex-wrap` + `max-width: calc(100% - 1rem)`, which cap the row at the card width
 * minus a 0.5rem gutter and wrap a crowded rail (status seal + selection seal +
 * count seal + three controls) onto stacked, equal-height lines rather than
 * letting it escape the frame. `justify` only aligns those wrapped lines INSIDE
 * that capped box. Cell ORDER is unchanged: `status` stays the first child, so a
 * card carrying both a condition and a selection seal keeps the condition
 * leftmost within the row.
 */
export function CardControlRail({ controls, seals }: CardControlRailProps) {
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
    <div data-card-rail="" style={RAIL}>
      {statusControls.length > 0 && <ControlButtons controls={statusControls} />}
      {visibleSeals.map((seal, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed positional rail (selection seal, then count seal) — the index IS the identity
        <Fragment key={i}>{seal}</Fragment>
      ))}
      {actionControls.length > 0 && <ControlButtons controls={actionControls} />}
    </div>
  )
}
