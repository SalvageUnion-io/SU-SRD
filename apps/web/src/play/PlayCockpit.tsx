/**
 * PlayCockpit — the player's Play screen for one pilot, in a Game or solo
 * (Direction A, the Cockpit), on `PlayFrame`'s one layout: the Play bar,
 * then the panes: Act, Crew, Rolls and Rules as tabs on a phone (Units from
 * the bar's ⋯), and Units over the Feed | Actions | Crew, Tables and the
 * Rules from `lg`, then the foot. Who may open it is `PlayGate`'s question,
 * asked before this renders.
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
 * `situation` slot; below it, the Situation and Table mode are rows of the
 * bar's ⋯ (`situationRows`) and the live vitals for the Situation are pinned
 * above every pane (`pinnedUnits`), the switch pinned under them in every
 * Situation (r5 A15; in Downtime with the numbers its steps restore, r4 A10). In table mode (`useTableMode`)
 * the panes give way to `PlayTableMode`, which draws those vitals itself at
 * the Full Size, and the screen stays awake (`useWakeLock`).
 *
 * The bar's ONLINE stamp counts who is here in a Game ("● Online · 4 here",
 * `hereCount` over the Game's room, `useGamePresence`, play.md §7);
 * a solo screen, which shares nothing, has none. Either
 * gives way to a read-only stamp when the connection drops or the tab is
 * outdated (`play.readOnly`).
 * In a Game, Stop shows the Stop Sign, and while it is up the band wears the
 * stop colour and the pinned notice says the game is paused (`TableNotices`).
 * The channel button shows where rolls post (`usePlayChannelControls`; unbound, the ⋯'s row,
 * §9). In a Game, ⋯ opens the Game's page, and so does "‹ Game" (ADR-052
 * §5–§6); "‹ Sheet" goes back to the pilot's own page (ADR-066); solo there is no ⋯.
 *
 * A sheet on the screen (`useSheetOnScreen`, play.md §18): any unit's Sheet,
 * a Crew line, or ⋯'s "Show a sheet" puts that sheet in the Actions column
 * (`PlaySheetPane`, through `ShowSheetContext`); below `lg` it stands in the
 * open pane's place until × or another tab.
 */

import { useRouter } from '@tanstack/react-router'
import { gamePath, sheetPath } from 'game-domain/entityKinds'
import { mayBindChannel } from 'game-domain/games/discord'
import { pilotLabel } from 'game-domain/pilotLabel'
import { PRODUCT } from 'game-domain/product'
import { ScrollText } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { HeaderMenuItem } from '../components/index'
import { Button, HeaderMenu, tokens } from '../components/index'
import { changeUndoToast } from '../lib/changeUndoToast'
import { areaTitle } from '../lib/pageTitle'
import { runWrite } from '../lib/runWrite'
import { useTabTitle } from '../lib/useTabTitle'
import { playCopy } from '../messages/play'
import { routesCopy } from '../messages/routes'
import { PLAY_TXN, PLAY_UNDO } from '../replica/provenance'
import { useSync } from '../replica/syncContext'
import { useUnits } from '../replica/units'
import { useTableRead } from '../replica/useTable'
import { useBoardOnArrival } from './boardIntent'
import { hereCount } from './crew.model'
import { SrdExplorer } from './mediator/SrdExplorer'
import { PlayActionsColumn } from './PlayActionsColumn'
import { PlayBar } from './PlayBar'
import { PlayFoot } from './PlayFoot'
import { PlayFrame } from './PlayFrame'
import { PlayPinnedVitals } from './PlayPinnedVitals'
import { PlaySheetPane } from './PlaySheetPane'
import { PlayCrewSection, PlayerTablesAndFeed, PlayFeedSection } from './PlaySideColumn'
import { PlaySituationSwitch } from './PlaySituationSwitch'
import { PlayTableMode } from './PlayTableMode'
import { PlayUnitsColumn } from './PlayUnitsColumn'
import type { PlayTarget } from './play.model'
import { PHASE_TONE, playStamp, playTitle } from './play.model'
import type { PlayerPane } from './playPanes.model'
import { PLAYER_TABS, pinnedUnits, playerPanes, playerPhonePanes } from './playPanes.model'
import { StopSignButton } from './StopSign'
import { tableUnits } from './tableMode.model'
import { useFeedMark } from './useFeedMark'
import { useGamePresence } from './useGamePresence'
import { useGameSession } from './useGameSession'
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
import { situationRows, useSituationMoves } from './useSituationMoves'
import { useStopSign } from './useStopSign'
import { useTableMode } from './useTableMode'
import { useWakeLock } from './useWakeLock'
import { headedVital, vitalNow, vitalSettled } from './vitalWrites.model'
import { onPlayTableAsked, zeroUnit, zeroVitalNotice } from './zeroVital.model'

