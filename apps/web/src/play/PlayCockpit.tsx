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
 * a solo screen, which shares nothing, has none. Either
 * gives way to a read-only stamp when the connection drops or the tab is
 * outdated (`play.readOnly`).
 * The channel button shows where rolls post, or Connect (`PlayChannelButton`,
 * §9). In a Game, ⋯ opens the Game's page, and so does "‹ Game" (ADR-052
 * §5–§6); solo, "‹ Play" goes back to the Play hub and ⋯ is inert.
 *
 * Below the canvas's floor the same columns go on tabs (`PlayCockpitPhone`,
 * play.md §11): Act, Units, Tables, Crew under the pinned vitals and the
 * Situation switch. Only one form is mounted at a time, so the side's roll
 * dispatch is too.
 */

import { useRouter } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { gamePath } from 'game-domain/entityKinds'
import { Ellipsis } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button, HeaderMenu, tokens } from '../components/index'
import { useConnection } from '../lib/connection/connectionContext'
import { playCopy } from '../messages/play'
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
import { PHASE_TONE, playStamp, playTitle } from './play.model'
import { usePlayChannelBinding } from './usePlayChannel'
import { usePlayPresence } from './usePlayPresence'
import { usePlaySituation } from './usePlaySituation'
import { usePresenceClock } from './usePresenceClock'

type PlayCockpitProps = {
  target: PlayTarget
}

export function PlayCockpit({ target }: PlayCockpitProps) {
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
      stamp={playStamp(target)}
      tone={PHASE_TONE[play.situation]}
      backHref={target.gameId === null ? '/play/' : gamePath(target.gameId)}
      backLabel={target.gameId === null ? playCopy('play') : playCopy('game')}
      live={mode === 'connected' && target.gameId !== null}
      here={seats === undefined ? null : hereCount(seats, now)}
      readOnly={play.readOnly}
      situation={phone ? undefined : <PlaySituationSwitch play={play} />}
      channel={
        <PlayChannelButton
          owner={
            target.gameId === null ? { kind: 'solo' } : { kind: 'game', gameName: target.gameName }
          }
          binding={binding}
          compact={phone}
        />
      }
      menu={<CockpitMenu target={target} />}
    />
  )
  return (
    <PlayFrame
      labels={['Units', 'Actions', 'Crew, Tables and Feed']}
      bar={bar(false)}
      start={<PlayUnitsColumn target={target} play={play} />}
      centre={<PlayActionsColumn target={target} play={play} />}
      end={<PlaySideColumn target={target} play={play} />}
      foot={<PlayFoot solo={target.gameId === null} tone={PHASE_TONE[play.situation]} />}
      phone={<PlayCockpitPhone target={target} play={play} bar={bar(true)} />}
    />
  )
}

/**
 * The bar's ⋯: in a Game, the Game's page (ADR-052 §5), as the Mediator's ⋯
 * offers it; solo there is nothing to open yet, so it stays inert.
 */
function CockpitMenu({ target }: { target: PlayTarget }) {
  const router = useRouter({ warn: false })
  const { gameId } = target
  if (gameId === null) {
    return (
      <Button variant="ghost" size="compact" aria-label={playCopy('more')} disabled>
        <Ellipsis size={tokens.iconSize.compact} aria-hidden="true" />
      </Button>
    )
  }
  return (
    <HeaderMenu
      variant="overflow"
      size="compact"
      label={playCopy('more')}
      trigger={null}
      sections={[
        [
          {
            id: 'game',
            label: playCopy('gamePage'),
            hint: target.gameName ?? undefined,
            onSelect: () => {
              if (router) void router.navigate({ to: '/play/games/$gameId', params: { gameId } })
              else window.location.assign(gamePath(gameId))
            },
          },
        ],
      ]}
    />
  )
}
