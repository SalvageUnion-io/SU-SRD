/**
 * The reactor's writes in Play, shared by the Reactor row (`PlayReactorRow`)
 * and the action resolve's Push (`useActionsDeck`), so a Push, its harm to a
 * Bio-Chassis's pilot and a confirmed Meltdown are written one way.
 *
 * Each write goes through `runWrite`, and what follows a Push (the pilot's
 * harm, the readout, a Meltdown prompt) waits for the mech's write to land:
 * a refused Push says so once and shows nothing it did not do.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { HeatCheckEffect, Roll } from 'salvageunion-reference/rules'
import { mechPush, pilotOverloadPatch } from '../lib/rules/actionPatches'
import { runWrite } from '../lib/runWrite'
import { PLAY_TXN } from '../replica/provenance'
import type { PlayStore } from './play.model'

type Store = Pick<PlayStore, 'get' | 'update'>

/** What a Push came to (`mechPush`). */
export type Pushed = NonNullable<ReturnType<typeof mechPush>>

/** A Bio-Chassis overload's harm to the pilot aboard, written to the pilot. */
export function hurtPilot(store: Store, pilot: Pilot | null, effect: HeatCheckEffect): void {
  if (pilot === null) return
  const patch = pilotOverloadPatch(store.get('pilot', pilot.id) ?? pilot, effect)
  if (patch !== null) runWrite(() => store.update('pilot', pilot.id, patch, PLAY_TXN))
}

/**
 * Push `mech` as the store holds it now (Core Book p.234): write it, then,
 * once that lands, the pilot's harm and `onApplied`. Returns what it came to
 * at once (a roll log's outcome reads it in the same tick), or null where the
 * Push would pass the Heat Cap and nothing is written.
 */
export function pushMech(
  {
    store,
    mech,
    pilot,
    roll,
    heatScale,
  }: { store: Store; mech: Mech; pilot: Pilot | null; roll: Roll; heatScale: number },
  onApplied: (pushed: Pushed) => void
): Pushed | null {
  const pushed = mechPush(store.get('mech', mech.id) ?? mech, roll, heatScale)
  if (pushed === null) return null
  runWrite(
    () => store.update('mech', mech.id, pushed.patch, PLAY_TXN),
    () => {
      hurtPilot(store, pilot, pushed.effect)
      onApplied(pushed)
    }
  )
  return pushed
}

/** The player's half of a Meltdown: mark the mech Destroyed (ADR-007). */
export function confirmMeltdown(store: Store, mechId: string, onApplied: () => void): void {
  runWrite(() => store.update('mech', mechId, { destroyed: true }, PLAY_TXN), onApplied)
}
