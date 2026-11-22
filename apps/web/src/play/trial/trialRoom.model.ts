/**
 * The signed-out Play trial's room (r6 F1): a stand-in for the account room,
 * held in this tab and sent nowhere (ADR-034: signed out saves nothing).
 *
 * Opening it holds one book crew's pilot, the mech assigned to them and the
 * link between in the replica's `account` scope, as the account room's
 * socket would, so Play runs over it
 * unchanged: vitals and uses are ops, which it takes (the replica holds them
 * after); the seat's acts (board, dismount, effects, the resolve) it answers
 * as the account room's `SeatTable` does, folding each seat back as a
 * `record`. Rolls are the screen's own log (`playRolls.model.ts`) and need no
 * room. Anything else (Downtime, a salvage area, a new unit) is refused with
 * its own words. Closing it lets the crew go from the replica; what was played
 * waits in memory for the pilot's Play to open again in this tab. Framework-free.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SeatMount } from 'game-domain/schemas/seat'
import { SeatResolvingSchema } from 'game-domain/schemas/seat'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { STARTER_ROSTERS } from '../../lib/starterSet/starterTemplates'
import { playTrialCopy } from '../../messages/play-trial'
import { getView, release, serve } from '../../replica/replica'
import { foldRoomMessage, holdTabRoom, RoomDeclined } from '../../replica/roomSocket'
import { setTrialWrites } from '../../replica/sync'
import { forgetTableState, serveTableState } from '../../replica/tableState'
import type { SoloSeatRead } from '../../rooms/account/soloPlay'

/** The units a trial plays: a book crew's pilot, their mech and the link between. */
export type TrialCrew = { pilot: Pilot; mechs: readonly Mech[]; links: readonly SoftLink[] }

/** A book crew's pilot, ready to try in Play, or null for any other id. */
export function trialCrew(pilotId: string): TrialCrew | null {
  for (const roster of STARTER_ROSTERS) {
    const pilot = roster.pilots.find((p) => p.id === pilotId)
    if (pilot === undefined) continue
    const links = roster.softLinks.filter((l) => l.type === 'mech-to-pilot' && l.to.id === pilot.id)
    const mechs = roster.mechs.filter((m) => links.some((l) => l.from.id === m.id))
    return { pilot, mechs, links }
  }
  return null
}

/** A seat as the account room serves it, with no solo Downtime. */
function seatOf(pilotId: string): SoloSeatRead {
  return {
    pilotId,
    mount: { kind: 'foot' },
    range: 'Close',
    activeEffects: [],
    resolving: null,
    ejected: false,
    updatedAt: null,
    downtime: null,
  }
}

type Change = (seat: SoloSeatRead, args: Record<string, unknown>) => Partial<SoloSeatRead>

/** Climbing in or out drops the resolve in progress, as the room's `remount` does. */
const remount = (seat: SoloSeatRead, mount: SeatMount): Partial<SoloSeatRead> => ({
  mount,
  ejected: false,
  ...(seat.mount.kind === mount.kind &&
  (mount.kind === 'foot' || (seat.mount.kind === 'boarded' && seat.mount.mechId === mount.mechId))
    ? {}
    : { resolving: null }),
})

/** The seat acts the trial answers, each as `rooms/seats.ts` writes it. */
const SEAT_ACTS: Record<string, Change> = {
  'seats.board': (seat, a) => remount(seat, { kind: 'boarded', mechId: String(a.mechId) }),
  'seats.dismount': (seat) => remount(seat, { kind: 'foot' }),
  'seats.eject': (seat) => ({ ...remount(seat, { kind: 'foot' }), ejected: true }),
  'seats.setRange': (_seat, a) => ({ range: a.range as SoloSeatRead['range'] }),
  'seats.toggleEffect': (seat, a) => {
    const ref = String(a.ref)
    return {
      activeEffects: seat.activeEffects.includes(ref)
        ? seat.activeEffects.filter((r) => r !== ref)
        : [...seat.activeEffects, ref],
    }
  },
  'seats.setResolving': (_seat, a) => ({ resolving: SeatResolvingSchema.parse(a.resolving) }),
  'seats.clearResolving': () => ({ resolving: null }),
}

let seat: SoloSeatRead | null = null
/**
 * What a closed trial left, by pilot: the units as played and the seat, so
 * leaving Play and coming back in this tab picks the round up again, as its
 * Feed does. A reload forgets it.
 */
const left = new Map<string, { units: (Pilot | Mech)[]; seat: SoloSeatRead }>()
let changed = false
const listeners = new Set<() => void>()

/** Whether the trial has taken a change yet: "Sign in to keep this" waits for the first. */
export const trialChanged = (): boolean => changed

export function subscribeTrial(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function noteChange(): void {
  if (changed) return
  changed = true
  for (const listener of [...listeners]) listener()
}

function act(name: string, args: unknown): Promise<unknown> {
  const change = SEAT_ACTS[name]
  if (change === undefined || seat === null) {
    return Promise.reject(new RoomDeclined(playTrialCopy('oneRound')))
  }
  seat = { ...seat, ...change(seat, args as Record<string, unknown>), updatedAt: Date.now() }
  foldRoomMessage('account', {
    type: 'record',
    table: 'seats',
    record: { appId: seat.pilotId, body: { ...seat }, updatedAt: seat.updatedAt ?? 0 },
  })
  noteChange()
  return Promise.resolve(undefined)
}

/** Open the trial for `crew`; answers its close, which leaves nothing behind. */
export function openTrial(crew: TrialCrew): () => void {
  const kept = left.get(crew.pilot.id)
  const played = (unit: Pilot | Mech) => kept?.units.find((u) => u.id === unit.id) ?? unit
  seat = kept?.seat ?? seatOf(crew.pilot.id)
  changed = kept !== undefined
  setTrialWrites(true)
  holdTabRoom({
    submit: (ops) => {
      noteChange()
      return Promise.resolve(ops.map((op) => op.id))
    },
    act,
  })
  // Held beside whatever the account scope holds, never in its place: no
  // snapshot, which would take every other row of the scope with it.
  const units = [played(crew.pilot), ...crew.mechs.map(played)]
  serve(
    'account',
    [],
    [
      ...units.map((u, i) => ({
        table: i === 0 ? ('pilot' as const) : ('mech' as const),
        row: { ...u, gameId: null },
        version: 0,
        headSeq: 0,
        owner: null,
      })),
      ...crew.links.map((l) => ({ table: 'softLink' as const, row: l, version: 0 })),
    ]
  )
  serveTableState('account', {
    seats: [{ appId: crew.pilot.id, body: { ...seat } }],
  })
  return () => {
    const view = getView()
    const now = [...view.pilots, ...view.mechs].filter(
      (u) => u.id === crew.pilot.id || crew.mechs.some((m) => m.id === u.id)
    )
    if (seat !== null) left.set(crew.pilot.id, { units: now, seat })
    for (const l of crew.links) release('account', 'softLink', l.id)
    for (const m of crew.mechs) release('account', 'mech', m.id)
    release('account', 'pilot', crew.pilot.id)
    forgetTableState('account')
    holdTabRoom(null)
    setTrialWrites(false)
    seat = null
  }
}
