/**
 * useSeatAt — a pilot's seat: mount, range band, activated effects and the
 * action being resolved, read from and written to Convex
 * ([ADR-038](../../../../../docs/adr/038-dashboard-game-surface.md) §2;
 * `convex/seats.ts`).
 *
 * Every member reads the whole crew's seats through one `seats.forGame`
 * subscription, so the crew sees a pilot board, switch an effect on or roll
 * as it happens. Each write is a mutation with an optimistic update on that query, so
 * a toggle lands on screen at once rather than after the round trip; if the
 * server refuses it, Convex drops the optimistic value and the refusal is
 * shown.
 *
 * A pilot on the shelf has a solo seat (`seats.solo`, writes with `gameId`
 * null): `useSeatAt` reads either, and Play's `usePlaySeat` picks which.
 *
 * ## When there is no seat to read
 *
 * Outside a Game without the solo seat, or before the first answer arrives,
 * the seat reads as the default: on foot, at Close, with nothing switched on.
 *
 * Offline the subscription keeps the last answer it had, and writes are
 * refused here rather than handed to the Convex client, which would queue them
 * until the connection returns. Disconnected is read-only, not a write queue
 * (ADR-030 §1).
 */

import type { RangeBand, SeatMount, SeatResolving } from 'cantina-domain/schemas/seat'
import type { OptimisticLocalStore } from 'convex/browser'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { ConnectionState } from '../../lib/connection/connectionContext'
import { useConnection } from '../../lib/connection/connectionContext'
import { serverMessage } from '../../lib/connection/serverError'
import { reportWriteFailure } from '../../lib/runWrite'
import { WritesBlockedOffline } from '../../stores/entityBackend'
import { toast } from '../index'

/** What Play reads off a seat. */
export type SeatView = {
  mount: SeatMount
  range: RangeBand
  /** Refs of the activated contributions that are switched on (ADR-029 §4). */
  activeEffects: string[]
  /** The deck action being resolved, or null when none is. */
  resolving: SeatResolving | null
}

