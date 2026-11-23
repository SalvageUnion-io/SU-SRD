/**
 * PlayMediatorCockpit — the Mediator's Play screen for one Game (play.md
 * §10), on the player's layout (`PlayFrame`): Table, Opposition, Tables and
 * Propose as tabs on a phone, three columns from `lg`. Who may open it is
 * `PlayMediatorGate`'s question, asked before this renders.
 *
 *  - **Bar** — the MEDIATOR stamp, ONLINE "3 of 4 here" (the seats' presence,
 *    `useGamePresence`), the Scene / Downtime switch (`PlayGameStateSwitch`; below
 *    `lg` pinned under the bar), the
 *    Stop (the Stop Sign, `StopSign.tsx`, its banner under the bar while
 *    it is up), the channel button (`channelBindings.current`), Tell the
 *    table and ⋯.
 *  - **Table** (start) — a seat per player, then the crawler
 *    (`PlayMediatorTable`).
 *  - **Opposition** (centre) — the Opposition and the chosen NPC's actions in
 *    a Scene (`PlayMediatorOpposition`); while Downtime runs the pane reads
 *    Downtime and holds the step track and its controls
 *    (`PlayMediatorDowntime`).
 *  - **Tables** and **Propose** (end) — the Tables and the Feed
 *    (`MediatorTablesAndFeed`), then the Propose dock
 *    (`PlayMediatorProposeSection`), docked at the column's foot from `lg`.
 *
 * `usePlayMediator` reads the table once here and hands the same object to
 * every pane, and the side's shared state (`useSideFeed`) is built here once,
 * so the roll dispatch runs whichever pane is open. A seat tapped aims Propose and puts
 * focus in its To field (see the problem, propose the fix), opening its tab
 * first below `lg`. Pane headings are Slabs, never `TitledBox`es, so what a
 * pane lists stays level 1 (the Nested Frames Audit, play.md §12).
 */

import { gamePath } from 'game-domain/entityKinds'
import { proposalTargets } from 'game-domain/games/proposals'
import { PRODUCT } from 'game-domain/product'
import type { ReactNode } from 'react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { rollForTable } from '../components/index'
import { Stat, Toggle } from '../components/index'
import { areaTitle } from '../lib/pageTitle'
import { useTabTitle } from '../lib/useTabTitle'
import { playCopy } from '../messages/play'
import { mediatorCopy } from '../messages/play-mediator'
import { routesCopy } from '../messages/routes'
import { useSync } from '../replica/syncContext'
import { hereOf } from './mediator/mediatorTable.model'
import { PlayGameStateSwitch } from './mediator/PlayGameStateSwitch'
import { PlayMediatorBarActions } from './mediator/PlayMediatorBarActions'
import { PlayMediatorDowntime } from './mediator/PlayMediatorDowntime'
import { PlayMediatorOpposition } from './mediator/PlayMediatorOpposition'
import {
  MediatorTablesAndFeed,
  PlayMediatorProposeSection,
  RunningNotes,
} from './mediator/PlayMediatorSide'
import { PlayMediatorTable } from './mediator/PlayMediatorTable'
import { SrdExplorer } from './mediator/SrdExplorer'
import { usePlayMediator } from './mediator/usePlayMediator'
import { PlayBar } from './PlayBar'
import { PlayFoot } from './PlayFoot'
import { PlayFrame } from './PlayFrame'
import { PlayFeedSection } from './PlaySideColumn'
import { mediatorTarget, PHASE_TONE } from './play.model'
import type { MediatorPane } from './playPanes.model'
import { mediatorPanes } from './playPanes.model'
import { rememberPrivateRolls, setPrivateRolls, storedPrivateRolls } from './playRolls.model'
import { FoldRolledTables, PrivateRolls } from './privateRolls.model'
import { StopSignButton } from './StopSign'
import { useGameSession } from './useGameSession'
import { usePlayChannelBinding } from './usePlayChannel'
import { usePlayChannelControls } from './usePlayChannelControls'
import { useSideFeed } from './usePlaySide'
import { usePlayWide } from './usePlayWide'
import { sceneConditionNames } from './useScene'
import { useStopSign } from './useStopSign'

/** Only needed once it shows: its own file (the app's bundle budget). */
const MediatorPlan = lazy(() =>
  import('./mediator/MediatorPlan').then((m) => ({ default: m.MediatorPlan }))
)

/** The foot's reminder: what the players can see of the Opposition. */
type PlayMediatorCockpitProps = {
  gameId: string
  gameName: string
  /** The dice the centre's rolls read (a test injects its own). */
  rollFor?: typeof rollForTable
}

