/**
 * An encounter's view-model (ADR-053), pure: its address, a blank one, and the
 * edits the encounter page makes to its opposition and its tables. The
 * opposition is drawn with the Opposition's own model (`opposition.model.ts`),
 * so an encounter fields exactly what Play's + Add would.
 */

import type { TrayNpcBody } from 'game-domain/games/encounters'
import type { Encounter, EncounterOpponent } from 'game-domain/schemas/encounter'
import {
  ENCOUNTER_MAX_NAME,
  ENCOUNTER_MAX_OPPOSITION,
  ENCOUNTER_MAX_TABLES,
} from 'game-domain/schemas/encounter'
import { copyName } from '../../lib/copyEntity'
import type { TrayNpc } from '../../play/mediator/opposition.model'
import { readTrayNpc } from '../../play/mediator/opposition.model'
import type { EncounterCreateInput } from '../../stores/prepStore'

/** An encounter's page, in the Training Bay. */
export function encounterHref(encounterId: string): string {
  return `/encounters/${encounterId}`
}

/** What + New encounter makes: a name and nothing yet. */
export function blankEncounter(name = 'New encounter'): EncounterCreateInput {
  return { schemaVersion: 1, name, opposition: [], tables: [], notes: '' }
}

/** Make a copy: everything but its name, which says it is a copy (and still fits). */
export function encounterCopy(encounter: Encounter): EncounterCreateInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = encounter
  return { ...rest, name: copyName(encounter.name).slice(0, ENCOUNTER_MAX_NAME) }
}

/**
 * A tray NPC the picker drew, as the encounter keeps it: without the live
 * state a fight gives it, under an id of its own.
 */
export function opponentFrom(npc: TrayNpcBody, id: string): EncounterOpponent {
  return {
    id,
    refSchema: npc.refSchema,
    refSlug: npc.refSlug,
    refName: npc.refName,
    ...(npc.refPattern === undefined ? {} : { refPattern: npc.refPattern }),
    ...(npc.userPattern === undefined ? {} : { userPattern: npc.userPattern }),
    name: npc.name,
    maxHp: npc.maxHp,
    statKind: npc.statKind,
  }
}

/** Whether another opponent fits. */
export function hasRoomFor(encounter: Pick<Encounter, 'opposition'>): boolean {
  return encounter.opposition.length < ENCOUNTER_MAX_OPPOSITION
}

/** An opponent read the way the Opposition reads a tray row, at full HP or SP. */
export function opponentAsTray(opponent: EncounterOpponent): TrayNpc {
  return readTrayNpc({ _id: opponent.id, body: { ...opponent, currentHp: opponent.maxHp } })
}

/** The tables with `name` pinned last, once; unchanged when it is pinned or there is no room. */
export function pinTable(tables: readonly string[], name: string): string[] {
  if (tables.includes(name) || tables.length >= ENCOUNTER_MAX_TABLES) return [...tables]
  return [...tables, name]
}

/** The tables without `name`. */
export function unpinTable(tables: readonly string[], name: string): string[] {
  return tables.filter((t) => t !== name)
}
