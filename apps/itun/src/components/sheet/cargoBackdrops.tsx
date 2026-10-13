/**
 * The Hold's two SVG backdrops: the BULK marker's hazard stripes and the
 * crawler Hold's graph paper. Flat repeating patterns are SVG, never gradient
 * fills (ruleset §3.5 — no gradients, anywhere).
 */

import { tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useId } from 'react'

/** An SVG backdrop filling its positioned parent. */
const BACKDROP = {
  pointerEvents: 'none',
  position: 'absolute',
  inset: 0,
  height: '100%',
  width: '100%',
} satisfies CSSProperties

/**
 * Diagonal cargo hazard stripes for the BULK marker cell — the poster's
 * repeating-gradient fill rebuilt as an SVG pattern. Flat repeating patterns
 * are SVG, never gradient fills (ruleset §3.5 — no gradients, anywhere).
 */
export function HazardStripes() {
  const id = useId()
  return (
    <svg aria-hidden="true" style={BACKDROP}>
      <defs>
        <pattern
          id={id}
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="10" height="10" fill={tokens.color.cargo} />
          <rect x="5" width="5" height="10" fill={tokens.color.cargoDeep} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/**
 * The crawler Hold's poster `.storebody` graph-paper backdrop — a 34px
 * tone-tinted grid, rebuilt as an SVG pattern for the same §3.5 reason.
 */
export function GraphPaper() {
  const id = useId()
  const line = { fill: 'color-mix(in srgb, var(--tone) 16%, transparent)' }
  return (
    <svg aria-hidden="true" style={BACKDROP}>
      <defs>
        <pattern id={id} width="34" height="34" patternUnits="userSpaceOnUse">
          <rect width="34" height="1" style={line} />
          <rect width="1" height="34" style={line} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
