/**
 * Running an encounter (ADR-059), pure: what the Game's tray gains when the
 * Mediator runs one of their shelf encounters. Shared by `mediator.runEncounter`,
 * which writes it, and its tests.
 */

import type {
  Encounter,
  EncounterGroup,
  EncounterOpponent,
  RunningEncounter,
} from '../schemas/encounter'
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
 * the tray (`taken`) and from each other. Given the encounter's `groups`, each
 * grouped opponent carries its group onto the tray; without them none does.
 */
export function trayNpcsFor(
  opposition: readonly EncounterOpponent[],
  taken: readonly string[],
  now: string,
  groups?: readonly EncounterGroup[]
): TrayNpcBody[] {
  const names = [...taken]
  return opposition.map(({ id: _id, groupId, ...opponent }) => {
    const name = instanceName(opponent.name, names)
    names.push(name)
    const group = groups?.find((g) => g.id === groupId)
    return {
      ...opponent,
      schemaVersion: 1,
      name,
      ...(group === undefined ? {} : { group: { id: group.id, name: group.name } }),
      currentHp: opponent.maxHp,
      conditions: [],
      createdAt: now,
      updatedAt: now,
    }
  })
}

/** The wave an opponent arrives in: its group's, or 1 when it fights alone. */
export function waveOf(
  opponent: Pick<EncounterOpponent, 'groupId'>,
  groups: readonly EncounterGroup[]
): number {
  if (opponent.groupId === undefined) return 1
  return groups.find((g) => g.id === opponent.groupId)?.wave ?? 1
}

/** An encounter's opposition split by wave: who arrives with it, and who is held back. */
export function splitWaves(encounter: Encounter): {
  first: EncounterOpponent[]
  held: EncounterOpponent[]
} {
  const groups = encounter.groups ?? []
  const first = encounter.opposition.filter((o) => waveOf(o, groups) === 1)
  const held = encounter.opposition.filter((o) => waveOf(o, groups) !== 1)
  return { first, held }
}

/** The names of the groups a held-back wave brings in, in the encounter's order. */
export function heldGroups(
  running: Pick<RunningEncounter, 'groups' | 'held'> | null,
  wave: number
): string[] {
  const held = new Set((running?.held ?? []).map((o) => o.groupId))
  return (running?.groups ?? []).filter((g) => g.wave === wave && held.has(g.id)).map((g) => g.name)
}

/** The held-back waves still to come, earliest first. */
export function heldWaves(running: Pick<RunningEncounter, 'groups' | 'held'>): number[] {
  const groups = running.groups ?? []
  return [...new Set((running.held ?? []).map((o) => waveOf(o, groups)))].sort((a, b) => a - b)
}

/**
 * What the Game keeps of the encounter it is running: its name, tables, notes
 * and briefing. With `waves`, also its groups and the opposition held back to
 * a later wave, for Play to bring in.
 */
export function runningFrom(
  encounter: Encounter,
  now: string,
  waves?: { held: readonly EncounterOpponent[] }
): RunningEncounter {
  const briefing = encounter.briefing?.trim() ?? ''
  const groups = encounter.groups ?? []
  return {
    encounterId: encounter.id,
    name: encounter.name,
    tables: [...encounter.tables],
    notes: encounter.notes,
    ...(briefing === '' ? {} : { briefing }),
    ...(waves === undefined || groups.length === 0 ? {} : { groups: [...groups] }),
    ...(waves === undefined || waves.held.length === 0 ? {} : { held: [...waves.held] }),
    startedAt: now,
  }
}
