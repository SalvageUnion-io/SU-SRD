/**
 * Reference-NPC candidate pools for the encounter tray (design-review R-5).
 *
 * Enumerates the six NPC-shaped reference schemas (npcs, squads, creatures,
 * bio-titans, vehicles, meld) into a uniform candidate shape the tray can
 * search, list, and add. Reads are defensive (empty when data isn't
 * preloaded, e.g. in tests) — the same discipline as SalvageControl's
 * loadRef.
 */

import { SalvageUnionReference, getEntitySlug } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'

import { ENCOUNTER_REF_SCHEMAS } from '../../lib/schemas/encounterNpc'
import type { EncounterRefSchema } from '../../lib/schemas/encounterNpc'

/** Short display label per reference schema (head-bar tag / group heading). */
export const ENCOUNTER_SCHEMA_LABEL: Record<EncounterRefSchema, string> = {
  npcs: 'NPC',
  squads: 'Squad',
  creatures: 'Creature',
  'bio-titans': 'Bio-Titan',
  vehicles: 'Vehicle',
  meld: 'Meld',
}

/** A reference entity flattened into the shape the tray needs to add it. */
export type EncounterCandidate = {
  schema: EncounterRefSchema
  entity: SURefEntity
  name: string
  slug: string
  /** HP or SP maximum read off the reference statblock (0 when absent). */
  maxHp: number
  /** Whether the track is Hit Points or Structure Points. */
  statKind: 'hp' | 'sp'
}

/** The stat fields the six schemas may carry (see entities.ts). */
type StatFields = {
  name?: unknown
  hitPoints?: unknown
  structurePoints?: unknown
  damageType?: unknown
}

function asInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
}

/**
 * Derives the max track + kind from a reference statblock. Explicit
 * `damageType` wins (NPCs/squads disambiguate HP vs SP with it); otherwise
 * `hitPoints` reads as HP and `structurePoints` as SP.
 */
export function statTrackFor(entity: unknown): { maxHp: number; statKind: 'hp' | 'sp' } {
  const fields = entity as StatFields
  const hp = asInt(fields.hitPoints)
  const sp = asInt(fields.structurePoints)
  const explicitSp = fields.damageType === 'SP'
  if (explicitSp) return { maxHp: hp ?? sp ?? 0, statKind: 'sp' }
  if (hp !== undefined) return { maxHp: hp, statKind: 'hp' }
  if (sp !== undefined) return { maxHp: sp, statKind: 'sp' }
  return { maxHp: 0, statKind: 'hp' }
}

function modelFor(schema: EncounterRefSchema): { all: () => ReadonlyArray<unknown> } {
  switch (schema) {
    case 'npcs':
      return SalvageUnionReference.NPCs
    case 'squads':
      return SalvageUnionReference.Squads
    case 'creatures':
      return SalvageUnionReference.Creatures
    case 'bio-titans':
      return SalvageUnionReference.BioTitans
    case 'vehicles':
      return SalvageUnionReference.Vehicles
    case 'meld':
      return SalvageUnionReference.Meld
  }
}

function toCandidate(schema: EncounterRefSchema, raw: unknown): EncounterCandidate | null {
  const entity = raw as SURefEntity
  const name = (raw as StatFields).name
  if (typeof name !== 'string' || name.length === 0) return null
  return {
    schema,
    entity,
    name,
    slug: getEntitySlug(entity),
    ...statTrackFor(raw),
  }
}

/** All candidates of one schema, name-sorted. Empty when data isn't loaded. */
export function listCandidates(schema: EncounterRefSchema): EncounterCandidate[] {
  let raw: ReadonlyArray<unknown>
  try {
    raw = modelFor(schema).all()
  } catch {
    return []
  }
  return raw
    .map((item) => toCandidate(schema, item))
    .filter((c): c is EncounterCandidate => c !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** All candidates across every encounter schema. */
export function listAllCandidates(): EncounterCandidate[] {
  return ENCOUNTER_REF_SCHEMAS.flatMap((schema) => listCandidates(schema))
}

/** Resolves a tracked instance's slug back to its reference entity. */
export function resolveCandidate(
  schema: EncounterRefSchema,
  slug: string
): SURefEntity | undefined {
  return listCandidates(schema).find((c) => c.slug === slug)?.entity
}
