/**
 * PlayMediatorPhone — the Mediator's Play screen below the canvas's floor
 * (play.md §11, ADR-051 §10): `PlayPhone` with the Mediator's tabs.
 *
 *  - **Table** — the seats and the crawler (`PlayMediatorTable`).
 *  - **Opposition** — the Opposition and the chosen NPC's actions
 *    (`PlayMediatorOpposition`); while Downtime runs the tab reads Downtime
 *    and holds the step track and its controls (`PlayMediatorDowntime`), as
 *    the canvas's centre does.
 *  - **Tables** — the Tables and the Feed (`PlayMediatorTablesSection`,
 *    `PlayMediatorFeedSection`).
 *  - **Propose** — the dock and All proposals (`PlayMediatorProposeSection`).
 *
 * Pinned above them: the Scene / Downtime switch. A seat tapped on the Table
 * tab aims Propose, opens its tab and puts focus in its To field, as the
 * canvas does across its columns. `usePlayMediatorSide` is read here, once, so
 * the roll dispatch runs whichever tab is open.
 */

import type { ReactNode, RefObject } from 'react'
import { useEffect, useState } from 'react'
import type { rollForTable } from '../index'
import type { PlayBinding } from './channels.model'
import { PlayGameStateSwitch } from './mediator/PlayGameStateSwitch'
import { PlayMediatorDowntime } from './mediator/PlayMediatorDowntime'
import { PlayMediatorOpposition } from './mediator/PlayMediatorOpposition'
import {
  PlayMediatorFeedSection,
  PlayMediatorProposeSection,
  PlayMediatorTablesSection,
} from './mediator/PlayMediatorSide'
import { PlayMediatorTable } from './mediator/PlayMediatorTable'
import type { PlayMediator } from './mediator/usePlayMediator'
import { usePlayMediatorSide } from './mediator/usePlayMediatorSide'
import { PlayPhone } from './PlayPhone'
import type { MediatorPhoneTab } from './playPhone.model'
import { mediatorPhoneTabs } from './playPhone.model'

type PlayMediatorPhoneProps = {
  mediator: PlayMediator
  binding: PlayBinding | null | undefined
  /** The Play bar, in its phone form. */
  bar: ReactNode
  /** The pilot row Propose is aimed at. */
  picked: string | null
  onPick: (id: string | null) => void
  /** Propose's To field. */
  toRef: RefObject<HTMLInputElement | null>
  rollFor?: typeof rollForTable
}

export function PlayMediatorPhone({
  mediator,
  binding,
  bar,
  picked,
  onPick,
  toRef,
  rollFor,
}: PlayMediatorPhoneProps) {
  const [tab, setTab] = useState<MediatorPhoneTab>('table')
  // A seat was tapped: focus To once the Propose tab is showing it.
  const [focusTo, setFocusTo] = useState(false)
  const side = usePlayMediatorSide(mediator, binding)
  const running = mediator.downtime.downtime.running

  useEffect(() => {
    if (!focusTo || tab !== 'propose') return
    toRef.current?.focus()
    setFocusTo(false)
  }, [focusTo, tab, toRef])

  return (
    <PlayPhone
      bar={bar}
      pinned={
        <PlayGameStateSwitch downtime={mediator.downtime} canWrite={mediator.canWrite} fill />
      }
      tabs={mediatorPhoneTabs(running)}
      tab={tab}
      onTab={setTab}
      panels={{
        table: (
          <PlayMediatorTable
            mediator={mediator}
            picked={picked}
            onPick={(seat) => {
              onPick(seat.rowId)
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
        tables: (
          <>
            <PlayMediatorTablesSection mediator={mediator} side={side} />
            <PlayMediatorFeedSection mediator={mediator} side={side} />
          </>
        ),
        propose: (
          <PlayMediatorProposeSection
            mediator={mediator}
            targetId={picked}
            onTarget={onPick}
            toRef={toRef}
          />
        ),
      }}
    />
  )
}
