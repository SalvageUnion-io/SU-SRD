import type { SeatHandle, SeatView } from '../useSeat'
import { DEFAULT_SEAT } from '../useSeat'

/** One write a component sent to the seat, by name and arguments. */
export type SeatCall = { write: keyof Omit<SeatHandle, 'seat'>; args: unknown[] }

/**
 * A seat handle for component tests: it reads `seat` and records every write
 * instead of sending it. The Convex side of the seat is tested in
 * `test/convex/seats.test.ts`, and the hook's own wiring in `useSeat.test.tsx`.
 */
export function fakeSeat(seat: Partial<SeatView> = {}): { handle: SeatHandle; calls: SeatCall[] } {
  const calls: SeatCall[] = []
  const record =
    (write: SeatCall['write']) =>
    (...args: unknown[]) => {
      calls.push({ write, args })
    }
  return {
    calls,
    handle: {
      seat: { ...DEFAULT_SEAT, ...seat },
      board: record('board'),
      dismount: record('dismount'),
      eject: record('eject'),
      setRange: record('setRange'),
      toggleEffect: record('toggleEffect'),
    },
  }
}

/** A seat boarded in `mechId`. */
export function boardedSeat(mechId: string) {
  return fakeSeat({ mount: { kind: 'boarded', mechId } })
}
