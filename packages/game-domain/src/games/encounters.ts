/**
 * Running an encounter (ADR-058), pure: what the Game's tray gains when the
 * Mediator runs one of their shelf encounters. Shared by `mediator.runEncounter`,
 * which writes it, and its tests.
 */

import type { Encounter, EncounterOpponent, RunningEncounter } from '../schemas/encounter'
import type { EncounterNpc } from '../schemas/encounterNpc'

/** "Raider Band", or "Raider Band 2" when the tray already has one. */
export function instanceName(refName: string, taken: readonly string[]): string {
  const names = new Set(taken)
  if (!names.has(refName)) return refName
  let n = 2
  while (names.has(`${refName} ${n}`)) n += 1
  return `${refName} ${n}`
}

/** A tray NPC as `mediator.addNpc` takes it: no id or Game, which the server sets. */
export type TrayNpcBody = Omit<EncounterNpc, 'id' | 'gameId'>

/**
 * The opposition an encounter fields, as fresh tray NPCs: each at full HP or
 * SP, with no conditions or rolls, and named apart from the names already on
 * the tray (`taken`) and from each other.
 */
export function trayNpcsFor(
  opposition: readonly EncounterOpponent[],
  taken: readonly string[],
  now: string
): TrayNpcBody[] {
  const names = [...taken]
  return opposition.map(({ id: _id, ...opponent }) => {
    const name = instanceName(opponent.name, names)
    names.push(name)
    return {
      ...opponent,
      schemaVersion: 1,
      name,
      currentHp: opponent.maxHp,
      conditions: [],
      createdAt: now,
      updatedAt: now,
    }
  })
}

/** What the Game keeps of the encounter it is running: its name, tables and notes. */
export function runningFrom(encounter: Encounter, now: string): RunningEncounter {
  return {
    encounterId: encounter.id,
    name: encounter.name,
    tables: [...encounter.tables],
    notes: encounter.notes,
    startedAt: now,
  }
}
