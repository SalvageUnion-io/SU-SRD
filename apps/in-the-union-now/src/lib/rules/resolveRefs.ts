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

/** Resolve a mech `chassisRef` (slug; legacy name/id tolerated). */
export function resolveChassisRef(ref: string) {
  return SalvageUnionReference.Chassis.find((c) => matchesRef(c, ref)) ?? null
}

/** Resolve an installed system ref (slug; legacy name/id tolerated). */
export function resolveSystemRef(ref: string) {
  return SalvageUnionReference.Systems.find((s) => matchesRef(s, ref)) ?? null
}

/** Resolve an installed module ref (slug; legacy name/id tolerated). */
export function resolveModuleRef(ref: string) {
  return SalvageUnionReference.Modules.find((m) => matchesRef(m, ref)) ?? null
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
