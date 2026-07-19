import type { SVGProps } from 'react'

export type GlyphName =
  | 'gear'
  | 'clock'
  | 'pennant'
  | 'x'
  // Stroked control glyphs — the edit-language affordances (see STROKE below).
  | 'pencil'
  | 'check'
  | 'plus'
  | 'remove'
  | 'swap'

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
  // action-type · gear / cog (system / turn action) — centred at (12,12)
  gear: 'M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.39 1.06.73 1.69.98l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.98l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z',
  // action-type · clock (reaction / long action)
  clock:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7Z',
  // AP cost · pennant (a flag on a pole)
  pennant: 'M6 2h2v20H6V2Zm2 2h11l-3 4 3 4H8V4Z',
  // condition · ✕
  x: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',

  // ── Stroked control glyphs ────────────────────────────────────────────────
  // The live-sheet edit language (pencil / check / plus / remove / swap) is
  // drawn as STROKES, not fills — a filled pencil outline renders as a blob.
  // Their weights live in STROKE below; absent from it means "fill".
  pencil: 'm16.5 3.5 4 4L7 21H3v-4z',
  check: 'm5.5 12.5 4 4 9-10',
  plus: 'M12 5v14M5 12h14',
  remove: 'm6 6 12 12M18 6 6 18',
  swap: 'M4 8h14M14.5 4.5 18 8l-3.5 3.5M20 16H6M9.5 12.5 6 16l3.5 3.5',
}

/**
 * Per-glyph stroke weight. A glyph listed here renders as an unfilled stroke at
 * this width; anything absent renders filled. The weights are carried over
 * verbatim from the hand-drawn icons these replaced, so the affordances keep
 * their exact optical weight.
 */
const STROKE: Partial<Record<GlyphName, number>> = {
  pencil: 2,
  check: 2.4,
  plus: 3,
  remove: 2.2,
  swap: 2.2,
}

/**
 * Glyph — the shared icon set (ruleset §5, atom 11): action-type (gear / clock),
 * the AP pennant, and the condition ✕. Every glyph is `currentColor` at `1em`,
 * so it takes its colour and scale from the surrounding text (rust in an action
 * context, ink in a label). CSP-safe inline SVG — no sprite, no external asset.
 */
export function Glyph({ name, title, ...rest }: GlyphProps) {
  const decorative = title === undefined
  const strokeWidth = STROKE[name]
  const stroked = strokeWidth !== undefined
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill={stroked ? 'none' : 'currentColor'}
      stroke={stroked ? 'currentColor' : undefined}
      strokeWidth={strokeWidth}
      strokeLinecap={stroked ? 'round' : undefined}
      strokeLinejoin={stroked ? 'round' : undefined}
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
