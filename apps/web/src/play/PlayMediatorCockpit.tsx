/**
 * PlayMediatorCockpit — the Mediator's Play screen for one Game (play.md §10,
 * wireframes mediator-scene and mediator-downtime), on the player's frame
 * (`PlayFrame`). Who may open it is `PlayMediatorGate`'s question, asked
 * before this renders.
 *
 *  - **Bar** — the MEDIATOR stamp, LIVE "3 of 4 here" (the seats' presence,
 *    `lastSeenAt`), the Scene / Downtime switch (`PlayGameStateSwitch`), the
 *    channel button (`channelBindings.current`), Tell the table and ⋯.
 *  - **Left** — the table: a seat per player, then the crawler
 *    (`PlayMediatorTable`).
 *  - **Centre** — the Opposition and the chosen NPC's actions in a Scene
 *    (`PlayMediatorOpposition`); the step track and its controls in Downtime
 *    (`PlayMediatorDowntime`).
 *  - **Right** — Tables, Feed and the Propose dock (`PlayMediatorSide`).
 *
 * `usePlayMediator` reads the table once here and hands the same object to
 * every column. A seat tapped on the left aims Propose on the right and
 * moves focus to its To field (see the problem, propose the fix). Column
 * headings are Slabs, never `TitledBox`es, so what a column lists stays
 * level 1 (the Nested Frames Audit, play.md §12).
 *
 * Below the canvas's floor the same columns go on tabs (`PlayMediatorPhone`,
 * play.md §11): Table, Opposition, Tables, Propose under the Scene / Downtime
 * switch.
 */

import { gamePath } from 'game-domain/entityKinds'
import { useRef, useState } from 'react'
import type { rollForTable } from '../components/index'
import { useConnection } from '../lib/connection/connectionContext'
import { hereOf } from './mediator/mediatorTable.model'
import { PlayGameStateSwitch } from './mediator/PlayGameStateSwitch'
import { PlayMediatorBarActions } from './mediator/PlayMediatorBarActions'
import { PlayMediatorDowntime } from './mediator/PlayMediatorDowntime'
import { PlayMediatorOpposition } from './mediator/PlayMediatorOpposition'
import { PlayMediatorSide } from './mediator/PlayMediatorSide'
import { PlayMediatorTable } from './mediator/PlayMediatorTable'
import { usePlayMediator } from './mediator/usePlayMediator'
import { PlayBar } from './PlayBar'
import { PlayChannelButton } from './PlayChannel'
import { PlayFoot } from './PlayFoot'
import { PlayFrame } from './PlayFrame'
import { PlayMediatorPhone } from './PlayMediatorPhone'
import { usePlayChannelBinding } from './usePlayChannel'

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
  const [picked, setPicked] = useState<string | null>(null)
  const toRef = useRef<HTMLInputElement | null>(null)
  const { here, of } = hereOf(mediator.seats)
  const running = mediator.downtime.downtime.running

  const bar = (phone: boolean) => (
    <PlayBar
      phone={phone}
      title={gameName}
      backHref={gamePath(gameId)}
      backLabel="Game"
      stamp="Mediator"
      live={mode === 'connected'}
      here={mediator.crew === null ? null : here}
      of={mediator.crew === null ? null : of}
      readOnly={mediator.readOnly}
      situation={
        phone ? undefined : (
          <PlayGameStateSwitch downtime={mediator.downtime} canWrite={mediator.canWrite} />
        )
      }
      channel={
        <PlayChannelButton owner={{ kind: 'game', gameName }} binding={binding} compact={phone} />
      }
      menu={<PlayMediatorBarActions mediator={mediator} />}
    />
  )

  return (
    <PlayFrame
      labels={['The table', running ? 'Downtime' : 'Opposition', 'Tables, Feed and Propose']}
      bar={bar(false)}
      start={
        <PlayMediatorTable
          mediator={mediator}
          picked={picked}
          onPick={(seat) => {
            setPicked(seat.rowId)
            toRef.current?.focus()
          }}
        />
      }
      centre={
        running ? (
          <PlayMediatorDowntime mediator={mediator} rollFor={rollFor} />
        ) : (
          <PlayMediatorOpposition mediator={mediator} rollFor={rollFor} />
        )
      }
      end={
        <PlayMediatorSide
          mediator={mediator}
          binding={binding}
          targetId={picked}
          onTarget={setPicked}
          toRef={toRef}
        />
      }
      foot={<PlayFoot solo={false} note={OPPOSITION_NOTE} />}
      phone={
        <PlayMediatorPhone
          mediator={mediator}
          binding={binding}
          bar={bar(true)}
          picked={picked}
          onPick={setPicked}
          toRef={toRef}
          rollFor={rollFor}
        />
      }
    />
  )
}