/** The Rules pane holds the Reference's own frame, edge to edge. */
const RULES = { margin: `calc(-1 * ${tokens.space[8]})` } satisfies CSSProperties

/** From `lg` the Reference closes the end column, under the Tables. */
const RULES_PANE = { value: 'rules', label: playCopy('rules'), column: 'end' } as const

/** The screen's first Tab stop: past the bar and the Units, onto the first action's Use (r4 A3). */
const SKIP_TO_ACTIONS = {
  pane: 'act',
  label: playCopy('skipToActions'),
  first: '[data-action-key] button:not([disabled])',
} as const

/** The Feed section's id (`PlayFeedSection`, `idPrefix` "play"): where the bar's mark jumps. */
const FEED_ID = 'play-feed'

/** The phases as the phone's band says them. */
const PHASE_WORDS = {
  onFoot: playCopy('onFoot'),
  boarded: playCopy('boarded'),
  downtime: playCopy('downtimeWord'),
} as const

type PlayCockpitProps = {
  target: PlayTarget
  /** The Act pane's store and dice (a test injects its own). */
  actions?: PlayActionsDeps
}

export function PlayCockpit({ target, actions }: PlayCockpitProps) {
  const { status } = useSync()
  const play = usePlaySituation(target)
  useBoardOnArrival(play)
  // Callsign first, then the name, as everywhere a pilot is named.
  const pilotName = play.pilot ? pilotLabel(play.pilot) : undefined
  // A pilot in a Game is that Game's: its tab says so (glossary §9); a solo
  // pilot plays from the Training Bay.
  const titleArea = target.gameId === null ? PRODUCT.build : (target.gameName ?? PRODUCT.play)
  useTabTitle(pilotName ? areaTitle(titleArea, `${pilotName} · ${routesCopy('play')}`) : null)
  const binding = usePlayChannelBinding(target)
  const crew = useTableRead(
    'crew.vitals',
    target.gameId !== null && status === 'live' ? { gameId: target.gameId } : 'skip'
  )
  const sign = useStopSign(target.gameId)
  const session = useGameSession(target.gameId)
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
  const moves = useSituationMoves(play)
  const table = tableOn && !wide
  useWakeLock(table)
  const pinned = pinnedUnits({
    situation: play.situation,
    pilot: play.pilot,
    crawler: units.crawler?.crawler ?? null,
    boardedMech: play.boardedMech,
    activeEffects: play.seat.seat.activeEffects,
    downtimeMech: units.mech?.mech ?? null,
  })
  const inDowntime = play.situation === 'downtime'
  const pilotId = play.pilot?.id ?? null
  const mechId = play.boardedMech?.id ?? null
  const writeVital = (
    kind: 'pilot' | 'mech',
    field: string,
    next: number,
    label?: string,
    note?: string
  ) => {
    const id = kind === 'pilot' ? pilotId : mechId
    if (id === null) return
    // The change says itself, with Undo.
    const shown = tableUnits(pinned)
      .find((u) => u.kind === kind)
      ?.vitals.find((v) => v.field === field)
    // A press steps from where the vital is heading, so quick ones all apply (LG-03).
    const key = `${id}:${field}`
    // Undo takes back this change alone: from where the vital stood just before it (r3 B2).
    const from = label === undefined || shown === undefined ? undefined : vitalNow(key, shown.value)
    const to = shown === undefined ? next : headedVital(key, shown.value, next, shown.max)
    runWrite(() =>
      useUnits
        .getState()
        .update(kind, id, { [field]: to }, PLAY_TXN)
        .finally(() => (shown === undefined ? undefined : vitalSettled(key)))
    )
    if (label !== undefined && from !== undefined)
      changeUndoToast({
        id: `${kind}:${id}:${field}`,
        label,
        from,
        to,
        // An amount more than there was says it was capped (r2 C6).
        ...(note === undefined ? {} : { did: note }),
        undo: (value) => {
          runWrite(() => useUnits.getState().update(kind, id, { [field]: value }, PLAY_UNDO))
          zeroVitalNotice(zeroUnit(useUnits.getState(), kind, id), field, to, value)
        },
      })
    // At 0 SP or 0 HP: what is due, on the Feed and with its table's button (r4 A5).
    if (from !== undefined)
      zeroVitalNotice(zeroUnit(useUnits.getState(), kind, id), field, from, to)
  }
  // The button on that notice: the Rolls tab, where the table opens (`PlayTables`).
  const closeSheet = onScreen.close
  useEffect(
    () =>
      onPlayTableAsked(() => {
        closeSheet()
        setTab('tables')
      }),
    [closeSheet]
  )
  const openTab = (next: PlayerPane) => {
    onScreen.close()
    setTab(next)
  }
  const nodes: Record<PlayerPane, ReactNode> = {
    act: <PlayActionsColumn target={target} play={play} {...actions} />,
    // From `lg` the
    // Feed, the table's log, runs under the Units, and the Reference under the
    // Tables, so both side columns end with the centre one.
    units: (
      <>
        <PlayUnitsColumn
          target={target}
          play={play}
          onClose={wide ? undefined : () => openTab('act')}
        />
        {wide && <PlayFeedSection side={side} idPrefix="play" canWrite={play.canWrite} />}
      </>
    ),
    crew: <PlayCrewSection target={target} play={play} side={side} />,
    tables: <PlayerTablesAndFeed target={target} play={play} side={side} feed={!wide} />,
    // The Reference inside Play, a player's too (the Mediator's `SrdExplorer`).
    rules: (
      <div style={wide ? undefined : RULES}>
        <SrdExplorer />
      </div>
    ),
  }
  // Who is playing, on the band's cut-out.
  const pilotWord = pilotName ?? playCopy('pilot2')
  const who =
    play.situation === 'boarded' && play.boardedMech !== null
      ? playCopy('pilotInMech', { pilot: pilotWord, mech: play.boardedMech.name })
      : pilotWord
  // A proposal awaiting this player's answer sits in the Feed, the Rolls tab's on a phone.
  const waiting = side.entries.some((entry) => entry.kind === 'proposal')
  // Somebody else's line landed while the Feed was out of sight (r4 B7): the
  // bar says so, and its press goes there (on a phone, by way of the Rolls tab).
  const feedMark = useFeedMark(side.entries, FEED_ID)
  const [toFeed, setToFeed] = useState(0)
  useEffect(() => {
    if (toFeed > 0) document.getElementById(FEED_ID)?.scrollIntoView({ block: 'start' })
  }, [toFeed])
  const jumpToFeed = () => {
    feedMark.clear()
    if (!wide) openTab('tables')
    setToFeed((n) => n + 1)
  }

  return (
    <ShowSheetContext.Provider value={onScreen.show}>
      <PlayFrame
        wide={wide}
        labels={[playCopy('unitsAndFeed'), playCopy('actions'), playCopy('crewTablesAndRules')]}
        bar={
          <>
            <PlayBar
              title={wide ? playTitle(target, pilotWord) : who}
              line={
                wide
                  ? undefined
                  : {
                      game: target.gameName,
                      phase: PHASE_WORDS[play.situation],
                    }
              }
              stamp={playStamp(target)}
              tone={PHASE_TONE[play.situation]}
              paused={sign?.shown === true}
              // Back to the pilot's own page (ADR-066); its Game is in ⋯.
              backHref={sheetPath('pilot', target.pilotId)}
              backLabel={playCopy('sheet')}
              live={status === 'live' && !solo}
              here={crew == null || here === null ? null : hereCount(crew.pilots, here)}
              // A phone's bar is one line: with no channel button on it, the
              // stamp has the room to say "Online" as the canvas's does.
              short={!wide && channel.button !== null}
              readOnly={play.readOnly}
              situation={wide ? <PlaySituationSwitch play={play} /> : undefined}
              channel={channel.button}
              mark={
                feedMark.shown ? (
                  <Button
                    surface="instrument"
                    size="compact"
                    aria-label={playCopy('newInTheFeed')}
                    onClick={jumpToFeed}
                  >
                    {/* A phone's is its icon and dot: the pilot's name keeps its room (r6 A12). */}
                    {wide ? (
                      playCopy('newInTheFeed')
                    ) : (
                      <ScrollText size={tokens.iconSize.mini} aria-hidden="true" />
                    )}
                    {!wide && <span className="su-play-tab-dot" aria-hidden="true" />}
                  </Button>
                ) : undefined
              }
              stop={<StopSignButton sign={sign} compact={!wide} />}
              menu={
                <CockpitMenu
                  gameId={target.gameId}
                  gameName={target.gameName}
                  channel={channel.row}
                  onScreen={onScreen}
                  // Below `lg`, On foot / Board / Table mode live here.
                  situation={wide ? null : situationRows({ play, moves, tableOn, setTableOn })}
                  // Units has no tab below `lg`: this row opens its pane.
                  onUnits={wide ? null : () => openTab('units')}
                />
              }
            />
            {channel.dialog}
            {!wide && moves.dialogs}
          </>
        }
        pinned={
          table ? null : (
            <>
              <PlayPinnedVitals
                units={pinned}
                live={{ pilot: units.live.pilot, mech: units.live.mech }}
                onWrite={writeVital}
              />
              {/* On foot, Board and Downtime stay on screen in every Situation,
                  boarded too (r5 A15); in Downtime with the numbers (r4 A10). */}
              <PlaySituationSwitch play={play} fill />
            </>
          )
        }
        panes={(wide
          ? [...playerPanes(solo), RULES_PANE]
          : playerPhonePanes(solo, waiting ? 'tables' : null)
        ).map((p) => ({ ...p, node: nodes[p.value] }))}
        tabs={PLAYER_TABS}
        tab={tab}
        onTab={openTab}
        skip={SKIP_TO_ACTIONS}
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
              // Table mode tracks a fight: in Downtime the tabs hold the step.
              units={tableUnits(inDowntime ? [] : pinned)}
              live={{ pilot: units.live.pilot, mech: units.live.mech }}
              onWrite={writeVital}
            />
          ) : undefined
        }
        foot={
          <PlayFoot
            solo={solo}
            tone={PHASE_TONE[play.situation]}
            note={session?.live ? playCopy('sessionLive') : undefined}
          />
        }
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
  onUnits,
}: {
  gameId: string | null
  gameName: string | null
  channel: HeaderMenuItem | null
  onScreen: SheetOnScreen
  /** The phone's Situation and Table mode, as rows (`situationRows`). */
  situation: HeaderMenuItem[] | null
  /** Opens the Units pane, where it has no tab. */
  onUnits: (() => void) | null
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
        situation ?? [],
        onUnits === null ? [] : [{ id: 'units', label: playCopy('units'), onSelect: onUnits }],
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
                  if (router) void router.navigate({ to: '/games/$gameId', params: { gameId } })
                  else window.location.assign(gamePath(gameId))
                },
              },
            ],
        channel ? [channel] : [],
      ]}
    />
  )
}
