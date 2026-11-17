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
 * (`usePlaySide`: the roll dispatch, the bound channel) is read here once too,
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
 *
 * A sheet on the screen (`useSheetOnScreen`, play.md §18): any unit's Sheet,
 * a Crew line, or ⋯'s "Show a sheet" puts that sheet in the Actions column
 * (`PlaySheetPane`, through `ShowSheetContext`); below `lg` it stands in the
 * open pane's place until × or another tab.
 */

import { useRouter } from '@tanstack/react-router'
import { gamePath } from 'game-domain/entityKinds'
import { mayBindChannel } from 'game-domain/games/discord'
import { PRODUCT } from 'game-domain/product'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import type { HeaderMenuItem } from '../components/index'
import { HeaderMenu, tokens } from '../components/index'
import { changeUndoToast } from '../lib/changeUndoToast'
import { areaTitle } from '../lib/pageTitle'
import { runWrite } from '../lib/runWrite'
import { useTabTitle } from '../lib/useTabTitle'
import { playCopy } from '../messages/play'
import { routesCopy } from '../messages/routes'
import { PLAY_TXN } from '../replica/provenance'
import { useSync } from '../replica/syncContext'
import { useUnits } from '../replica/units'
import { useTableRead } from '../replica/useTable'
import { boardable } from './boardMenu.model'
import { hereCount } from './crew.model'
import { SrdExplorer } from './mediator/SrdExplorer'
import { PlayActionsColumn } from './PlayActionsColumn'
import { PlayBar } from './PlayBar'
import { PlayFoot } from './PlayFoot'
import { PlayFrame } from './PlayFrame'
import { PlayPinnedStrip } from './PlayPinnedVitals'
import { PlaySheetPane } from './PlaySheetPane'
import { PlayCrewSection, PlayerTablesAndFeed } from './PlaySideColumn'
import { PlaySituationSwitch } from './PlaySituationSwitch'
import { PlayTableMode } from './PlayTableMode'
import { PlayUnitsColumn } from './PlayUnitsColumn'
import type { PlayTarget } from './play.model'
import { PHASE_TONE, playStamp, playTitle } from './play.model'
import type { PlayerPane } from './playPanes.model'
import {
  PLAYER_PHONE_TABS,
  PLAYER_TABS,
  pinnedUnits,
  playerPanes,
  playerPhonePanes,
} from './playPanes.model'
import { StopSignBanner, StopSignButton } from './StopSign'
import type { Play } from './situation.model'
import { tableUnits } from './tableMode.model'
import { useGamePresence } from './useGamePresence'
import { ShowSheetContext } from './useOpenSheet'
import type { PlayActionsDeps } from './usePlayActions'
import { usePlayChannelBinding } from './usePlayChannel'
import { usePlayChannelControls } from './usePlayChannelControls'
import { usePlaySide } from './usePlaySide'
import { usePlaySituation } from './usePlaySituation'
import { usePlayUnits } from './usePlayUnits'
import { usePlayWide } from './usePlayWide'
import type { SheetOnScreen } from './useSheetOnScreen'
import { useSheetOnScreen } from './useSheetOnScreen'
import { useStopSign } from './useStopSign'
import { useTableMode } from './useTableMode'
import { useWakeLock } from './useWakeLock'

/** MOCK (Working Manual E): the Rules pane holds the Reference's own frame, edge to edge. */
const RULES = { margin: `calc(-1 * ${tokens.space[8]})` } satisfies CSSProperties

/** MOCK: the phases as the phone's band says them. */
const PHASE_WORDS = { onFoot: 'On foot', boarded: 'Boarded', downtime: 'Downtime' } as const

/**
 * MOCK (screenshot state only): `?mock=dot,turn,ep` forces what the app has
 * no source for yet (whose turn it is, a pending proposal's dot) or opens a
 * vital's − / +.
 */
