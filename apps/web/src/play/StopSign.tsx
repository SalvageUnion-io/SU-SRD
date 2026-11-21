/**
 * The Stop Sign (Core Book p.13): anyone at a Game's table may show it, at any
 * time, with no reason asked, and the game pauses to talk out of character.
 *
 * `useStopSign` reads it once per screen; `StopSignButton` is Play's bar
 * control and the Game page's; the pinned notice (`TableNotices`) is what every screen of the app shows a member while it is
 * up, without saying who showed it. Whoever did, or the table runner, may
 * lift it (`safety.liftStop`). Solo play has no table, so it has none.
 */

import { OctagonPause } from 'lucide-react'
import { Button, tokens } from '../components/index'
import { playSafetyCopy } from '../messages/play-safety'
import type { StopSign } from './useStopSign'

/**
 * The control: **Stop Sign**, by the one name on the bar and the Game page, rust, the one press anyone may make. Pressed while
 * the sign is up it does nothing more, so it says so by being disabled. On
 * the phone's bar, where a word would push ⋯ off the line, it is the
 * octagon alone.
 */
export function StopSignButton({
  sign,
  compact = false,
}: {
  sign: StopSign | null
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
      {compact ? (
        <OctagonPause size={tokens.iconSize.compact} aria-hidden="true" />
      ) : (
        playSafetyCopy('stopSign')
      )}
    </Button>
  )
}
