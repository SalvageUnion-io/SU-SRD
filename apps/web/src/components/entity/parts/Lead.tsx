import type { CSSProperties } from 'react'
import { color, fontSize } from '../../../design/tokens'

/** The lead: three lines of ink-2 prose, clamped with "…", the full text in a tooltip. */
const LEAD = {
  color: color.ink2,
  display: '-webkit-box',
  flexBasis: '100%',
  fontSize: fontSize.sm,
  lineHeight: 1.4,
  margin: 0,
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 3,
} satisfies CSSProperties

/** LEAD (E11) — the entity's opening prose, while browsing only. */
export function Lead({ text }: { text: string }) {
  return (
    <p className="su-entity-lead" style={LEAD} title={text}>
      {text}
    </p>
  )
}
