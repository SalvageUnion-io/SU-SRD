import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../../design/tokens'
import { capsLabel } from './capsLabel'
import { FOCUS_RING } from './interaction'

type ModeDoorProps = {
  /**
   * `guided` — the filled-tone primary with a permanent double-ink halo.
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
 * The door's static frame. Its transition and hover lift are `.su-mode-door`
 * (a `:hover` rule cannot be inline).
 *
 * The halo and drop shadows ARE inline, deliberately: on the Tailwind build
 * they were `shadow-[…]` utilities, which out-ranked `.su-focus-ring`'s
 * `:focus-visible` box-shadow (layer `utilities` over `su-base`), and inline
 * keeps that precedence exactly.
 */
const DOOR = {
  borderRadius: '0.75rem',
  cursor: 'pointer',
  minHeight: '170px',
  paddingBottom: space[20],
  paddingLeft: '26px',
  paddingRight: '22px',
  paddingTop: '22px',
  position: 'relative',
  textAlign: 'left',
} satisfies CSSProperties

/** guided emphasis: a ground gap, a 3px ink ring, then a soft drop shadow.
 *  The plate always fills with the surrounding surface tone. */
const GUIDED = {
  background: 'var(--tone)',
  boxShadow:
    '0 0 0 3px var(--ground), 0 0 0 7px var(--color-ink), 0 18px 30px -14px var(--color-ink-50)',
} satisfies CSSProperties

const BLANK = {
  backgroundColor: color.paper,
  borderColor: color.ink50,
  borderStyle: 'dashed',
  borderWidth: borderWidth.entity,
  boxShadow: '0 14px 26px -14px var(--color-ink-40)',
  color: color.ink,
} satisfies CSSProperties

const TAB = {
  backgroundColor: color.ink,
  borderRadius: radius.badge,
  boxShadow: '0 8px 14px -8px var(--color-ink-50)',
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
  color: color.ink,
  display: 'block',
  fontFamily: font.body,
  fontSize: fontSize.caption,
  lineHeight: 1.55,
  marginLeft: '34px',
} satisfies CSSProperties

const CITE = {
  color: color.ink,
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
      className={`su-mode-door ${FOCUS_RING}${className ? ` ${className}` : ''}`}
      style={{ ...DOOR, ...(guided ? GUIDED : BLANK) }}
    >
      <span style={TAB} aria-hidden="true">
        {tab}
      </span>
      <span
        className={HEAD}
        style={
          guided
            ? { ...HEAD_STYLE, color: color.paper, textShadow: '0 1px 0 var(--color-ink-40)' }
            : { ...HEAD_STYLE, color: color.ink }
        }
      >
        {headline}
      </span>
      <span style={BODY}>{children}</span>
      {cite && <span style={CITE}>{cite}</span>}
    </button>
  )
}
