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

import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'

type RefEntity = { id: string; name?: string }

/** True when `ref` (slug, name, or id) identifies `entity`. */
export function matchesRef(entity: RefEntity, ref: string): boolean {
  if (entity.id === ref) return true
  if (!entity.name) return false
  return entity.name === ref || nameToSlug(entity.name) === ref
}

/**
 * Lazy per-model lookup maps (audit item 18): derived-stat computations call
 * these resolvers once per installed ref per render, and the linear
 * `.find()` scans over the full Systems+Modules catalogs were the dominant
 * per-render cost on the sheet surfaces. Each map indexes id, name, AND slug
 * so every tolerated ref form is O(1). Reference data is immutable after
 * preload, so the maps build once on first successful access; a throw from
 * `.all()` (schema not yet loaded) propagates exactly like the old `.find()`
 * path and leaves the cache unbuilt for the next attempt.
 */
type ModelLike<T extends RefEntity> = { all: () => readonly T[] }

function buildRefMap<T extends RefEntity>(model: ModelLike<T>): Map<string, T> {
  const map = new Map<string, T>()
  // First writer wins on collisions, matching Array.prototype.find order.
  const claim = (key: string, entity: T) => {
    if (!map.has(key)) map.set(key, entity)
  }
  for (const entity of model.all()) {
    claim(entity.id, entity)
    if (entity.name) {
      claim(entity.name, entity)
      claim(nameToSlug(entity.name), entity)
    }
  }
  return map
}

const refMaps = new WeakMap<object, Map<string, RefEntity>>()

function resolveVia<T extends RefEntity>(model: ModelLike<T>, ref: string): T | null {
  let map = refMaps.get(model)
  if (!map) {
    map = buildRefMap(model)
    refMaps.set(model, map)
  }
  return (map.get(ref) as T | undefined) ?? null
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

/** Display name for a ref: the resolved entity's name, else the raw ref. */
export function refDisplayName(ref: string): string {
  return resolveInstalledRef(ref)?.name ?? ref
}
