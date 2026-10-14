import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../../design/tokens'
import { cn } from '../../utils/cn'
import { capsLabel } from './capsLabel'

type ModeDoorProps = {
  /**
   * `guided` — the filled-tone primary in a solid ink frame.
   * `blank` — the dashed paper escape hatch. Default `guided`.
   */
  variant?: 'guided' | 'blank'
  /** Overhanging notched ink tab content — a glyph char (▶ / ✎) or a Glyph node. */
  tab: ReactNode
  headline: string
  /** Body copy. */
  children: ReactNode
  cite?: ReactNode
  onSelect?: () => void
  className?: string
}

/**
 * The door's static frame: flat on the page like every card, the card radius
 * and no shadow (ruleset §3.5, §4.4). Its focus ring is `.su-mode-door`'s, as
 * a `:focus-visible` rule cannot be inline.
 */
const DOOR = {
  borderRadius: radius.card,
  cursor: 'pointer',
  minHeight: '170px',
  paddingBottom: space[20],
  paddingLeft: '26px',
  paddingRight: '22px',
  paddingTop: '22px',
  position: 'relative',
  textAlign: 'left',
} satisfies CSSProperties

/** guided emphasis: a 3px solid ink frame, the full card's weight.
 *  The plate fills with the sheet's text band and prints its foreground —
 *  the `onTone` rule as `.sheet--*` sets it (`--tone-band` / `--on-tone-band`
 *  in theme.css). Paper on the bare tone measured 2.4:1 on pilot, and ink
 *  4.17:1 on crawler pink. Headline, body and cite all inherit the colour. */
const GUIDED = {
  background: 'var(--tone-band)',
  borderColor: color.ink,
  borderStyle: 'solid',
  borderWidth: borderWidth.entity,
  color: 'var(--on-tone-band)',
} satisfies CSSProperties

const BLANK = {
  backgroundColor: color.paper,
  borderColor: color.ink50,
  borderStyle: 'dashed',
  borderWidth: borderWidth.entity,
  color: color.ink,
} satisfies CSSProperties

const TAB = {
  backgroundColor: color.ink,
  borderRadius: radius.badge,
  color: color.paper,
  display: 'grid',
  fontFamily: font.cond,
  fontSize: fontSize.title,
  fontWeight: weight.bold,
  height: space[48],
  left: `-${space[14]}`,
  placeItems: 'center',
  position: 'absolute',
  top: '18px',
  width: '44px',
} satisfies CSSProperties

const HEAD = capsLabel({ size: 'display' })

const HEAD_STYLE = {
  display: 'block',
  lineHeight: 1,
  marginBottom: space[6],
  marginLeft: '34px',
} satisfies CSSProperties

const BODY = {
  display: 'block',
  fontFamily: font.body,
  fontSize: fontSize.caption,
  lineHeight: 1.55,
  marginLeft: '34px',
} satisfies CSSProperties

const CITE = {
  display: 'block',
  fontFamily: font.body,
  fontSize: fontSize.caption,
  fontWeight: weight.bold,
  marginLeft: '34px',
  marginTop: space[10],
} satisfies CSSProperties

/**
 * ModeDoor — the onboarding "choose how to create" poster card (mockup `.door`,
 * design handoff): a large selectable path-card with a notched ink tab
 * overhanging the left edge, a condensed-caps headline, body copy, and an
 * optional citation. `guided` is the filled-tone primary; `blank` is the dashed
 * paper escape hatch. Extracted from the copy duplicated verbatim across
 * `CreateModeChooser` + `NewEntityScreen`.
 */
export function ModeDoor({
  variant = 'guided',
  tab,
  headline,
  children,
  cite,
  onSelect,
  className,
}: ModeDoorProps) {
  const guided = variant === 'guided'
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn('su-mode-door', `su-mode-door--${variant}`, className)}
      style={{ ...DOOR, ...(guided ? GUIDED : BLANK) }}
    >
      <span style={TAB} aria-hidden="true">
        {tab}
      </span>
      <span className={HEAD} style={HEAD_STYLE}>
        {headline}
      </span>
      <span style={BODY}>{children}</span>
      {cite && <span style={CITE}>{cite}</span>}
    </button>
  )
}
