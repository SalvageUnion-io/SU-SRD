import type { SVGProps } from 'react'

export type GlyphName = 'gear' | 'clock' | 'pennant' | 'x'

type GlyphProps = {
  name: GlyphName
  /** Accessible label. Omit (default) to render decorative / aria-hidden. */
  title?: string
} & Omit<SVGProps<SVGSVGElement>, 'name' | 'children'>

/**
 * `currentColor` paths for {@link Glyph} (viewBox `0 0 24 24`) — clean,
 * well-formed geometry so the set is CSP-safe inline SVG and homebrew-safe.
 */
const PATHS: Record<GlyphName, string> = {
  // action-type · gear / cog (system / turn action)
  gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.48.48 0 0 0 13.4 2h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L1.8 8.47a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94 0 .32.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58ZM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2Z',
  // action-type · clock (reaction / long action)
  clock:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7Z',
  // AP cost · pennant (a flag on a pole)
  pennant: 'M6 2h2v20H6V2Zm2 2h11l-3 4 3 4H8V4Z',
  // condition · ✕
  x: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
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
      viewBox="0 0 24 24"
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
