import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'

type KvRowProps = {
  /** Fixed-rail uppercase micro-label. */
  label: ReactNode
  /** Value cell. Empty (`null` / `undefined` / `''`) renders the muted "required" placeholder. */
  value?: ReactNode
}

/** The bottom rule's colour and style; its WIDTH lives in `.su-kv-row`, which
 * zeroes it on the last row. */
const ROOT = {
  alignItems: 'baseline',
  borderBottomColor: color.wkFaint,
  borderBottomStyle: 'solid',
  display: 'flex',
  gap: space[12],
  paddingBlock: space[8],
} satisfies CSSProperties

const LABEL = {
  color: color.wkMuted,
  flexShrink: 0,
  fontFamily: font.cond,
  fontSize: fontSize.xs,
  fontWeight: weight.bold,
  letterSpacing: tracking.caps,
  lineHeight: 1.25,
  textTransform: 'uppercase',
  width: '120px',
} satisfies CSSProperties

const VALUE = {
  flex: '1 1 0%',
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  minWidth: 0,
} satisfies CSSProperties

/**
 * KvRow — the review-recap definition row (design-spec §2.10): a fixed 120px
 * uppercase micro-label rail + value cell, bottom-ruled and self-clearing on the
 * last row (`.su-kv-row`). An empty value renders a muted "required"
 * placeholder — muted ink, not rust: rust is the ACTION colour (ruleset §3.1)
 * and this is read-only text. Distinct from `Panel`'s `Row` (name / meta /
 * actions) and `Field` (form label + control) — this is a read-only summary
 * line, the shape the pilot / mech / crawler Review steps each hand-rolled.
 */
export function KvRow({ label, value }: KvRowProps) {
  const empty = value === null || value === undefined || value === ''
  return (
    <div className="su-kv-row" style={ROOT}>
      <span style={LABEL}>{label}</span>
      <span style={{ ...VALUE, color: empty ? color.ink50 : color.ink }}>
        {empty ? 'required' : value}
      </span>
    </div>
  )
}
