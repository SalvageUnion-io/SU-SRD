import { z } from 'salvageunion-reference/zod'

/**
 * Body fields the app no longer stores. The schemas are strict, so a body
 * saved before a field was retired would stop parsing: every parse of a
 * stored body drops these first (`withoutRetired`), and the next write of
 * that body saves it without them.
 *
 * Add a field here in the change that deletes it from its schema. A name
 * stays as long as an old body can still arrive: a room that has not written
 * the unit since, a replica cache, a published copy or a backup file.
 */
export const RETIRED_FIELDS = {
  pilot: ['maxHpModifier', 'maxApModifier', 'maxInventorySlotsModifier', 'lastCriticalInjury'],
  mech: [
    'maxSpModifier',
    'maxEpModifier',
    'maxHeatModifier',
    'maxCargoModifier',
    'currentHP',
    'currentAP',
    'currentTP',
    'lastHeatCheck',
    'lastCriticalDamage',
  ],
  crawler: ['maxSpModifier'],
  npc: [],
  pattern: ['cargoLots'],
} as const satisfies Record<string, readonly string[]>

export type RetiredKind = keyof typeof RETIRED_FIELDS

/** The body without its kind's retired fields; anything that is not an object passes through. */
export function withoutRetired(kind: RetiredKind, body: unknown): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body
  const fields: readonly string[] = RETIRED_FIELDS[kind]
  if (!fields.some((field) => Object.hasOwn(body, field))) return body
  const kept: Record<string, unknown> = { ...body }
  for (const field of fields) delete kept[field]
  return kept
}

/** A stored body's schema that drops its kind's retired fields before it parses. */
export function storedSchema<T extends z.ZodType>(kind: RetiredKind, schema: T) {
  return z.preprocess((body) => withoutRetired(kind, body), schema)
}
