/**
 * useSeatAt — a pilot's seat: mount, range band, activated effects and the
 * action being resolved
 * ([ADR-038](../../../../../docs/adr/038-dashboard-game-surface.md) §2;
 * `rooms/seats.ts`).
 *
 * Every member reads the whole crew's seats from their Game room's `seats`
 * record, so the crew sees a pilot board, switch an effect on or roll as it
 * happens. Each write is an act on that room, shown once the room answers;
 * a refusal is shown in its own words.
 *
 * A pilot on the shelf has a solo seat (`seats.solo`), kept by the player's
 * account room: `useSeatAt` reads it when `gameId` is null.
 *
 * ## When there is no seat to read
 *
 * Before the first answer arrives, or for a pilot no longer on the shelf,
 * the seat reads as the default: on foot, at Close, with nothing switched on.
 *
 * Offline the room keeps the last seat it served, and writes are refused
 * here: Disconnected is read-only, not a write queue (ADR-030 §1). The one
 * exception is a resolve's steps (r6 A14): held on the device and sent in
 * order on reconnect (`heldResolve.model.ts`); one the room refuses is said
 * on the Feed.
 */

import type { RangeBand, SeatMount, SeatResolving } from 'game-domain/schemas/seat'
import { useEffect, useReducer, useRef } from 'react'
import { useGuardedWrite } from '../lib/connection/useGuardedWrite'
import { failureMessage } from '../lib/connection/useServerAction'
import { playCopy } from '../messages/play'
import { useGamesCall } from '../replica/roomCalls'
import { isSignedIn } from '../replica/sync'
import { useSync } from '../replica/syncContext'
import { useTableAct, useTableRead } from '../replica/useTable'
import type { HeldStep } from './heldResolve.model'
import { HeldResolve } from './heldResolve.model'
import { recordPlayChange } from './playRolls.model'

/** What Play reads off a seat. */
export type SeatView = {
  mount: SeatMount
  range: RangeBand
  /** Refs of the activated contributions that are switched on (ADR-029 §4). */
  activeEffects: string[]
  /** The deck action being resolved, or null when none is. */
  resolving: SeatResolving | null
  /** A step of the resolve is held on this device, not sent yet (r6 A14). */
  held?: boolean
}

export type SeatHandle = {
  seat: SeatView
  board: (mechId: string) => void
  /**
   * Assign an unassigned spare to the player (`ownership.assign`, by its
   * row id), then board it. The seat is written only once the assignment has
   * landed, so a refused one leaves it as it was. It draws no `mech-to-pilot` link (ADR-038 §5).
   * The caller confirms first.
   */
  assignAndBoard: (mech: { mechId: string; serverId: string }) => void
  dismount: () => void
  /** The emergency exit. The caller confirms it first (ADR-007). */
  eject: () => void
  setRange: (range: RangeBand) => void
  toggleEffect: (ref: string) => void
  /** Record the resolve in progress, replacing the last step. */
  setResolving: (resolving: SeatResolving) => void
  /** The resolve is over. */
  clearResolving: () => void
}

/** A pilot with no seat row: on foot, at Close, nothing switched on or resolving. */
export const DEFAULT_SEAT: SeatView = {
  mount: { kind: 'foot' },
  range: 'Close',
  activeEffects: [],
  resolving: null,
}

/** Which seat `useSeatAt` reads and writes. */
export type SeatAddress = {
  /**
   * The Game whose seat it is; null for the pilot's solo seat (`seats.solo`,
   * written through the account room).
   */
  gameId: string | null
  pilotId: string | null
}

/**
 * The seat Play runs (play.md §3): a Game's, or with no Game the pilot's solo
 * seat, and the writes that change it, each an act on the seat's room.
 */
export function useSeatAt({ gameId, pilotId }: SeatAddress): SeatHandle {
  const { status, canWrite } = useSync()
  const signedIn = isSignedIn(status)
  const guarded = useGuardedWrite()
  const [version, changed] = useReducer((n: number) => n + 1, 0)
  const held = useRef<HeldResolve | null>(null)
  held.current ??= new HeldResolve(changed)
  const hold = held.current
  const soloSeat = gameId === null

  const seats = useTableRead('seats.forGame', signedIn && gameId !== null ? { gameId } : 'skip')
  const soloRow = useTableRead(
    'seats.solo',
    signedIn && soloSeat && pilotId !== null ? { gameId: null, pilotId } : 'skip'
  )

  const board = useTableAct('seats.board', gameId)
  const assign = useGamesCall('ownership.assign', { gameId: gameId ?? undefined })
  const dismount = useTableAct('seats.dismount', gameId)
  const eject = useTableAct('seats.eject', gameId)
  const setRange = useTableAct('seats.setRange', gameId)
  const toggleEffect = useTableAct('seats.toggleEffect', gameId)
  const setResolving = useTableAct('seats.setResolving', gameId)
  const clearResolving = useTableAct('seats.clearResolving', gameId)

  // `solo` answers null for a pilot no longer on the shelf: the default seat.
  const row = soloSeat
    ? (soloRow ?? undefined)
    : pilotId === null
      ? undefined
      : seats?.find((s) => s.pilotId === pilotId)
  const served: SeatView = row ?? DEFAULT_SEAT
  const seat: SeatView = hold.pending
    ? { ...served, resolving: hold.view(served.resolving), held: true }
    : served

  /** Send one write, or say why it cannot be sent. */
  function send(write: (args: { pilotId: string }) => Promise<unknown>) {
    if (pilotId === null) return
    guarded.send(() => write({ pilotId }))
  }

  /** A resolve's step: held offline, and behind any still held; else sent now. */
  function step(next: SeatResolving | null) {
    if (pilotId === null) return
    if (status === 'offline' || hold.pending) return hold.hold(next, served.resolving)
    if (next === null) send((args) => clearResolving(args))
    else send((args) => setResolving({ ...args, resolving: next }))
  }

  // Back online: what was held goes, oldest first, each after the step it follows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs again for each step held
  useEffect(() => {
    if (!canWrite || pilotId === null || !hold.pending) return
    const act = ({ resolving, follows }: HeldStep) =>
      resolving === null
        ? clearResolving({ pilotId, follows })
        : setResolving({ pilotId, resolving, follows })
    void hold.send(act, (refused, err) =>
      recordPlayChange(
        playCopy('heldStepRefused', {
          name: refused.resolving?.name ?? refused.follows?.name ?? '',
          reason: failureMessage(err, playCopy('heldStepRefusedReason')),
        })
      )
    )
  }, [canWrite, pilotId, version])

  return {
    seat,
    board: (mechId) => send((args) => board({ ...args, mechId })),
    assignAndBoard: ({ mechId, serverId }) =>
      send(async (args) => {
        await assign({ entityId: serverId })
        await board({ ...args, mechId })
      }),
    dismount: () => send((args) => dismount(args)),
    eject: () => send((args) => eject(args)),
    setRange: (range) => send((args) => setRange({ ...args, range })),
    toggleEffect: (ref) => send((args) => toggleEffect({ ...args, ref })),
    setResolving: (resolving) => step(resolving),
    clearResolving: () => step(null),
  }
}
