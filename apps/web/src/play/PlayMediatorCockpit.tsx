/**
 * PlayMediatorCockpit — the Mediator's Play screen for one Game (play.md
 * §10), on the player's layout (`PlayFrame`): Table, Opposition, Tables and
 * Propose as tabs on a phone, three columns from `lg`. Who may open it is
 * `PlayMediatorGate`'s question, asked before this renders.
 *
 *  - **Bar** — the MEDIATOR stamp, LIVE "3 of 4 here" (the seats' presence,
 *    `lastSeenAt`), the Scene / Downtime switch (`PlayGameStateSwitch`; below
 *    `lg` pinned under the bar), the channel button
 *    (`channelBindings.current`), Tell the table and ⋯.
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
 * every pane, and `usePlayMediatorSide` the side's shared state, so the roll
 * dispatch runs whichever pane is open. A seat tapped aims Propose and puts
 * focus in its To field (see the problem, propose the fix), opening its tab
 * first below `lg`. Pane headings are Slabs, never `TitledBox`es, so what a
 * pane lists stays level 1 (the Nested Frames Audit, play.md §12).
 */

import { gamePath } from 'game-domain/entityKinds'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { rollForTable } from '../components/index'
import { useConnection } from '../lib/connection/connectionContext'
import { playCopy } from '../messages/play'
import { hereOf } from './mediator/mediatorTable.model'
import { PlayGameStateSwitch } from './mediator/PlayGameStateSwitch'
import { PlayMediatorBarActions } from './mediator/PlayMediatorBarActions'
import { PlayMediatorDowntime } from './mediator/PlayMediatorDowntime'
import { PlayMediatorOpposition } from './mediator/PlayMediatorOpposition'
import { MediatorTablesAndFeed, PlayMediatorProposeSection } from './mediator/PlayMediatorSide'
import { PlayMediatorTable } from './mediator/PlayMediatorTable'
import { usePlayMediator } from './mediator/usePlayMediator'
import { usePlayMediatorSide } from './mediator/usePlayMediatorSide'
import { PlayBar } from './PlayBar'
import { PlayChannelButton } from './PlayChannel'
import { PlayFoot } from './PlayFoot'
import { PlayFrame } from './PlayFrame'
import { PHASE_TONE } from './play.model'
import type { MediatorPane } from './playPanes.model'
import { mediatorPanes } from './playPanes.model'
import { usePlayChannelBinding } from './usePlayChannel'
import { usePlayWide } from './usePlayWide'

/** The foot's reminder: what the players can see of the Opposition. */
const OPPOSITION_NOTE = 'Players see the Opposition only through what you post'

type PlayMediatorCockpitProps = {
  gameId: string
  gameName: string
  /** The dice the centre's rolls read (a test injects its own). */
  rollFor?: typeof rollForTable
}

export function PlayMediatorCockpit({ gameId, gameName, rollFor }: PlayMediatorCockpitProps) {
  const { mode } = useConnection()
  const mediator = usePlayMediator(gameId, gameName)
  const binding = usePlayChannelBinding({ gameId })
  const side = usePlayMediatorSide(mediator, binding)
  const wide = usePlayWide()
  const [tab, setTab] = useState<MediatorPane>('table')
  const [picked, setPicked] = useState<string | null>(null)
  // A seat was tapped: focus To once Propose is showing.
  const [focusTo, setFocusTo] = useState(false)
  const toRef = useRef<HTMLInputElement | null>(null)
  const { here, of } = hereOf(mediator.seats)
  const running = mediator.downtime.downtime.running

  useEffect(() => {
    if (!focusTo || (!wide && tab !== 'propose')) return
    toRef.current?.focus()
    setFocusTo(false)
  }, [focusTo, tab, wide])

  const nodes: Record<MediatorPane, ReactNode> = {
    table: (
      <PlayMediatorTable
        mediator={mediator}
        picked={picked}
        onPick={(seat) => {
          setPicked(seat.rowId)
          setTab('propose')
          setFocusTo(true)
        }}
      />
    ),
    opposition: running ? (
      <PlayMediatorDowntime mediator={mediator} rollFor={rollFor} />
    ) : (
      <PlayMediatorOpposition mediator={mediator} rollFor={rollFor} />
    ),
    tables: <MediatorTablesAndFeed mediator={mediator} side={side} />,
    propose: (
      <PlayMediatorProposeSection
        mediator={mediator}
        targetId={picked}
        onTarget={setPicked}
        toRef={toRef}
      />
    ),
  }

  return (
    <PlayFrame
      wide={wide}
      labels={['The table', running ? 'Downtime' : 'Opposition', 'Tables, Feed and Propose']}
      bar={
        <PlayBar
          title={gameName}
          backHref={gamePath(gameId)}
          backLabel={playCopy('game')}
          stamp="Mediator"
          tone={PHASE_TONE[running ? 'downtime' : 'scene']}
          live={mode === 'connected'}
          here={mediator.crew === null ? null : here}
          of={mediator.crew === null ? null : of}
          readOnly={mediator.readOnly}
          situation={
            wide ? (
              <PlayGameStateSwitch downtime={mediator.downtime} canWrite={mediator.canWrite} />
            ) : undefined
          }
          channel={
            <PlayChannelButton
              owner={{ kind: 'game', gameName }}
              binding={binding}
              compact={!wide}
            />
          }
          menu={<PlayMediatorBarActions mediator={mediator} />}
        />
      }
      pinned={
        <PlayGameStateSwitch downtime={mediator.downtime} canWrite={mediator.canWrite} fill />
      }
      panes={mediatorPanes(running).map((p) => ({ ...p, node: nodes[p.value] }))}
      tab={tab}
      onTab={setTab}
      foot={
        <PlayFoot
          solo={false}
          note={OPPOSITION_NOTE}
          tone={PHASE_TONE[running ? 'downtime' : 'scene']}
        />
      }
    />
  )
}