export function PlayMediatorCockpit({ gameId, gameName, rollFor }: PlayMediatorCockpitProps) {
  const { status } = useSync()
  const mediator = usePlayMediator(gameId, gameName)
  useTabTitle(areaTitle(PRODUCT.play, `${routesCopy('mediate')} ${gameName}`))
  const binding = usePlayChannelBinding({ gameId })
  // The Mediator's side (play.md §10): every roll goes on the Game's log, so
  // the players' Feeds show it and a reload keeps it, and posts while a channel
  // is bound; with Private rolls on (the Rolls pane's switch), a roll is kept
  // from the players and from Discord. Nothing awaits the Mediator's answer, so no proposal is on its Feed.
  // The switch is remembered per Game (r2 B2): a secret roll that goes public
  // cannot be taken back, so a reload never turns it off.
  const [privately, setPrivately] = useState(() => storedPrivateRolls(gameId))
  // Set while rendering, so a roll made the moment the screen opens is private too.
  setPrivateRolls(privately)
  useEffect(() => () => setPrivateRolls(false), [])
  const togglePrivately = () => {
    rememberPrivateRolls(gameId, !privately)
    setPrivately(!privately)
  }
  const side = useSideFeed({
    target: mediatorTarget(mediator.gameId),
    rollerName: 'Mediator',
    binding,
    channel: { owner: { kind: 'game', gameName }, mayBind: true },
    rolls: mediator.rolls,
    alerts: mediator.alerts,
    events: mediator.events,
    proposals: [],
  })
  const wide = usePlayWide()
  // The Mediator may bind the Game's channel (`mayBindChannel`).
  const channel = usePlayChannelControls({
    owner: { kind: 'game', gameName },
    binding,
    mayBind: true,
    compact: !wide,
  })
  const [tab, setTab] = useState<MediatorPane>('table')
  const [picked, setPicked] = useState<string | null>(null)
  // A seat was tapped: focus To once Propose is showing.
  const [focusTo, setFocusTo] = useState(false)
  const toRef = useRef<HTMLInputElement | null>(null)
  const { here, of } = hereOf(mediator.seats)
  const running = mediator.downtime.downtime.running
  const sign = useStopSign(gameId)
  const session = useGameSession(gameId)
  // The Scene's conditions that are on, on the header whatever the pane (r4 A11).
  const sceneNames = sceneConditionNames(mediator.scene.conditions)
  const sceneOn =
    sceneNames === '' ? undefined : mediatorCopy('sceneUnderStamp', { scene: sceneNames })

  useEffect(() => {
    if (!focusTo || (!wide && tab !== 'propose')) return
    toRef.current?.focus()
    setFocusTo(false)
  }, [focusTo, tab, wide])
  // Propose's "Go to its SP": the crawler's own vital on the Table (r6 B13).
  const [toCrawler, setToCrawler] = useState(false)
  const crawlerName = mediator.crawler?.crawler.name
  useEffect(() => {
    if (!toCrawler || (!wide && tab !== 'table') || crawlerName === undefined) return
    const box = document.querySelector(
      `[aria-label="${playCopy('crawler', { name: crawlerName })}"]`
    )
    const gauge = box?.querySelector<HTMLElement>('.su-vital-gauge__value-button')
    ;(gauge ?? box?.querySelector<HTMLElement>('button'))?.focus()
    setToCrawler(false)
  }, [toCrawler, tab, wide, crawlerName])

  const nodes: Record<MediatorPane, ReactNode> = {
    // The Feed under the Table, on a phone and a desk alike:
    // the Mediator's landing pane reads who is here and what just happened,
    // and the column under the seats is never empty.
    table: (
      <>
        {/* From `lg` the seats scroll over the Feed, which keeps its head and
            scrolls its own lines (`frame.css`, r2 I2). */}
        <div className="su-play-split__main">
          <PlayMediatorTable
            mediator={mediator}
            picked={picked}
            onPick={(seat) => {
              setPicked(seat.aimId)
              setTab('propose')
              setFocusTo(true)
            }}
          />
        </div>
        <PlayFeedSection side={side} idPrefix="mediate" canWrite={mediator.canWrite} own />
      </>
    ),
    opposition: running ? (
      <PlayMediatorDowntime mediator={mediator} rollFor={rollFor} />
    ) : (
      <PlayMediatorOpposition
        mediator={mediator}
        rollFor={rollFor}
        hit={{ targets: proposalTargets(mediator.crew), onPropose: mediator.propose }}
        // On a phone the Briefing and Notes sit with the encounter (r4 D3).
        notes={wide ? undefined : <RunningNotes mediator={mediator} />}
      />
    ),
    // Private rolls sits where the rolls are (r2 B2): the Rolls pane's head,
    // which is the phone's Rolls tab.
    tables: (
      <MediatorTablesAndFeed
        mediator={mediator}
        side={side}
        // The Opposition tab holds them on a phone; Downtime takes that tab.
        notes={wide || running}
        actions={
          <Toggle size="compact" pressed={privately} onClick={togglePrivately}>
            {playCopy('privateRolls')}
          </Toggle>
        }
      />
    ),
    // The Reference beside the board (the player's `SrdExplorer`), so a rule is read
    // without covering the seats; a phone opens it from the ⋯. Shut until
    // asked for, so Propose is on the first screen (r2 I2).
    rules: <SrdExplorer fold="closed" />,
    // The session plan and Game notes from Prep, beside the board (r6 B7); a phone opens them from the ⋯.
    plan: (
      <Suspense fallback={null}>
        <MediatorPlan gameId={mediator.gameId} canWrite={mediator.canWrite} />
      </Suspense>
    ),
    propose: (
      <PlayMediatorProposeSection
        mediator={mediator}
        targetId={picked}
        onTarget={setPicked}
        toRef={toRef}
        onCrawler={() => {
          setTab('table')
          setToCrawler(true)
        }}
      />
    ),
  }

  return (
    <PrivateRolls.Provider value={privately}>
      <FoldRolledTables.Provider value={true}>
        <PlayFrame
          wide={wide}
          labels={[
            playCopy('theTable'),
            running ? playCopy('downtimeWord') : playCopy('opposition'),
            playCopy('rollsRulesAndPropose'),
          ]}
          bar={
            <>
              <PlayBar
                title={gameName}
                backHref={gamePath(gameId)}
                backLabel={playCopy('game')}
                // A phone's bar is one line (U3): its tabs (Table, Opposition,
                // Propose) say whose screen it is, so the role stamp is the canvas's.
                stamp={wide ? 'Mediator' : undefined}
                // A phone's bar is one line: its pinned row carries the Scene.
                scene={wide ? sceneOn : undefined}
                short={!wide}
                tone={PHASE_TONE[running ? 'downtime' : 'scene']}
                paused={sign?.shown === true}
                live={status === 'live'}
                here={mediator.crew === null ? null : here}
                of={mediator.crew === null ? null : of}
                readOnly={mediator.readOnly}
                situation={
                  wide ? (
                    <PlayGameStateSwitch
                      downtime={mediator.downtime}
                      canWrite={mediator.canWrite}
                      gameId={mediator.gameId}
                    />
                  ) : undefined
                }
                channel={channel.button}
                stop={<StopSignButton sign={sign} compact={!wide} />}
                menu={
                  <PlayMediatorBarActions mediator={mediator} wide={wide} channel={channel.row} />
                }
              />
              {channel.dialog}
            </>
          }
          pinned={
            <>
              <PlayGameStateSwitch
                downtime={mediator.downtime}
                canWrite={mediator.canWrite}
                gameId={mediator.gameId}
                fill
              />
              {sceneOn && <Stat size="mini" label={mediatorCopy('scene')} value={sceneNames} />}
            </>
          }
          panes={mediatorPanes(running, wide).map((p) => ({ ...p, node: nodes[p.value] }))}
          tab={tab}
          onTab={setTab}
          // The first unit's HP was 27 Tabs from the top (r4 D6). Four jumps,
          // whatever the size of the fight (r6 B11): the Opposition's lands on its
          // heading, which leads into its own list of units (`OppositionJumps`).
          jumps={[
            { pane: 'table', label: playCopy('theTable') },
            {
              pane: 'opposition',
              label: running ? playCopy('downtimeWord') : playCopy('opposition'),
              ...(running ? {} : { first: '#mediate-opposition' }),
            },
            { pane: 'tables', label: playCopy('rolls') },
            { pane: 'table', label: playCopy('feed'), first: '#mediate-feed' },
          ]}
          foot={
            <PlayFoot
              solo={false}
              tone={PHASE_TONE[running ? 'downtime' : 'scene']}
              note={session?.live ? playCopy('sessionLive') : undefined}
            />
          }
        />
      </FoldRolledTables.Provider>
    </PrivateRolls.Provider>
  )
}
