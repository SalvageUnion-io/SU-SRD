import type { SVGProps } from 'react'

export type GlyphName = 'gear' | 'clock' | 'pennant' | 'x'

type GlyphProps = {
  name: GlyphName
  /** Accessible label. Omit (default) to render decorative / aria-hidden. */
  title?: string
} & Omit<SVGProps<SVGSVGElement>, 'name' | 'children'>

/**
 * Hand-drawn `currentColor` paths for {@link Glyph}. Kept as bare `<path>` data
 * (viewBox `0 0 16 16`) so the set is CSP-safe inline SVG and homebrew-safe.
 */
const PATHS: Record<GlyphName, string> = {
  // action-type · gear (system / turn action)
  gear: 'M8 5.2A2.8 2.8 0 1 0 8 10.8 2.8 2.8 0 0 0 8 5.2Zm6.2 3.6.1-.8-.1-.8 1.4-1.1-1-1.7-1.7.5a5.6 5.6 0 0 0-1.4-.8L11.2.8h-2l-.3 1.8a5.6 5.6 0 0 0-1.4.8l-1.7-.5-1 1.7L6.2 5.6a5.6 5.6 0 0 0 0 1.6L4.8 8.3l1 1.7 1.7-.5c.4.3.9.6 1.4.8l.3 1.8h2l.3-1.8c.5-.2 1-.5 1.4-.8l1.7.5 1-1.7-1.4-1.1Z',
  // action-type · clock (reaction / long action)
  clock:
    'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 11.7A5.2 5.2 0 1 1 8 2.8a5.2 5.2 0 0 1 0 10.4ZM8.65 4.5h-1.3v4l3.35 2 .65-1.07-2.7-1.6V4.5Z',
  // AP cost · pennant (a clipped flag)
  pennant: 'M3.5 1.5h9l-2.2 3 2.2 3h-9V1.5Zm0 7h9v6l-4.5-2.2L3.5 14.5v-6Z',
  // condition · ✕
  x: 'M12.4 4.5 11.5 3.6 8 7.1 4.5 3.6l-.9.9L7.1 8l-3.5 3.5.9.9L8 8.9l3.5 3.5.9-.9L8.9 8l3.5-3.5Z',
}

/**
 * Glyph — the shared icon set (ruleset §5, atom 11): action-type (gear / clock),
 * the AP pennant, and the condition ✕. Every glyph is `currentColor` at `1em`,
 * so it takes its colour and scale from the surrounding text (rust in an action
 * context, ink in a label). CSP-safe inline SVG — no sprite, no external asset.
 */
export function Glyph({ name, title, ...rest }: GlyphProps) {
  const decorative = title === undefined
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="currentColor"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={title}
      focusable="false"
      {...rest}
    >
      {!decorative && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  )
}
