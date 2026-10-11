/**
 * The Opposition tab's rules (docs/architecture/mediator-dashboard.md Q9):
 * what a tray row reads as, how a reference entity becomes a tray instance,
 * and the Morale roll (Workshop Manual p.268).
 *
 * Pure apart from the reference lookups, and the die is injected, so tests
 * pick the roll.
 */

import type { SURefEntity } from 'salvageunion-reference'
import {
  findEntityBySlug,
  getEntitySlug,
  rollOnTable,
  SalvageUnionReference,
} from 'salvageunion-reference'
import type { EncounterNpc } from '../../lib/schemas/encounterNpc'
import { ENCOUNTER_REF_SCHEMAS } from '../../lib/schemas/encounterNpc'

export type EncounterRefSchema = (typeof ENCOUNTER_REF_SCHEMAS)[number]

/** The tab the picker opens on, and what each schema is called there. */
export const OPPOSITION_SCHEMAS: ReadonlyArray<{ schema: EncounterRefSchema; label: string }> = [
  { schema: 'npcs', label: 'NPCs' },
  { schema: 'squads', label: 'Squads' },
  { schema: 'creatures', label: 'Creatures' },
  { schema: 'vehicles', label: 'Vehicles' },
  { schema: 'bio-titans', label: 'Bio-Titans' },
  { schema: 'meld', label: 'Meld' },
]

type MoraleRoll = NonNullable<EncounterNpc['lastMediatorRoll']>

/** One tray row as the tab reads it. A row from before issue 1278 has only a name. */
export type TrayNpc = {
  id: string
  name: string
  /** The reference entity it was drawn from, when it still resolves. */
  entity: SURefEntity | null
  currentHp: number
  maxHp: number
  statKind: 'hp' | 'sp'
  /** At 0 HP or SP: shown as down, never removed for you (ADR-007). */
  down: boolean
  lastRoll: MoraleRoll | null
  /** The schema it came from, for the picker's counts. */
  refSchema: EncounterRefSchema | null
  refSlug: string | null
}

const isRefSchema = (value: unknown): value is EncounterRefSchema =>
  typeof value === 'string' && (ENCOUNTER_REF_SCHEMAS as readonly string[]).includes(value)

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/** Read a `mediator.npcs` row without trusting its body's shape. */
export function readTrayNpc(row: { _id: string; body: unknown }): TrayNpc {
  const body = (row.body ?? {}) as Record<string, unknown>
  const refSchema = isRefSchema(body.refSchema) ? body.refSchema : null
  const refSlug = typeof body.refSlug === 'string' ? body.refSlug : null
  const entity = refSchema && refSlug ? findEntityBySlug(refSchema, refSlug) : null
  const maxHp = num(body.maxHp, 0)
  const currentHp = num(body.currentHp, maxHp)
  const roll = body.lastMediatorRoll as MoraleRoll | undefined
  return {
    id: row._id,
    name: typeof body.name === 'string' ? body.name : 'Unnamed',
    entity,
    currentHp,
    maxHp,
    statKind: body.statKind === 'sp' ? 'sp' : 'hp',
    down: maxHp > 0 && currentHp <= 0,
    lastRoll: roll && typeof roll.roll === 'number' ? roll : null,
    refSchema,
    refSlug,
  }
}

/** A reference entity's HP or SP, whichever it tracks. */
export function trackOf(entity: SURefEntity): { maxHp: number; statKind: 'hp' | 'sp' } {
  if ('structurePoints' in entity && typeof entity.structurePoints === 'number') {
    return { maxHp: entity.structurePoints, statKind: 'sp' }
  }
  if ('hitPoints' in entity && typeof entity.hitPoints === 'number') {
    return { maxHp: entity.hitPoints, statKind: 'hp' }
  }
  return { maxHp: 0, statKind: 'hp' }
}

/** "Raider Band", or "Raider Band 2" when the tray already has one. */
export function instanceName(refName: string, taken: readonly string[]): string {
  const names = new Set(taken)
  if (!names.has(refName)) return refName
  let n = 2
  while (names.has(`${refName} ${n}`)) n += 1
  return `${refName} ${n}`
}

/** The slug a reference entity is stored by (data conventions: slugs, never ids). */
export function slugOf(entity: { name: string }): string {
  return getEntitySlug(entity as SURefEntity)
}

/**
 * A new tray instance of a reference entity, at full HP or SP. `mediator.addNpc`
 * mints its id and parses it.
 */
export function newTrayNpc(
  schema: EncounterRefSchema,
  entity: SURefEntity,
  taken: readonly string[],
  now: string
): Omit<EncounterNpc, 'id' | 'gameId'> {
  const name = 'name' in entity && typeof entity.name === 'string' ? entity.name : 'NPC'
  const { maxHp, statKind } = trackOf(entity)
  return {
    schemaVersion: 1,
    refSchema: schema,
    refSlug: slugOf({ name }),
    refName: name,
    name: instanceName(name, taken),
    currentHp: maxHp,
    maxHp,
    statKind,
    conditions: [],
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Roll Morale: a d20 on the reference "Morale" table (p.268). Null when the
 * table cannot be read, so the button says so rather than inventing a result.
 */
export function rollMorale(rollD20: () => number, now: string): MoraleRoll | null {
  const table = SalvageUnionReference.RollTables.getByName('Morale')
  const outcome = rollOnTable(table?.table, rollD20)
  if (!outcome.success || outcome.kind !== 'flat') return null
  return {
    table: 'morale',
    roll: outcome.roll,
    ...(outcome.label === undefined ? {} : { label: outcome.label }),
    value: outcome.value,
    rolledAt: now,
  }
}
