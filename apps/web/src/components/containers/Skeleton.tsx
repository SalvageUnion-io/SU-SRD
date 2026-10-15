import type { CSSProperties } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'
import { Ghost } from '../atoms/Ghost'

/** The body's ghost lines: the last runs short, the rest alternate full / 80%. */
const BODY_LINES = ['100%', '80%', '60%']

const CARD = {
  overflow: 'hidden',
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.pill,
  borderColor: color.ink15,
  backgroundColor: color.paper,
} satisfies CSSProperties

const CARD_BAND = {
  display: 'flex',
  alignItems: 'center',
  gap: space[8],
  backgroundColor: color.ink10,
  minHeight: '60px',
  padding: `${space[8]} ${space[12]}`,
} satisfies CSSProperties

const CARD_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  padding: space[8],
} satisfies CSSProperties

/**
 * Skeleton — the generic loading placeholder (ruleset §"Skeleton").
 *
 * Mirrors the compact (medium) card's anatomy (frame / band / body) with
 * **ink-alpha ghosts on off-white**, so the loaded card drops in with **zero
 * layout shift**. The pulse is `.su-pulse`, which a reduced-motion reader
 * never sees.
 */
export function Skeleton() {
  return (
    <div role="status" aria-label="Loading" className="su-pulse" style={CARD}>
      <div style={CARD_BAND}>
        <Ghost style={{ width: '40%', height: space[16], backgroundColor: color.ink20 }} />
        <Ghost style={{ width: '25%', height: space[12], backgroundColor: color.ink15 }} />
      </div>
      <div style={CARD_BODY}>
        {BODY_LINES.map((width) => (
          <Ghost key={width} style={{ height: space[12], width }} />
        ))}
      </div>
    </div>
  )
}
