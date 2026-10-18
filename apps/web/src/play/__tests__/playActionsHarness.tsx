/**
 * A stand-in `Play` for the Actions column's tests: the seat's `resolving`,
 * its mount and the Downtime step held in component state, as the optimistic
 * updates hold them, and every write recorded by name. The column is
 * rendered with an injected store and dice, as `useActionsDeck`'s tests do.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SeatResolving } from 'game-domain/schemas/seat'
import { useState } from 'react'
import type { rollForTable } from '../../components/index'
import { EntityHrefProvider } from '../../components/index'
import type { BoardOption } from '../boardMenu.model'
import { PlayActionsColumn } from '../PlayActionsColumn'
import type { PlayStore } from '../play.model'
import type { Play, Situation } from '../situation.model'
import { DEFAULT_SEAT } from '../useSeat'

/** One write the column sent, by name. */
export type Write = { name: string; args?: unknown }

type Member = { userId: string; displayName: string }

type HarnessProps = {
  pilot: Pilot
  mech?: Mech | null
  situation: Situation
  store: PlayStore
  rollFor?: typeof rollForTable
  gameId?: string | null
  mediator?: boolean
  initialResolving?: SeatResolving | null
  /** The seat's boarded mech, when it is not `mech` (one the store cannot find). */
  boardedMechId?: string
  downtime?: {
    stepIndex: number
    members?: Member[]
    done?: Member[]
    /** The steps the server already records claimed for this pilot (as after a reload). */
    doneSteps?: number[]
  }
  spendUpkeep?: () => Promise<boolean>
  canWrite?: boolean
  writes: Write[]
}

/** The viewer, as `account.me` answers in a Game. */
const ME = 'u-me'

/** Every die shows 14: a Core Mechanic Success. */
export const rollFourteen: typeof rollForTable = async () => () => 14

/** The stand-in `Play` itself, for a test that renders more than the Actions column. */
export function useHarnessPlay({
  pilot,
  mech = null,
  situation: initialSituation,
  gameId = null,
  mediator = false,
  initialResolving = null,
  boardedMechId: boardedOverride,
  downtime,
  spendUpkeep = async () => true,
  canWrite = true,
  writes,
}: Omit<HarnessProps, 'store' | 'rollFor'>): Play {
  const [resolving, setResolving] = useState<SeatResolving | null>(initialResolving)
  const [situation, setSituation] = useState<Situation>(initialSituation)
  const [stepIndex, setStepIndex] = useState(downtime?.stepIndex ?? 0)
  const [done, setDone] = useState<Member[]>(downtime?.done ?? [])
  const [doneSteps, setDoneSteps] = useState<readonly number[]>(downtime?.doneSteps ?? [])
  const record = (name: string, args?: unknown) => {
    writes.push(args === undefined ? { name } : { name, args })
  }
  const boardedMechId =
    situation !== 'boarded' ? null : (boardedOverride ?? (mech ? mech.id : null))
  const options: BoardOption[] = mech
    ? [{ mechId: mech.id, serverId: null, name: mech.name, state: 'yours', note: null }]
    : []
  const solo = gameId === null
  const members = downtime?.members ?? []

  const play: Play = {
    target: { pilotId: pilot.id, gameId, gameName: solo ? null : 'The Rust Belt Run', mediator },
    pilot,
    situation,
    boardedMech: boardedMechId === null || boardedMechId !== mech?.id ? null : mech,
    boardedMechId,
    mechs: options,
    setOnFoot: () => {
      record('setOnFoot')
      setSituation('onFoot')
    },
    board: (mechId) => {
      record('board', mechId)
      setSituation('boarded')
    },
    claimAndBoard: (option) => record('claimAndBoard', option.mechId),
    canChangeDowntime: solo || mediator,
    startDowntime: () => record('startDowntime'),
    endDowntime: () => record('endDowntime'),
    seat: {
      seat: {
        ...DEFAULT_SEAT,
        mount:
          boardedMechId === null ? { kind: 'foot' } : { kind: 'boarded', mechId: boardedMechId },
        range: 'Close',
        resolving,
      },
      board: (mechId) => record('seat.board', mechId),
      claimAndBoard: () => record('seat.claimAndBoard'),
      dismount: () => record('seat.dismount'),
      eject: () => record('seat.eject'),
      setRange: (next) => record('seat.setRange', next),
      toggleEffect: (ref) => record('seat.toggleEffect', ref),
      setResolving: (next) => {
        record('seat.setResolving', next)
        setResolving(next)
      },
      clearResolving: () => {
        record('seat.clearResolving')
        setResolving(null)
      },
    },
    downtime: {
      downtime: {
        running: situation === 'downtime',
        stepIndex: situation === 'downtime' ? stepIndex : null,
        completedBy: done,
        upkeepSpent: false,
        members,
      },
      locked: !solo && !mediator,
      begin: () => record('downtime.begin'),
      advance: () => {
        record('downtime.advance')
        setStepIndex((i) => i + 1)
        setDone([])
      },
      setStep: solo
        ? (i) => {
            record('downtime.setStep', i)
            setStepIndex(i)
          }
        : null,
      end: () => record('downtime.end'),
      markDone: solo
        ? null
        : (isDone) => {
            record('downtime.markDone', isDone)
            const self = members.find((m) => m.userId === ME) ?? { userId: ME, displayName: 'Me' }
            setDone((d) => (isDone ? [...d, self] : d.filter((m) => m.userId !== ME)))
          },
      doneSteps,
      markStepDone: async (i) => {
        record('downtime.markStepDone', i)
        if (doneSteps.includes(i)) return false
        setDoneSteps((d) => [...d, i])
        return true
      },
      spendUpkeep: async () => {
        record('downtime.spendUpkeep')
        return spendUpkeep()
      },
    },
    canWrite,
    readOnly: canWrite ? null : { stamp: 'Read-only', says: 'Read-only.' },
  }
  return play
}

export function Harness({ store, rollFor = rollFourteen, ...props }: HarnessProps) {
  const play = useHarnessPlay(props)
  return (
    <EntityHrefProvider value={() => undefined}>
      <PlayActionsColumn target={play.target} play={play} store={store} rollFor={rollFor} />
    </EntityHrefProvider>
  )
}
