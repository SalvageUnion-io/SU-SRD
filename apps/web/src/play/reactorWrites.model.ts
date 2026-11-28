/**
 * The reactor's writes in Play, shared by the Reactor row (`PlayReactorRow`)
 * and the action resolve's Push (`useActionsDeck`), so a Push, its harm to a
 * Bio-Chassis's pilot and a confirmed Meltdown are written one way.
 *
 * Each write goes through `runWrite`, and what follows a Push (the pilot's
 * harm, the readout, a Meltdown prompt) waits for the mech's write to land:
 * a refused Push says so once and shows nothing it did not do.
 */

import { hasCondition, withCondition } from 'game-domain/mechConditions'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { HeatCheckEffect, Roll } from 'salvageunion-reference/rules'
import { mechPush, pilotOverloadPatch } from '../lib/rules/actionPatches'
import { runWrite } from '../lib/runWrite'
import { playCopy } from '../messages/play'
import { PLAY_TXN } from '../replica/provenance'
import type { PlayStore } from './play.model'
import { recordPlayChange } from './playRolls.model'

type Store = Pick<PlayStore, 'get' | 'update'>

/** The crawler the pilot crews: its Tech Level sets their max HP (Stat Training). */
type Crew = { pilot: Pilot | null; crawler: Pick<Crawler, 'techLevel'> | null }

/** What a Push came to (`mechPush`). */
export type Pushed = NonNullable<ReturnType<typeof mechPush>>

/** A Bio-Chassis overload's harm to the pilot aboard, written to the pilot. */
export function hurtPilot(store: Store, { pilot, crawler }: Crew, effect: HeatCheckEffect): void {
  if (pilot === null) return
  const patch = pilotOverloadPatch(store.get('pilot', pilot.id) ?? pilot, crawler, effect)
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
    crawler,
    roll,
    heatScale,
  }: Crew & { store: Store; mech: Mech; roll: Roll; heatScale: number },
  onApplied: (pushed: Pushed) => void
): Pushed | null {
  const pushed = mechPush(store.get('mech', mech.id) ?? mech, pilot?.abilities, roll, heatScale)
  if (pushed === null) return null
  runWrite(
    () => store.update('mech', mech.id, pushed.patch, PLAY_TXN),
    () => {
      hurtPilot(store, { pilot, crawler }, pushed.effect)
      if (pushed.effect.shutdown) noteShutdown(mech.name)
      onApplied(pushed)
    }
  )
  return pushed
}

/** A mech's power, as its unit card and the phone's vitals say it (r7 B2). */
export type ReactorState = 'shutdown' | 'vulnerable'

/** The chips a mech's conditions put on its card: Shut down, then Vulnerable. */
export function reactorStates(conditions: readonly string[]): ReactorState[] {
  return [
    ...(hasCondition(conditions, 'Shutdown') ? (['shutdown'] as const) : []),
    ...(hasCondition(conditions, 'Vulnerable') ? (['vulnerable'] as const) : []),
  ]
}

/** Each state's chip. */
export const REACTOR_STATE_TEXT: Record<ReactorState, string> = {
  shutdown: playCopy('shutDown'),
  vulnerable: playCopy('vulnerable'),
}

/** The Feed's line, when a Heat Check shut the mech down: its time is when (r7 B2). */
export function noteShutdown(mechName: string): void {
  recordPlayChange(`${playCopy('shutDown')} · ${mechName}`)
}

/**
 * Power the mech back on (Core Book p.235: it re-activates at the end of the
 * next turn): Shutdown and the Vulnerable it brought go, and the Feed says so.
 */
export function powerBackOn(store: Store, mech: Pick<Mech, 'id' | 'name' | 'conditions'>): void {
  runWrite(
    () => {
      const conditions = store.get('mech', mech.id)?.conditions ?? mech.conditions
      const off = withCondition(withCondition(conditions, 'Shutdown', false), 'Vulnerable', false)
      return store.update('mech', mech.id, { conditions: off }, PLAY_TXN)
    },
    () => recordPlayChange(`${playCopy('powerBackOn')} · ${mech.name}`)
  )
}

/** The player's half of a Meltdown: mark the mech Destroyed (ADR-007). */
export function confirmMeltdown(store: Store, mechId: string, onApplied: () => void): void {
  runWrite(() => {
    const conditions = store.get('mech', mechId)?.conditions ?? []
    return store.update(
      'mech',
      mechId,
      { conditions: withCondition(conditions, 'Destroyed', true) },
      PLAY_TXN
    )
  }, onApplied)
}
