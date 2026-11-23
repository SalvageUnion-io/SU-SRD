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
import type { CSSProperties } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button, tokens } from '../components/index'
import { playSafetyCopy } from '../messages/play-safety'
import type { StopSign } from './useStopSign'

/** How long a phone's Stop Sign is held before it fires (r2 I3). */
const STOP_HOLD_MS = 600

/** The hold's clock, which a test runs itself. */
type HoldTimer = { set: (run: () => void, ms: number) => number; clear: (id: number) => void }

const WINDOW_TIMER: HoldTimer = {
  set: (run, ms) => window.setTimeout(run, ms),
  clear: (id) => window.clearTimeout(id),
}

/** The phone's label beside its octagon. */
const LABELLED = {
  alignItems: 'center',
  display: 'inline-flex',
  gap: tokens.space[4],
} satisfies CSSProperties

/**
 * The control: **Stop Sign**, by the one name on the bar and the Game page, rust, the one press anyone may make. Pressed while
 * the sign is up it does nothing more, so it says so by being disabled. On
 * the phone's bar, where the whole name would push ⋯ off the line, it is the
 * octagon and "Stop · hold" (r6 A12), and it fires on a hold (`STOP_HOLD_MS`), never on a
 * brushed tap; a keyboard's or a screen reader's press, which no finger
 * brushes, fires it at once.
 *
 * The hold explains itself (r4 B6): the first tap says "Hold to show the Stop
 * Sign" right at the button (a toast at the page's foot left it looking
 * dead), and a finger held down fills the button over the hold, so the wait
 * is seen (`.su-play-stop`, `styles/play/bar.css`).
 */
export function StopSignButton({
  sign,
  compact = false,
  timer = WINDOW_TIMER,
}: {
  sign: StopSign | null
  compact?: boolean
  /** The hold's clock (a test's own). */
  timer?: HoldTimer
}) {
  // The running hold; `fired` once it ran out with the finger still down.
  const hold = useRef<{ id: number | null; fired: boolean } | null>(null)
  // A finger is down and the hold is running: the button fills.
  const [holding, setHolding] = useState(false)
  // A tap came up short: the button says to hold, until the next press.
  const [hinted, setHinted] = useState(false)
  useEffect(
    () => () => {
      if (hold.current?.id != null) timer.clear(hold.current.id)
    },
    [timer]
  )
  if (sign === null) return null
  if (sign.offline) return <OfflineStop compact={compact} />
  const disabled = !sign.canWrite || sign.shown || sign.pending
  if (!compact) {
    return (
      <Button
        variant="primary"
        size="compact"
        aria-label={playSafetyCopy('showTheStopSign')}
        disabled={disabled}
        onClick={sign.show}
      >
        {playSafetyCopy('stopSign')}
      </Button>
    )
  }
  const letGo = () => {
    if (hold.current?.id != null) timer.clear(hold.current.id)
    if (hold.current) hold.current.id = null
    setHolding(false)
  }
  return (
    <span className="su-play-stop" data-holding={holding ? '' : undefined}>
      <Button
        variant="primary"
        size="compact"
        aria-label={playSafetyCopy('showTheStopSign')}
        title={playSafetyCopy('holdToShow')}
        disabled={disabled}
        onBlur={() => setHinted(false)}
        onPointerDown={() => {
          letGo()
          const mine = { id: null as number | null, fired: false }
          mine.id = timer.set(() => {
            mine.id = null
            mine.fired = true
            setHolding(false)
            sign.show()
          }, STOP_HOLD_MS)
          hold.current = mine
          setHinted(false)
          setHolding(true)
        }}
        onPointerUp={letGo}
        onPointerLeave={letGo}
        onPointerCancel={letGo}
        // A long press is the hold, never the browser's menu.
        onContextMenu={(event) => event.preventDefault()}
        onClick={(event) => {
          // A pointer's click ends a tap or a hold; any other press (a key, a
          // screen reader) has no hold to make, so it fires.
          const pressed = hold.current
          hold.current = null
          if (pressed === null && event.detail === 0) sign.show()
          else if (pressed?.fired !== true) setHinted(true)
        }}
      >
        <span style={LABELLED}>
          <OctagonPause size={tokens.iconSize.mini} aria-hidden="true" />
          {playSafetyCopy('stopHold')}
        </span>
      </Button>
      <span className="su-play-stop__fill" aria-hidden="true" />
      {/* Always there, so it is announced as it fills; empty, it takes no room. */}
      <span role="status" className="su-play-stop__hint">
        {hinted && !sign.shown ? playSafetyCopy('holdToShow') : ''}
      </span>
    </span>
  )
}

/**
 * Offline the sign cannot reach the table (r7 B4): the button is greyed, and
 * carries one line at it, as the hold's hint does: say it aloud.
 */
function OfflineStop({ compact }: { compact: boolean }) {
  const why = useId()
  return (
    <span className="su-play-stop">
      <Button
        variant="primary"
        size="compact"
        aria-label={playSafetyCopy('showTheStopSign')}
        aria-describedby={why}
        disabled
      >
        {compact ? (
          <span style={LABELLED}>
            <OctagonPause size={tokens.iconSize.mini} aria-hidden="true" />
            {playSafetyCopy('stopHold')}
          </span>
        ) : (
          playSafetyCopy('stopSign')
        )}
      </Button>
      <span id={why} className="su-play-stop__hint">
        {playSafetyCopy('offlineSayAloud')}
      </span>
    </span>
  )
}
