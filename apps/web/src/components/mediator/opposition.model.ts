/**
 * The Opposition tab's view-model (docs/architecture/mediator-dashboard.md
 * Q9): what a tray row reads as, and how a reference entity becomes a tray
 * instance. The rules it reads — what an NPC tracks, when it is down, the
 * Morale roll — live in `src/lib/rules/opposition.ts`.
 *
 * Pure apart from the reference lookups.
 */

import type { EncounterNpc } from 'cantina-domain/schemas/encounterNpc'
import { ENCOUNTER_REF_SCHEMAS } from 'cantina-domain/schemas/encounterNpc'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import {
  findEntityBySlug,
  getEntitySlug,
  getPatterns,
  nameToSlug,
  resolveFormerSlug,
} from 'salvageunion-reference'
import type { MoraleRoll } from '../../lib/rules/opposition'
import { isDown, trackOf } from '../../lib/rules/opposition'

export type EncounterRefSchema = (typeof ENCOUNTER_REF_SCHEMAS)[number]

/** The tab the picker opens on, and what each schema is called there. */
export const OPPOSITION_SCHEMAS: ReadonlyArray<{ schema: EncounterRefSchema; label: string }> = [
  { schema: 'npcs', label: 'NPCs' },
  { schema: 'chassis', label: 'Mechs' },
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
  entity: RefEntity | null
  /**
   * The host's pattern it was drawn as: a mech pattern picked with its
   * chassis, or a row whose slug is a FORMER one that now names a pattern
   * (ADR-043), a "Hill Worm Pattern Typhon" drawn before it became Typhon's
   * "Hill Worm" pattern. `entity` is then the host, which supplies its stats.
   */
  pattern: RefObjectAnyPattern | null
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
  const picked =
    live && typeof body.refPattern === 'string' ? patternBySlug(live, body.refPattern) : null
  const maxHp = num(body.maxHp, 0)
  const currentHp = num(body.currentHp, maxHp)
  const roll = body.lastMediatorRoll as MoraleRoll | undefined
  return {
    id: row._id,
    name: typeof body.name === 'string' ? body.name : 'Unnamed',
    entity,
    pattern: picked ?? former?.pattern ?? null,
    currentHp,
    maxHp,
    statKind: body.statKind === 'sp' ? 'sp' : 'hp',
    down: isDown(currentHp, maxHp),
    lastRoll: roll && typeof roll.roll === 'number' ? roll : null,
    refSchema,
    refSlug,
  }
}

/** A host's visible patterns, the ones a tray instance can be drawn as. */
export function patternsOf(entity: RefEntity): RefObjectAnyPattern[] {
  return getPatterns(entity) ?? []
}

/** The slug a pattern is stored by: its page's last segment. */
export function patternSlugOf(pattern: { name: string }): string {
  return nameToSlug(pattern.name)
}

function patternBySlug(entity: RefEntity, slug: string): RefObjectAnyPattern | null {
  return patternsOf(entity).find((p) => patternSlugOf(p) === slug) ?? null
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
  return getEntitySlug(entity as RefEntity)
}

/**
 * A new tray instance of a reference entity, at full HP or SP. Drawn as one of
 * its patterns, it is named for the pattern and keeps the host's stats.
 * `mediator.addNpc` mints its id and parses it.
 */
export function newTrayNpc(
  schema: EncounterRefSchema,
  entity: RefEntity,
  taken: readonly string[],
  now: string,
  pattern?: RefObjectAnyPattern
): Omit<EncounterNpc, 'id' | 'gameId'> {
  const hostName = 'name' in entity && typeof entity.name === 'string' ? entity.name : 'NPC'
  const name = pattern?.name ?? hostName
  const { maxHp, statKind } = trackOf(entity)
  return {
    schemaVersion: 1,
    refSchema: schema,
    refSlug: slugOf({ name: hostName }),
    refName: name,
    ...(pattern ? { refPattern: patternSlugOf(pattern) } : {}),
    name: instanceName(name, taken),
    currentHp: maxHp,
    maxHp,
    statKind,
    conditions: [],
    createdAt: now,
    updatedAt: now,
  }
}
