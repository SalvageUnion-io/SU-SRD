import type { CSSProperties } from 'react'
import { color, fontSize } from '../../../design/tokens'

/** The lead: three lines of ink-2 prose, clamped with "…". */
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

/**
 * LEAD (E11) — the entity's opening prose, while browsing only. The full text
 * rides a native tooltip, unless its card Peeks (`peeks`): the Peek already
 * shows the whole entry, and the two must not open together.
 */
export function Lead({ text, peeks = false }: { text: string; peeks?: boolean }) {
  return (
    <p className="su-entity-lead" style={LEAD} title={peeks ? undefined : text}>
      {text}
    </p>
  )
}
