import type { CSSProperties } from 'react'
import { color } from '../../design/tokens'
import type { trackSegmentState } from './pipRows'
import { segmentLit } from './pipRows'

/** VitalGauge's segment, on every rung: its fill by state, and its span. */

type SegmentState = ReturnType<typeof trackSegmentState>

/** An editable segment's static half; the hover lift is `.su-vital-gauge__pip`. */
const PIP_EDITABLE = {
  cursor: 'pointer',
  transitionProperty: 'transform, translate, scale, rotate',
  transitionDuration: 'var(--dur-base)',
  transitionTimingFunction: 'var(--ease)',
} satisfies CSSProperties

// An empty segment is paper, outlined.
const EMPTY_FILL = {
  borderColor: color.ink50,
  backgroundColor: color.paper,
} satisfies CSSProperties
// An unlit pip past the redline keeps the empty ground and takes the
// status-bad outline (boards D1, D4): the redline reads before the value
// reaches it — on the sheet and in Play alike, since both draw this gauge.
const REDLINE_FILL = {
  borderColor: color.statusBad,
  backgroundColor: color.paper,
} satisfies CSSProperties

function segFill(state: SegmentState): CSSProperties {
  return state === 'off'
    ? EMPTY_FILL
    : state === 'redline'
      ? REDLINE_FILL
      : state === 'danger'
        ? { borderColor: color.statusBad, backgroundColor: color.statusBad }
        : { borderColor: 'var(--tone-deep)', backgroundColor: 'var(--tone)' }
}

/**
 * Segment `index`: a plain span, or, on an editable track, a pointer-only one
 * the slider reads by `data-pip-index` (a slider's children are presentational).
 */
export function segment(
  index: number,
  state: SegmentState,
  base: CSSProperties,
  editable: boolean
) {
  const on = segmentLit(state)
  const style = { ...base, ...segFill(state) } satisfies CSSProperties
  return editable ? (
    <span
      key={index}
      data-pip={on ? 'on' : 'off'}
      data-pip-index={index}
      className="su-vital-gauge__pip"
      style={{ ...style, ...PIP_EDITABLE }}
    />
  ) : (
    <span key={index} data-pip={on ? 'on' : 'off'} style={style} />
  )
}
