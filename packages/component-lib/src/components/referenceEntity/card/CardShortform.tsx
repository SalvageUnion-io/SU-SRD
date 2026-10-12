import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, radius, space, tracking, weight } from '../../../design/tokens'
import { Stat } from '../../shared/Stat'
import type { CardOuterProps } from './CardOuter'
import { CardOuter } from './CardOuter'
import { USER_MADE_TITLE } from './cardChrome'

/** One `[label | value]` cell trailing the name. */
export type ShortformTail = { label: string; value?: string }

const pill: CSSProperties = {
  alignItems: 'center',
  alignSelf: 'flex-start',
  borderRadius: 'var(--radius-card)',
  display: 'inline-flex',
  fontFamily: font.cond,
  fontSize: fontSize.caption,
  fontWeight: weight.bold,
  gap: space[6],
  letterSpacing: tracking.capsTight,
  lineHeight: 1.2,
  maxWidth: '100%',
  overflow: 'hidden',
  padding: `3px ${space[6]} 3px ${space[4]}`,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

/** Read by assistive tech only: the dashes are the pill's only visual user-made cue. */
const VISUALLY_HIDDEN: CSSProperties = {
  border: 0,
  clip: 'rect(0, 0, 0, 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
}

const NAME: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  overflowWrap: 'break-word',
  whiteSpace: 'normal',
}

const stamp = (onInk: boolean): CSSProperties => ({
  backgroundColor: 'var(--color-ink)',
  border: `var(--bw-hairline) solid ${onInk ? 'var(--color-paper)' : 'var(--color-ink)'}`,
  color: 'var(--color-paper)',
  flex: 'none',
  fontSize: fontSize.badge,
  letterSpacing: tracking.capsSnug,
  padding: `1px ${space[4]}`,
})

/** The name's own paper ground, on a tone that cannot carry text. */
const NAME_ON_PAPER: CSSProperties = {
  backgroundColor: color.paper,
  borderRadius: radius.badge,
  color: color.ink,
  padding: `0 ${space[4]}`,
}

/**
 * The SHORTFORM (`size="small" extent="head"`, board E1): one pill with the
 * type stamp, the name and the first stat. It is how an entity sits in prose,
 * inside a slot, or as a chip in a picker — the same anatomy as the card, at
 * chip scale: a tone pill for a thing you have, an ink pill for a thing you do,
 * and a dashed edge on a user-made one.
 */
export function CardShortform({
  outer,
  accent,
  frameStyle,
  onBandText,
  ink,
  typeLabel,
  name,
  tail,
  pennant,
  userMade,
}: {
  outer: CardOuterProps
  accent: { className?: string; style?: CSSProperties }
  frameStyle: CSSProperties
  onBandText: string
  /** An INK pill (a thing you do). */
  ink: boolean
  typeLabel: string
  name: string
  /** The first stat — TL, an ability's level, a class's kind. */
  tail: ShortformTail | undefined
  /** An action's cost pennant, in place of a stat. */
  pennant: ReactNode
  userMade: boolean
}) {
  // A tech-level ramp is never a text ground (ruleset §3.8): its middle steps
  // carry neither ink nor paper at 4.5 : 1, so the name sits on paper.
  const nameOnPaper = /\bbg-tl-/.test(accent.className ?? '')
  const nameStyle = nameOnPaper ? { ...NAME, ...NAME_ON_PAPER } : NAME
  return (
    <CardOuter {...outer}>
      <div
        className={accent.className}
        title={userMade ? USER_MADE_TITLE : undefined}
        style={{ ...accent.style, ...frameStyle, ...pill, position: 'relative' }}
      >
        {userMade && <span style={VISUALLY_HIDDEN}>User-made </span>}
        <span style={stamp(ink)}>{typeLabel}</span>
        {/* The name wins: in a narrow slot it wraps onto a second line rather
            than being clipped or ellipsized. A pill exists to say which thing
            it is, and half a name does not. */}
        <span className={nameOnPaper ? undefined : onBandText} style={nameStyle}>
          {name}
        </span>
        {pennant}
        {tail && (
          <Stat orientation="horizontal" label={tail.label} value={tail.value} size="mini" />
        )}
      </div>
    </CardOuter>
  )
}
