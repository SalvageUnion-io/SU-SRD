/**
 * useSeat — the pilot's seat in its Game: mount, range band and activated
 * effects, read from and written to Convex
 * ([ADR-038](../../../../../docs/ARCHITECTURE.md#adr-038) §2;
 * `convex/seats.ts`).
 *
 * Every member reads the whole crew's seats through one `seats.forGame`
 * subscription, so the crew sees a pilot board or switch an effect on as it
 * happens. Each write is a mutation with an optimistic update on that query, so
 * a toggle lands on screen at once rather than after the round trip; if the
 * server refuses it, Convex drops the optimistic value and the refusal is
 * shown.
 *
 * ## When there is no seat to read
 *
 * Convex hooks need a provider, and a build with no `VITE_CONVEX_URL` mounts
 * none, so the caller checks `isConvexConfigured` first and uses `NO_SEAT`
 * without one, as `Dashboard` does. Outside a Game, or before the first answer
 * arrives, the seat reads as the default: on foot, at Close, with nothing
 * switched on.
 *
 * Offline the subscription keeps the last answer it had, and writes are
 * refused here rather than handed to the Convex client, which would queue them
 * until the connection returns. Disconnected is read-only, not a write queue
 * (ADR-030 §1).
 */

import { toast } from 'component-lib'
import type { OptimisticLocalStore } from 'convex/browser'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { serverMessage } from '../../lib/connection/serverError'
import { containerOf } from '../../lib/container'
import { reportWriteFailure } from '../../lib/runWrite'
import type { Pilot } from '../../lib/schemas/pilot'
import type { RangeBand, SeatMount } from '../../lib/schemas/seat'
import { WritesBlockedOffline } from '../../stores/entityBackend'

/** What the Dashboard reads off a seat. */
export type SeatView = {
  mount: SeatMount
  range: RangeBand
  /** Refs of the activated contributions that are switched on (ADR-029 §4). */
  activeEffects: string[]
}

export type SeatHandle = {
  seat: SeatView
  board: (mechId: string) => void
  /**
   * Claim an unclaimed spare (`ownership.claim`, by its Convex row id), then
   * board it. The seat is written only once the claim has landed, so a refused
   * claim leaves it as it was. It draws no `mech-to-pilot` link (plan D12).
   * The caller confirms first (plan §8 A4).
   */
  claimAndBoard: (mech: { mechId: string; serverId: string }) => void
  dismount: () => void
  /** The emergency exit. The caller confirms it first (ADR-007). */
  eject: () => void
  setRange: (range: RangeBand) => void
  toggleEffect: (ref: string) => void
}

/**
 * Which entity the Dashboard runs: the boarded mech, the pilot on foot, or the
 * crawler in Downtime. Derived, never stored: mount comes from the seat, and
 * Downtime from `playStateStore` until the Dashboard reads the Game's.
 */
export type MountState = 'mech' | 'pilot' | 'downtime'

/** A pilot with no seat row: on foot, at Close, nothing switched on. */
export const DEFAULT_SEAT: SeatView = {
  mount: { kind: 'foot' },
  range: 'Close',
  activeEffects: [],
}

function ignore(): void {
  // Nothing to write to: see `NO_SEAT`.
}

/**
 * The seat in a build with no deployment: the default, and nowhere to write.
 * The gate never opens the Dashboard there (that build is always Solo), but
 * tests and stories render it bare.
 */
export const NO_SEAT: SeatHandle = {
  seat: DEFAULT_SEAT,
  board: ignore,
  claimAndBoard: ignore,
  dismount: ignore,
  eject: ignore,
  setRange: ignore,
  toggleEffect: ignore,
}

type SeatRow = SeatView & { pilotId: string }

/** Apply a change to one pilot's seat in the cached `forGame` answer. */
function patchCachedSeat(
  store: OptimisticLocalStore,
  gameId: Id<'games'>,
  pilotId: string,
  change: (seat: SeatRow) => Partial<SeatView>
): void {
  const seats = store.getQuery(api.seats.forGame, { gameId })
  if (seats === undefined) return
  store.setQuery(
    api.seats.forGame,
    { gameId },
    seats.map((seat) => (seat.pilotId === pilotId ? { ...seat, ...change(seat) } : seat))
  )
}

/** Show a refused seat write: the server's own words when it gave some. */
function reportSeatFailure(err: unknown): void {
  const refusal = serverMessage(err)
  if (refusal !== null) {
    toast(refusal)
    return
  }
  reportWriteFailure(err)
}

/**
 * The pilot's seat in its Game, and the writes that change it.
 *
 * Needs a Convex provider: call it only when `isConvexConfigured`, and use
 * `NO_SEAT` otherwise.
 */
export function useSeat(pilot: Pilot | null): SeatHandle {
  const { mode, canWrite: connectionWrites } = useConnection()
  const container = pilot === null ? null : containerOf(pilot)
  const gameId = container?.kind === 'game' ? (container.gameId as Id<'games'>) : null
  const pilotId = pilot?.id ?? null
  const signedIn = mode === 'connected' || mode === 'disconnected'

  const seats = useQuery(api.seats.forGame, signedIn && gameId !== null ? { gameId } : 'skip')

  const board = useMutation(api.seats.board).withOptimisticUpdate((store, args) => {
    patchCachedSeat(store, args.gameId, args.pilotId, () => ({
      mount: { kind: 'boarded', mechId: args.mechId },
    }))
  })
  const claim = useMutation(api.ownership.claim)
  const dismount = useMutation(api.seats.dismount).withOptimisticUpdate((store, args) => {
    patchCachedSeat(store, args.gameId, args.pilotId, () => ({ mount: { kind: 'foot' } }))
  })
  const eject = useMutation(api.seats.eject).withOptimisticUpdate((store, args) => {
    patchCachedSeat(store, args.gameId, args.pilotId, () => ({ mount: { kind: 'foot' } }))
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

  const row = pilotId === null ? undefined : seats?.find((s) => s.pilotId === pilotId)
  const seat: SeatView = row ?? DEFAULT_SEAT

  /** Send one write, or say why it cannot be sent. */
  function send(write: (args: { gameId: Id<'games'>; pilotId: string }) => Promise<unknown>) {
    if (gameId === null || pilotId === null) return
    if (!connectionWrites) {
      reportWriteFailure(new WritesBlockedOffline(mode === 'connecting' ? 'settling' : 'offline'))
      return
    }
    write({ gameId, pilotId }).catch(reportSeatFailure)
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
  }
}
