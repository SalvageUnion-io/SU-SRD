/**
 * The Stop Sign (Core Book p.13): anyone at a Game's table may show it, at any
 * time, with no reason asked, and the game pauses to talk out of character.
 *
 * `useStopSign` reads it once per screen; `StopSignButton` is Play's bar
 * control and the Game page's; `StopSignBanner` is what every open screen of the Game shows while it is
 * up, without saying who showed it. Whoever did, or the table runner, may
 * lift it (`safety.liftStop`). Solo play has no table, so it has none.
 */

import { OctagonPause } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Button, Callout, Text, tokens } from '../components/index'
import { playSafetyCopy } from '../messages/play-safety'
import type { StopSign } from './useStopSign'

/**
 * The control: **Stop**, rust, the one press anyone may make. Pressed while
 * the sign is up it does nothing more, so it says so by being disabled. On
 * the phone's bar, where a word would push ⋯ off the line, it is the
 * octagon alone.
 */
export function StopSignButton({
  sign,
  label = playSafetyCopy('stop'),
  compact = false,
}: {
  sign: StopSign | null
  label?: string
  compact?: boolean
}) {
  if (sign === null) return null
  return (
    <Button
      variant="primary"
      size={compact ? 'iconOnly' : 'compact'}
      aria-label={playSafetyCopy('showTheStopSign')}
      title={compact ? playSafetyCopy('showTheStopSign') : undefined}
      disabled={!sign.canWrite || sign.shown || sign.pending}
      onClick={sign.show}
    >
      {compact ? <OctagonPause size={tokens.iconSize.compact} aria-hidden="true" /> : label}
    </Button>
  )
}

const BANNER = { flexShrink: 0 } satisfies CSSProperties

/**
 * Play's place for it, right under the bar: the canvas's bar bleeds to the
 * frame's edges and the phone's has no gutter, so it takes its own.
 */
const PLAY_BANNER = {
  canvas: { ...BANNER, padding: `${tokens.space[8]} ${tokens.space[12]} 0` },
  phone: { ...BANNER, padding: `${tokens.space[8]} ${tokens.space[8]} 0` },
} satisfies Record<string, CSSProperties>

const BANNER_BODY = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  justifyContent: 'space-between',
} satisfies CSSProperties

const BANNER_TEXT = {
  display: 'flex',
  flex: '1 1 16rem',
  flexDirection: 'column',
  gap: tokens.space[2],
  minWidth: 0,
} satisfies CSSProperties

const PAUSED = { fontWeight: tokens.weight.bold } satisfies CSSProperties

/** While the sign is up: the game is paused, on every open screen of the Game. */
export function StopSignBanner({
  sign,
  play,
}: {
  sign: StopSign | null
  /** Under Play's bar, in its form: the canvas's or the phone's. */
  play?: 'canvas' | 'phone'
}) {
  if (sign === null || !sign.shown) return null
  return (
    <div style={play === undefined ? BANNER : PLAY_BANNER[play]} role="status">
      <Callout tone="bad">
        <div style={BANNER_BODY}>
          <div style={BANNER_TEXT}>
            <Text style={PAUSED}>{playSafetyCopy('paused')}</Text>
            <Text>{sign.mine ? playSafetyCopy('pausedYours') : playSafetyCopy('pausedBody')}</Text>
          </div>
          {sign.mayLift && (
            <Button size="compact" disabled={!sign.canWrite || sign.pending} onClick={sign.lift}>
              {playSafetyCopy('resume')}
            </Button>
          )}
        </div>
      </Callout>
    </div>
  )
}
