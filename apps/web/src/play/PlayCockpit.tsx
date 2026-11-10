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
 * so every roll made in any pane is dispatched whichever pane is open.
 *
 * From `lg` the Situation switch (`PlaySituationSwitch`) fills the bar's
 * `situation` slot; below it, it is pinned under the live vitals for the
 * Situation (`pinnedUnits`), TABLE beside it. In table mode (`useTableMode`)
 * the panes give way to `PlayTableMode`, which draws those vitals itself at
 * the Full Size, and the screen stays awake (`useWakeLock`).
 *
 * The bar's ONLINE stamp counts who is here in a Game ("● Online · 4 here",
 * `hereCount` over the Game's room, `useGamePresence`, play.md §7);
 * a solo screen, which shares nothing, has none. Either
 * gives way to a read-only stamp when the connection drops or the tab is
 * outdated (`play.readOnly`).
 * In a Game, Stop shows the Stop Sign, and while it is up a banner under the
 * bar says the game is paused (`StopSign.tsx`).
 * The channel button shows where rolls post (`usePlayChannelControls`; unbound, the ⋯'s row,
 * §9). In a Game, ⋯ opens the Game's page, and so does "‹ Game" (ADR-052
 * §5–§6); solo, "‹ Play" goes back to the Play hub and there is no ⋯.
 */

import { useRouter } from '@tanstack/react-router'
import { gamePath } from 'game-domain/entityKinds'
import { mayBindChannel } from 'game-domain/games/discord'
import { PRODUCT } from 'game-domain/product'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import type { HeaderMenuItem } from '../components/index'
import { HeaderMenu, tokens } from '../components/index'
import { areaTitle } from '../lib/pageTitle'
import { runWrite } from '../lib/runWrite'
import { useTabTitle } from '../lib/useTabTitle'
import { playCopy } from '../messages/play'
import { routesCopy } from '../messages/routes'
import { PLAY_TXN } from '../replica/provenance'
import { useSync } from '../replica/syncContext'
import { useUnits } from '../replica/units'
import { useTableRead } from '../replica/useTable'
import { hereCount } from './crew.model'
import { PlayActionsColumn } from './PlayActionsColumn'
import { PlayBar } from './PlayBar'
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
import { StopSignBanner, StopSignButton } from './StopSign'
import { tableUnits } from './tableMode.model'
import { useGamePresence } from './useGamePresence'
import type { PlayActionsDeps } from './usePlayActions'
import { usePlayChannelBinding } from './usePlayChannel'
import { usePlayChannelControls } from './usePlayChannelControls'
import { usePlaySide } from './usePlaySide'
import { usePlaySituation } from './usePlaySituation'
import { usePlayUnits } from './usePlayUnits'
import { usePlayWide } from './usePlayWide'
import { useStopSign } from './useStopSign'
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
  const { status } = useSync()
  const play = usePlaySituation(target)
  const pilotName = play.pilot?.name
  useTabTitle(pilotName ? areaTitle(PRODUCT.play, `${pilotName} · ${routesCopy('play')}`) : null)
  const binding = usePlayChannelBinding(target)
  const crew = useTableRead(
    'crew.vitals',
    target.gameId !== null && status === 'live' ? { gameId: target.gameId } : 'skip'
  )
  const sign = useStopSign(target.gameId)
  const here = useGamePresence(target.gameId, 'seat')
  const wide = usePlayWide()
  const [tab, setTab] = useState<PlayerPane>('act')
  const side = usePlaySide({ target, play })
  const units = usePlayUnits(play)
  const solo = target.gameId === null
  // A Game's channel is its Mediator's or Organiser's to bind
  // (`mayBindChannel`); solo, the channel is the player's own.
  const channel = usePlayChannelControls({
    owner: solo ? { kind: 'solo' } : { kind: 'game', gameName: target.gameName },
    binding,
    mayBind:
      solo || mayBindChannel({ mediator: target.mediator, organizer: target.organizer === true }),
    compact: !wide,
  })
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
    runWrite(() => useUnits.getState().update(kind, id, { [field]: next }, PLAY_TXN))
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
        <>
          <PlayBar
            title={playTitle(target, play.pilot?.name ?? 'Pilot')}
            stamp={playStamp(target)}
            tone={PHASE_TONE[play.situation]}
            backHref={target.gameId === null ? '/play/' : gamePath(target.gameId)}
            backLabel={solo ? playCopy('play') : playCopy('game')}
            live={status === 'live' && !solo}
            here={crew == null || here === null ? null : hereCount(crew.pilots, here)}
            // A phone's bar is one line: with no channel button on it, the
            // stamp has the room to say "Online" as the canvas's does.
            short={!wide && channel.button !== null}
            readOnly={play.readOnly}
            situation={wide ? <PlaySituationSwitch play={play} /> : undefined}
            channel={channel.button}
            stop={<StopSignButton sign={sign} compact={!wide} />}
            menu={
              target.gameId === null && channel.row === null ? undefined : (
                <CockpitMenu
                  gameId={target.gameId}
                  gameName={target.gameName}
                  channel={channel.row}
                />
              )
            }
          />
          {channel.dialog}
          <StopSignBanner sign={sign} play={wide ? 'canvas' : 'phone'} />
        </>
      }
      pinned={
        <>
          {table ? null : (
            <PlayPinnedVitals
              units={pinned}
              live={{ pilot: units.live.pilot, mech: units.live.mech }}
              onWrite={writeVital}
            />
          )}
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
 * offers it; and, for whoever may bind one while none is bound, the Discord
 * channel (`usePlayChannelControls`), which is all a solo screen's ⋯ holds.
 */
function CockpitMenu({
  gameId,
  gameName,
  channel,
}: {
  gameId: string | null
  gameName: string | null
  channel: HeaderMenuItem | null
}) {
  const router = useRouter({ warn: false })
  return (
    <HeaderMenu
      variant="overflow"
      size="compact"
      label={playCopy('more')}
      trigger={null}
      sections={[
        gameId === null
          ? []
          : [
              {
                id: 'game',
                label: playCopy('gamePage'),
                hint: gameName ?? undefined,
                onSelect: () => {
                  if (router)
                    void router.navigate({ to: '/play/games/$gameId', params: { gameId } })
                  else window.location.assign(gamePath(gameId))
                },
              },
            ],
        channel ? [channel] : [],
      ]}
    />
  )
}