function mockFlags(): ReadonlySet<string> {
  if (typeof window === 'undefined') return new Set()
  return new Set((new URLSearchParams(window.location.search).get('mock') ?? '').split(','))
}

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
  const onScreen = useSheetOnScreen(target, play, units)
  // A Game's channel is its Mediator's or Organiser's to bind
  // (`mayBindChannel`); solo, the channel is the player's own.
  const channel = usePlayChannelControls({
    owner: solo ? { kind: 'solo' } : { kind: 'game', gameName: target.gameName },
    binding,
    mayBind:
      solo || mayBindChannel({ mediator: target.mediator, organizer: target.organizer === true }),
    compact: !wide,
  })
  const [tableOn, setTableOn] = useTableMode()
  const mock = mockFlags()
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
  const writeVital = (kind: 'pilot' | 'mech', field: string, next: number, label?: string) => {
    const id = kind === 'pilot' ? pilotId : mechId
    if (id === null) return
    // MOCK (Working Manual, the Undo law): the change says itself, with Undo.
    const from = pinned.find((u) => u.kind === kind)?.vitals.find((v) => v.label === label)?.value
    runWrite(() => useUnits.getState().update(kind, id, { [field]: next }, PLAY_TXN))
    if (label !== undefined && from !== undefined)
      changeUndoToast({
        id: `${kind}:${id}:${field}`,
        label,
        from,
        to: next,
        undo: (value) =>
          runWrite(() => useUnits.getState().update(kind, id, { [field]: value }, PLAY_TXN)),
      })
  }
  const nodes: Record<PlayerPane, ReactNode> = {
    act: <PlayActionsColumn target={target} play={play} {...actions} />,
    units: <PlayUnitsColumn target={target} play={play} />,
    crew: <PlayCrewSection target={target} play={play} side={side} />,
    tables: <PlayerTablesAndFeed target={target} play={play} side={side} />,
    // MOCK (Working Manual E): the Reference inside Play, a player's too (the Mediator's `SrdExplorer`).
    rules: wide ? null : (
      <div style={RULES}>
        <SrdExplorer />
      </div>
    ),
  }
  // MOCK (Working Manual E): who is playing, on the band's cut-out.
  const who =
    play.situation === 'boarded' && play.boardedMech !== null
      ? `${pilotName ?? 'Pilot'} in ${play.boardedMech.name}`
      : (pilotName ?? 'Pilot')

  return (
    <ShowSheetContext.Provider value={onScreen.show}>
      <PlayFrame
        wide={wide}
        labels={['Units', 'Actions', 'Crew, Tables and Feed']}
        bar={
          <>
            <PlayBar
              title={wide ? playTitle(target, play.pilot?.name ?? 'Pilot') : who}
              line={
                wide
                  ? undefined
                  : {
                      game: target.gameName,
                      phase: PHASE_WORDS[play.situation],
                      // MOCK: the app does not track turns; forced for the picture.
                      turn: mock.has('turn') ? 'Your turn' : undefined,
                    }
              }
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
                <CockpitMenu
                  gameId={target.gameId}
                  gameName={target.gameName}
                  channel={channel.row}
                  onScreen={onScreen}
                  // MOCK (Working Manual E): below `lg`, On foot / Board / Table mode live here.
                  situation={wide ? null : { play, tableOn, setTableOn }}
                />
              }
            />
            {channel.dialog}
            <StopSignBanner sign={sign} play={wide ? 'canvas' : 'phone'} />
          </>
        }
        pinned={
          <>
            {/* MOCK (Working Manual E): one row of five framed vitals; the switch is in ⋯. */}
            {table ? null : (
              <PlayPinnedStrip
                units={pinned}
                live={{ pilot: units.live.pilot, mech: units.live.mech }}
                onWrite={writeVital}
                initialOpen={mock.has('ep') ? 'EP' : null}
              />
            )}
          </>
        }
        panes={(wide
          ? playerPanes(solo)
          : playerPhonePanes(solo, mock.has('dot') ? 'tables' : null)
        ).map((p) => ({ ...p, node: nodes[p.value] }))}
        tabs={wide ? PLAYER_TABS : PLAYER_PHONE_TABS}
        tab={tab}
        onTab={(next) => {
          onScreen.close()
          setTab(next)
        }}
        sheet={
          onScreen.shown ? (
            <PlaySheetPane
              shown={onScreen.shown}
              sections={onScreen.sections}
              gameId={target.gameId}
              onShow={onScreen.show}
              onClose={onScreen.close}
            />
          ) : undefined
        }
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
    </ShowSheetContext.Provider>
  )
}

/**
 * The bar's ⋯: "Show a sheet", putting your pilot's on the screen, its
 * picker reaching the rest (play.md §18); in a Game, the Game's page
 * (ADR-052 §5), as the Mediator's ⋯ offers it; and, for whoever may bind one
 * while none is bound, the Discord channel (`usePlayChannelControls`).
 */
function CockpitMenu({
  gameId,
  gameName,
  channel,
  onScreen,
  situation,
}: {
  gameId: string | null
  gameName: string | null
  channel: HeaderMenuItem | null
  onScreen: SheetOnScreen
  /** MOCK (Working Manual E): the phone's Situation switch and Table mode, as rows. */
  situation: { play: Play; tableOn: boolean; setTableOn: (on: boolean) => void } | null
}) {
  const first = onScreen.sections[0]?.[0]
  const router = useRouter({ warn: false })
  return (
    <HeaderMenu
      variant="overflow"
      size="compact"
      label={playCopy('more')}
      trigger={null}
      sections={[
        situation === null ? [] : situationRows(situation),
        first === undefined
          ? []
          : [
              {
                id: 'sheet',
                label: playCopy('showASheet'),
                onSelect: () => onScreen.show(onScreen.shown ?? first),
              },
            ],
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

/**
 * MOCK (Working Manual E): the Situation switch as ⋯ rows below `lg`: On
 * foot, Board for each mech that can be boarded, then Table mode. Leaving a
 * running Downtime keeps its confirm on the wide switch; these rows are off
 * while it runs.
 */
function situationRows({
  play,
  tableOn,
  setTableOn,
}: {
  play: Play
  tableOn: boolean
  setTableOn: (on: boolean) => void
}): HeaderMenuItem[] {
  const off = !play.canWrite || play.downtime.downtime.running
  return [
    {
      id: 'on-foot',
      label: 'On foot',
      hint: play.situation === 'onFoot' ? 'Now' : undefined,
      onSelect: off || play.situation === 'onFoot' ? undefined : () => play.setOnFoot(),
    },
    ...play.mechs
      .filter((m) => boardable(m) && m.state !== 'spare')
      .map((m) => ({
        id: `board-${m.mechId}`,
        label: `Board ${m.name}`,
        hint: play.situation === 'boarded' && play.boardedMech?.id === m.mechId ? 'Now' : undefined,
        onSelect:
          off || (play.situation === 'boarded' && play.boardedMech?.id === m.mechId)
            ? undefined
            : () => play.board(m.mechId),
      })),
    {
      id: 'table-mode',
      label: tableOn ? 'Leave table mode' : 'Table mode',
      onSelect: () => setTableOn(!tableOn),
    },
  ]
}
