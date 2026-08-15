import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space, tracking } from '../design/tokens'

/**
 * Shared Ladle story helpers.
 *
 * Every story renders on a global paper canvas provided by `.ladle/components.tsx`,
 * so a story does not need its own outer paper wrapper. When a caption/frame
 * helper would otherwise be copy-pasted across story files, put it here and
 * import it instead of re-declaring it per file.
 *
 * Migrated off Tailwind in #799 (epic #802): every value below is read from
 * `design/tokens.ts` rather than spelled as a utility class, so these helpers
 * cannot drift from the scale they are captioning.
 */

/** A small caps caption above a demo cluster — the workshop-muted label. */
const captionStyle = {
  color: color.wkMuted,
  fontFamily: font.cond,
  fontSize: fontSize.label,
  letterSpacing: tracking.caps,
  marginBottom: space[4],
  textTransform: 'uppercase',
} satisfies CSSProperties

export function Caption({ children }: { children: ReactNode }) {
  return <div style={captionStyle}>{children}</div>
}
