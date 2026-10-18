/**
 * PlayCockpit — the player's Play screen for one pilot, in a Game or solo
 * (Direction A, the Cockpit): the Play bar, then the Units | Actions | Crew,
 * Tables, Feed columns, then the foot, on `PlayFrame`'s fixed canvas. Who may
 * open it is `PlayGate`'s question, asked before this renders.
 *
 * Each column is its own component (`PlayUnitsColumn`, `PlayActionsColumn`,
 * `PlaySideColumn`), so a column's work happens in its own file. Each is
 * handed the `PlayTarget` and the one `Play` object `usePlaySituation`
 * returns here (the seat, the Downtime and the Situation they make), so the
 * three read the same thing. The Situation switch (`PlaySituationSwitch`)
 * fills the bar's `situation` slot, and while the screen is open it beats
 * for the seat's presence (`usePlayPresence`).
 *
 * The bar's LIVE stamp counts who is here in a Game ("● Live · 4 here",
 * `hereCount` over the seats' `lastSeenAt` from `seats.forGame`, play.md §7);
 * a solo screen, which shares nothing, has none (the solo wireframes). Either
 * gives way to a read-only stamp when the connection drops or the tab is
 * outdated (`play.readOnly`).
 * The channel button shows where rolls post, or Connect (`PlayChannelButton`,
 * §9). The ⋯ menu is inert until its own issue lands.
 *
 * Below the canvas's floor the same columns go on tabs (`PlayCockpitPhone`,
 * play.md §11): Act, Units, Tables, Crew under the pinned vitals and the
 * Situation switch. Only one form is mounted at a time, so the side's roll
 * dispatch is too.
 */

import { useQuery } from 'convex/react'
import type { ReactNode } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { Button } from '../index'
import { hereCount } from './crew.model'
import { PlayActionsColumn } from './PlayActionsColumn'
import { PlayBar } from './PlayBar'
import { PlayChannelButton } from './PlayChannel'
import { PlayCockpitPhone } from './PlayCockpitPhone'
import { PlayFoot } from './PlayFoot'
import { PlayFrame } from './PlayFrame'
import { PlaySideColumn } from './PlaySideColumn'
import { PlaySituationSwitch } from './PlaySituationSwitch'
import { PlayUnitsColumn } from './PlayUnitsColumn'
import type { PlayTarget } from './play.model'
import { playTitle } from './play.model'
import { usePlayChannelBinding } from './usePlayChannel'
import { usePlayPresence } from './usePlayPresence'
import { usePlaySituation } from './usePlaySituation'
import { usePresenceClock } from './usePresenceClock'

type PlayCockpitProps = {
  target: PlayTarget
  /** In place of the Situation switch, in the bar after the LIVE stamp. */
  situation?: ReactNode
}

export function PlayCockpit({ target, situation }: PlayCockpitProps) {
  const { mode } = useConnection()
  const play = usePlaySituation(target)
  usePlayPresence(target)
  const binding = usePlayChannelBinding(target)
  const seats = useQuery(
    api.seats.forGame,
    target.gameId !== null && mode === 'connected'
      ? { gameId: target.gameId as Id<'games'> }
      : 'skip'
  )
  const now = usePresenceClock()
  const bar = (phone: boolean) => (
    <PlayBar
      phone={phone}
      title={playTitle(target, play.pilot?.name ?? 'Pilot')}
      live={mode === 'connected' && target.gameId !== null}
      here={seats === undefined ? null : hereCount(seats, now)}
      readOnly={play.readOnly}
      situation={phone ? undefined : (situation ?? <PlaySituationSwitch play={play} />)}
      channel={
        <PlayChannelButton
          owner={
            target.gameId === null ? { kind: 'solo' } : { kind: 'game', gameName: target.gameName }
          }
          binding={binding}
          compact={phone}
        />
      }
      menu={
        <Button variant="ghost" size="compact" aria-label="More" disabled>
          ⋯
        </Button>
      }
    />
  )
  return (
    <PlayFrame
      labels={['Units', 'Actions', 'Crew, Tables and Feed']}
      bar={bar(false)}
      start={<PlayUnitsColumn target={target} play={play} />}
      centre={<PlayActionsColumn target={target} play={play} />}
      end={<PlaySideColumn target={target} play={play} />}
      foot={<PlayFoot solo={target.gameId === null} />}
      phone={<PlayCockpitPhone target={target} play={play} bar={bar(true)} situation={situation} />}
    />
  )
}
