import type { CSSProperties, ReactNode } from 'react'
import { font, fontSize, space, tracking, weight } from '../../../design/tokens'
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

const stamp = (onInk: boolean): CSSProperties => ({
  backgroundColor: 'var(--color-ink)',
  border: `var(--bw-hairline) solid ${onInk ? 'var(--color-paper)' : 'var(--color-ink)'}`,
  color: 'var(--color-paper)',
  flex: 'none',
  fontSize: fontSize.badge,
  letterSpacing: tracking.capsSnug,
  padding: `1px ${space[4]}`,
})

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
  return (
    <CardOuter {...outer}>
      <div
        className={accent.className}
        title={userMade ? USER_MADE_TITLE : undefined}
        style={{ ...accent.style, ...frameStyle, ...pill }}
      >
        <span style={stamp(ink)}>{typeLabel}</span>
        <span
          className={onBandText}
          style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
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
