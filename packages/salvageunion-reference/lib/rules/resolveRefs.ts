/**
 * Canonical resolution of stored entity refs against the reference ORM.
 *
 * Mech records store SLUG references (chassisRef, systems[], modules[]) into
 * salvageunion-reference — the same convention as pilot `classRef` and
 * encounter-NPC `refSlug`, and the repo-wide "entity links use slugs" rule.
 * Records written before the v6 IndexedDB migration (and snapshots published
 * by older clients) may still carry display NAMES, so every resolver here is
 * tolerant: it matches by slug first, then by name, then by id. Unresolvable
 * refs (renamed reference entities, foreign snapshot data) return null and
 * callers degrade gracefully — never throw.
 *
 * All functions are pure and synchronous; reference data must be preloaded
 * (the app root's GameDataReady gate guarantees this).
 */

import { SalvageUnionReference } from '../index.js'
import { nameToSlug } from '../slug.js'

type RefEntity = { id: string; name?: string }

/** True when `ref` (slug, name, or id) identifies `entity`. */
export function matchesRef(entity: RefEntity, ref: string): boolean {
  if (entity.id === ref) return true
  if (!entity.name) return false
  return entity.name === ref || nameToSlug(entity.name) === ref
}

/**
 * Lookups go through `BaseModel`'s own id / name / slug indexes, which every
 * model builds once and shares with every other caller. This module used to
 * keep a private per-model `Map` of its own (id+name+slug in one map, behind a
 * `WeakMap`); that map moved into `BaseModel` so the ~20 other name-scanning
 * call sites across the apps get the same O(1) path instead of re-scanning the
 * full Systems+Modules catalogs once per installed ref per render.
 *
 * Precedence is id, then name, then slug. That is a different tie-break from
 * the old single map (which answered with whichever ROW came first in data
 * order, whatever field it matched on), so it is verified rather than assumed:
 * `BaseModel.indexes.test.ts` reconstructs the combined map for every schema
 * and asserts the two resolve every key to the same row.
 * A throw from an unloaded schema propagates as before.
 */
type ModelLike<T extends RefEntity> = {
  getById: (id: string) => T | undefined
  getByName: (name: string) => T | undefined
  getBySlug: (slug: string) => T | undefined
}

function resolveVia<T extends RefEntity>(model: ModelLike<T>, ref: string): T | null {
  return model.getById(ref) ?? model.getByName(ref) ?? model.getBySlug(ref) ?? null
}

/** Resolve a mech `chassisRef` (slug; legacy name/id tolerated). */
export function resolveChassisRef(ref: string) {
  return resolveVia(SalvageUnionReference.Chassis, ref)
}

/** Resolve an installed system ref (slug; legacy name/id tolerated). */
export function resolveSystemRef(ref: string) {
  return resolveVia(SalvageUnionReference.Systems, ref)
}

/** Resolve an installed module ref (slug; legacy name/id tolerated). */
export function resolveModuleRef(ref: string) {
  return resolveVia(SalvageUnionReference.Modules, ref)
}

/**
 * Resolve an installed system-or-module ref — systems win a (theoretical)
 * cross-schema name collision, matching the historical lookup order.
 */
export function resolveInstalledRef(ref: string) {
  return resolveSystemRef(ref) ?? resolveModuleRef(ref)
}
