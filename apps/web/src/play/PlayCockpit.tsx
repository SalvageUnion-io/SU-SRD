/**
 * PlayCockpit — the player's Play screen for one pilot, in a Game or solo
 * (Direction A, the Cockpit), on `PlayFrame`'s one layout: the Play bar,
 * then the panes, Act, Units, Tables and Crew as tabs on a phone and Units |
 * Actions | Crew, Tables and Feed from `lg`, then the foot. Who may open it
 * is `PlayGate`'s question, asked before this renders.
 *
 * Each pane is its own component (`PlayUnitsColumn`, `PlayActionsColumn`,
 * `PlayCrewSection`, `PlayerTablesAndFeed`), so a pane's work happens in its
 * own file. Each is handed the `PlayTarget` and the one `Play` object
 * `usePlaySituation` returns here (the seat, the Downtime and the Situation
 * they make), so all of them read the same thing. The side's shared state
 * (`usePlaySide`: the roll dispatch, the Post toggle) is read here once too,
 * so every roll made in any pane is dispatched whichever pane is open. While
 * the screen is open it beats for the seat's presence (`usePlayPresence`).
 *
 * From `lg` the Situation switch (`PlaySituationSwitch`) fills the bar's
 * `situation` slot; below it, it is pinned under the live vitals for the
 * Situation (`pinnedUnits`), TABLE beside it. In table mode (`useTableMode`)
 * the panes give way to `PlayTableMode`, which draws those vitals itself at
 * the Full Size, and the screen stays awake (`useWakeLock`).
 *
 * The bar's LIVE stamp counts who is here in a Game ("● Live · 4 here",
 * `hereCount` over the seats' `lastSeenAt` from `seats.forGame`, play.md §7);
 * a solo screen, which shares nothing, has none. Either
 * gives way to a read-only stamp when the connection drops or the tab is
 * outdated (`play.readOnly`).
 * The channel button shows where rolls post, or Connect (`PlayChannelButton`,
 * §9). In a Game, ⋯ opens the Game's page, and so does "‹ Game" (ADR-052
 * §5–§6); solo, "‹ Play" goes back to the Play hub and ⋯ is inert.
 */

import { useRouter } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { gamePath } from 'game-domain/entityKinds'
import { Ellipsis } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button, HeaderMenu, tokens } from '../components/index'
import { useConnection } from '../lib/connection/connectionContext'
import { runWrite } from '../lib/runWrite'
import { playCopy } from '../messages/play'
import { useEntityStore } from '../stores/entityStore'
import { PLAY_TXN } from '../stores/surfaceProvenance'
import { hereCount } from './crew.model'
import { PlayActionsColumn } from './PlayActionsColumn'
import { PlayBar } from './PlayBar'
import { PlayChannelButton } from './PlayChannel'
import { PlayFoot } from './PlayFoot'
import { PlayFrame } from './PlayFrame'
import { PlayPinnedVitals } from './PlayPinnedVitals'
import { PlayCrewSection, PlayerTablesAndFeed } from './PlaySideColumn'
import { PlaySituationSwitch } from './PlaySituationSwitch'
import { PlayTableMode, TableModeToggle } from './PlayTableMode'
import { PlayUnitsColumn } from './PlayUnitsColumn'
import type { PlayTarget } from './play.model'
import { PHASE_TONE, playStamp, playTitle } from './play.model'
import type { PlayerPane } from './playPanes.model'
import { PLAYER_TABS, pinnedUnits, playerPanes } from './playPanes.model'
import { tableUnits } from './tableMode.model'
import type { PlayActionsDeps } from './usePlayActions'
import { usePlayChannelBinding } from './usePlayChannel'
import { usePlayPresence } from './usePlayPresence'
import { usePlaySide } from './usePlaySide'
import { usePlaySituation } from './usePlaySituation'
import { usePlayUnits } from './usePlayUnits'
import { usePlayWide } from './usePlayWide'
import { usePresenceClock } from './usePresenceClock'
import { useTableMode } from './useTableMode'
import { useWakeLock } from './useWakeLock'

/** The Situation switch and TABLE on one line, the switch taking the room. */
const SWITCH_ROW = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

const SWITCH = { flex: '1 1 0%', minWidth: 0 } satisfies CSSProperties

type PlayCockpitProps = {
  target: PlayTarget
  /** The Act pane's store and dice (a test injects its own). */
  actions?: PlayActionsDeps
}

export function PlayCockpit({ target, actions }: PlayCockpitProps) {
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
  const wide = usePlayWide()
  const [tab, setTab] = useState<PlayerPane>('act')
  const side = usePlaySide({ target, play })
  const units = usePlayUnits(play)
  const solo = target.gameId === null
  const [tableOn] = useTableMode()
  const table = tableOn && !wide
  useWakeLock(table)
  const pinned = pinnedUnits({
    situation: play.situation,
    pilot: play.pilot,
    crawler: units.crawler?.crawler ?? null,
    boardedMech: play.boardedMech,
    activeEffects: play.seat.seat.activeEffects,
  })
  const pilotId = play.pilot?.id ?? null
  const mechId = play.boardedMech?.id ?? null
  const writeVital = (kind: 'pilot' | 'mech', field: string, next: number) => {
    const id = kind === 'pilot' ? pilotId : mechId
    if (id === null) return
    runWrite(() => useEntityStore.getState().update(kind, id, { [field]: next }, PLAY_TXN))
  }
  const nodes: Record<PlayerPane, ReactNode> = {
    act: <PlayActionsColumn target={target} play={play} {...actions} />,
    units: <PlayUnitsColumn target={target} play={play} />,
    crew: <PlayCrewSection target={target} play={play} side={side} />,
    tables: <PlayerTablesAndFeed target={target} play={play} side={side} />,
  }

  return (
    <PlayFrame
      wide={wide}
      labels={['Units', 'Actions', 'Crew, Tables and Feed']}
      bar={
        <PlayBar
          title={playTitle(target, play.pilot?.name ?? 'Pilot')}
          stamp={playStamp(target)}
          tone={PHASE_TONE[play.situation]}
          backHref={target.gameId === null ? '/play/' : gamePath(target.gameId)}
          backLabel={solo ? playCopy('play') : playCopy('game')}
          live={mode === 'connected' && !solo}
          here={seats === undefined ? null : hereCount(seats, now)}
          readOnly={play.readOnly}
          situation={wide ? <PlaySituationSwitch play={play} /> : undefined}
          channel={
            <PlayChannelButton
              owner={solo ? { kind: 'solo' } : { kind: 'game', gameName: target.gameName }}
              binding={binding}
              compact={!wide}
            />
          }
          menu={<CockpitMenu target={target} />}
        />
      }
      pinned={
        <>
          {table ? null : <PlayPinnedVitals units={pinned} />}
          <div style={SWITCH_ROW}>
            <div style={SWITCH}>
              <PlaySituationSwitch play={play} fill />
            </div>
            <TableModeToggle />
          </div>
        </>
      }
      panes={playerPanes(solo).map((p) => ({ ...p, node: nodes[p.value] }))}
      tabs={PLAYER_TABS}
      tab={tab}
      onTab={setTab}
      focus={
        table ? (
          <PlayTableMode
            units={tableUnits(pinned)}
            live={{ pilot: units.live.pilot, mech: units.live.mech }}
            onWrite={writeVital}
          />
        ) : undefined
      }
      foot={<PlayFoot solo={solo} tone={PHASE_TONE[play.situation]} />}
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
