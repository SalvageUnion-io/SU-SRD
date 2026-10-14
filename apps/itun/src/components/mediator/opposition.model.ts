/**
 * The Opposition tab's view-model (docs/architecture/mediator-dashboard.md
 * Q9): what a tray row reads as, and how a reference entity becomes a tray
 * instance. The rules it reads — what an NPC tracks, when it is down, the
 * Morale roll — live in `itun-domain/rules/opposition`.
 *
 * Pure apart from the reference lookups.
 */

import type { MoraleRoll } from 'itun-domain/rules/opposition'
import { isDown, trackOf } from 'itun-domain/rules/opposition'
import type { EncounterNpc } from 'itun-domain/schemas/encounterNpc'
import { ENCOUNTER_REF_SCHEMAS } from 'itun-domain/schemas/encounterNpc'
import type { SURefEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { findEntityBySlug, getEntitySlug, resolveFormerSlug } from 'salvageunion-reference'

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

/** One tray row as the tab reads it. An older row may carry only a name. */
export type TrayNpc = {
  id: string
  name: string
  /** The reference entity it was drawn from, when it still resolves. */
  entity: SURefEntity | null
  /**
   * Set when the row's slug is a FORMER one that now names a pattern (ADR-043):
   * a "Hill Worm Pattern Typhon" drawn before it became Typhon's "Hill Worm"
   * pattern. `entity` is then the pattern's host, which supplies its stats.
   */
  pattern: SURefObjectAnyPattern | null
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
  const live = refSchema && refSlug ? findEntityBySlug(refSchema, refSlug) : null
  const former = !live && refSchema && refSlug ? resolveFormerSlug(refSchema, refSlug) : null
  const entity = live ?? former?.host ?? null
  const maxHp = num(body.maxHp, 0)
  const currentHp = num(body.currentHp, maxHp)
  const roll = body.lastMediatorRoll as MoraleRoll | undefined
  return {
    id: row._id,
    name: typeof body.name === 'string' ? body.name : 'Unnamed',
    entity,
    pattern: former?.pattern ?? null,
    currentHp,
    maxHp,
    statKind: body.statKind === 'sp' ? 'sp' : 'hp',
    down: isDown(currentHp, maxHp),
    lastRoll: roll && typeof roll.roll === 'number' ? roll : null,
    refSchema,
    refSlug,
  }
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