export type SeatHandle = {
  seat: SeatView
  board: (mechId: string) => void
  /**
   * Claim an unclaimed spare (`ownership.claim`, by its Convex row id), then
   * board it. The seat is written only once the claim has landed, so a refused
   * claim leaves it as it was. It draws no `mech-to-pilot` link (ADR-038 §5).
   * The caller confirms first.
   */
  claimAndBoard: (mech: { mechId: string; serverId: string }) => void
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

/**
 * Which entity the seat runs: the boarded mech, the pilot on foot, or the
 * crawler in Downtime. Derived, never stored: mount comes from the seat, and
 * Downtime from the Game's `downtime` row (`useDowntime`).
 */
export type MountState = 'mech' | 'pilot' | 'downtime'

/** A pilot with no seat row: on foot, at Close, nothing switched on or resolving. */
export const DEFAULT_SEAT: SeatView = {
  mount: { kind: 'foot' },
  range: 'Close',
  activeEffects: [],
  resolving: null,
}

type SeatRow = SeatView & { pilotId: string }

/**
 * Apply a change to one pilot's seat in its cached answer: the Game's
 * `forGame` list, or (`gameId` null) the pilot's `solo` seat.
 */
function patchCachedSeat(
  store: OptimisticLocalStore,
  gameId: Id<'games'> | null,
  pilotId: string,
  change: (seat: SeatRow) => Partial<SeatView>
): void {
  if (gameId === null) {
    const solo = store.getQuery(api.seats.solo, { pilotId })
    if (solo === undefined || solo === null) return
    store.setQuery(api.seats.solo, { pilotId }, { ...solo, ...change(solo) })
    return
  }
  const seats = store.getQuery(api.seats.forGame, { gameId })
  if (seats === undefined) return
  store.setQuery(
    api.seats.forGame,
    { gameId },
    seats.map((seat) => (seat.pilotId === pilotId ? { ...seat, ...change(seat) } : seat))
  )
}

/**
 * A move to `mount`, as `seats.ts` makes it: a change of mount ends the resolve
 * in progress, and re-boarding the same mech does not.
 */
function remount(seat: SeatView, mount: SeatMount): Partial<SeatView> {
  const same =
    seat.mount.kind === mount.kind &&
    (mount.kind === 'foot' || (seat.mount.kind === 'boarded' && seat.mount.mechId === mount.mechId))
  return same ? { mount } : { mount, resolving: null }
}

/**
 * Show a refused Game write (a seat's, Downtime's): the server's own words
 * when it gave some.
 */
export function reportRefusedWrite(err: unknown): void {
  const refusal = serverMessage(err)
  if (refusal !== null) {
    toast(refusal)
    return
  }
  reportWriteFailure(err)
}

/** Say why a Game write (a seat's, Downtime's) cannot go now: outdated, settling or offline. */
export function reportBlockedWrite({
  mode,
  outdated,
}: Pick<ConnectionState, 'mode' | 'outdated'>): void {
  reportWriteFailure(
    new WritesBlockedOffline(outdated ? 'outdated' : mode === 'connecting' ? 'settling' : 'offline')
  )
}

/** Which seat `useSeatAt` reads and writes. */
export type SeatAddress = {
  /** The Game whose seat it is; null for none (or, with `solo`, the solo seat). */
  gameId: Id<'games'> | null
  pilotId: string | null
  /**
   * With `gameId` null, read and write the pilot's solo seat (`seats.solo`,
   * writes with `gameId` null). Without it, no Game means no seat: the
   * default, and every write a no-op.
   */
  solo: boolean
}

/**
 * One seat, a Game's or a solo one, and the writes that change it, each with
 * the same optimistic update on whichever answer holds it (`forGame` or
 * `solo`).
 */
export function useSeatAt({ gameId, pilotId, solo }: SeatAddress): SeatHandle {
  const { mode, canWrite: connectionWrites, outdated } = useConnection()
  const signedIn = mode === 'connected' || mode === 'disconnected'
  const soloSeat = solo && gameId === null

  const seats = useQuery(api.seats.forGame, signedIn && gameId !== null ? { gameId } : 'skip')
  const soloRow = useQuery(
    api.seats.solo,
    signedIn && soloSeat && pilotId !== null ? { pilotId } : 'skip'
  )

  const board = useMutation(api.seats.board).withOptimisticUpdate((store, args) => {
    patchCachedSeat(store, args.gameId, args.pilotId, (seat) =>
      remount(seat, { kind: 'boarded', mechId: args.mechId })
    )
  })
  const claim = useMutation(api.ownership.claim)
  const dismount = useMutation(api.seats.dismount).withOptimisticUpdate((store, args) => {
    patchCachedSeat(store, args.gameId, args.pilotId, (seat) => remount(seat, { kind: 'foot' }))
  })
  const eject = useMutation(api.seats.eject).withOptimisticUpdate((store, args) => {
    patchCachedSeat(store, args.gameId, args.pilotId, (seat) => remount(seat, { kind: 'foot' }))
  })
  const setRange = useMutation(api.seats.setRange).withOptimisticUpdate((store, args) => {
    patchCachedSeat(store, args.gameId, args.pilotId, () => ({ range: args.range }))
  })
  const toggleEffect = useMutation(api.seats.toggleEffect).withOptimisticUpdate((store, args) => {
    patchCachedSeat(store, args.gameId, args.pilotId, (seat) => ({
      activeEffects: seat.activeEffects.includes(args.ref)
        ? seat.activeEffects.filter((ref) => ref !== args.ref)
        : [...seat.activeEffects, args.ref],
    }))
  })
  const setResolving = useMutation(api.seats.setResolving).withOptimisticUpdate((store, args) => {
    patchCachedSeat(store, args.gameId, args.pilotId, () => ({ resolving: args.resolving }))
  })
  const clearResolving = useMutation(api.seats.clearResolving).withOptimisticUpdate(
    (store, args) => {
      patchCachedSeat(store, args.gameId, args.pilotId, () => ({ resolving: null }))
    }
  )

  // `solo` answers null for a pilot no longer on the shelf: the default seat.
  const row = soloSeat
    ? (soloRow ?? undefined)
    : pilotId === null
      ? undefined
      : seats?.find((s) => s.pilotId === pilotId)
  const seat: SeatView = row ?? DEFAULT_SEAT

  /** Send one write, or say why it cannot be sent. */
  function send(
    write: (args: { gameId: Id<'games'> | null; pilotId: string }) => Promise<unknown>
  ) {
    if (pilotId === null || (gameId === null && !soloSeat)) return
    if (!connectionWrites) {
      reportBlockedWrite({ mode, outdated })
      return
    }
    write({ gameId, pilotId }).catch(reportRefusedWrite)
  }

  return {
    seat,
    board: (mechId) => send((args) => board({ ...args, mechId })),
    claimAndBoard: ({ mechId, serverId }) =>
      send(async (args) => {
        await claim({ table: 'mechs', entityId: serverId })
        await board({ ...args, mechId })
      }),
    dismount: () => send((args) => dismount(args)),
    eject: () => send((args) => eject(args)),
    setRange: (range) => send((args) => setRange({ ...args, range })),
    toggleEffect: (ref) => send((args) => toggleEffect({ ...args, ref })),
    setResolving: (resolving) => send((args) => setResolving({ ...args, resolving })),
    clearResolving: () => send((args) => clearResolving(args)),
  }
}
