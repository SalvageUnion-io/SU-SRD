import type { SVGProps } from 'react'

type GlyphName = 'plus'

type GlyphProps = {
  name: GlyphName
} & Omit<SVGProps<SVGSVGElement>, 'name' | 'children'>

/**
 * `currentColor` paths for {@link Glyph} (viewBox `0 0 24 24`) — clean,
 * well-formed geometry so the set is CSP-safe inline SVG and homebrew-safe.
 * The edit-language affordances are drawn as STROKES, not fills.
 */
const PATHS: Record<GlyphName, string> = {
  plus: 'M12 5v14M5 12h14',
}

/**
 * Per-glyph stroke weight, carried over verbatim from the hand-drawn icon this
 * replaced, so the affordance keeps its exact optical weight.
 */
const STROKE: Record<GlyphName, number> = {
  plus: 3,
}

/**
 * Glyph — the shared icon set (ruleset §5, atom 11): the sheet's `+` add mark.
 * Every glyph is a decorative `currentColor` stroke at `1em`, so it takes its
 * colour and scale from the surrounding text. CSP-safe inline SVG — no sprite,
 * no external asset.
 */
export function Glyph({ name, ...rest }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE[name]}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
