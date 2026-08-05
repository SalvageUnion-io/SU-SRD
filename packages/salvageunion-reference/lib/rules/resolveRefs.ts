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

/**
 * Resolve `ref` (slug, name, or id) against any model, through that model's
 * indexes.
 *
 * Exported because it is the indexed replacement for
 * `SomeModel.find((e) => matchesRef(e, ref))` — the shape `matchesRef` invites
 * and the largest remaining source of full-schema scans across the apps.
 * `matchesRef` stays for the cases that genuinely test a candidate you already
 * hold (selection state, counting picks); reach for this whenever you are
 * SEARCHING a model for a ref.
 */
export function resolveRef<T extends RefEntity>(model: ModelLike<T>, ref: string): T | null {
  return model.getById(ref) ?? model.getByName(ref) ?? model.getBySlug(ref) ?? null
}

/** Resolve a mech `chassisRef` (slug; legacy name/id tolerated). */
export function resolveChassisRef(ref: string) {
  return resolveRef(SalvageUnionReference.Chassis, ref)
}

/** Resolve an installed system ref (slug; legacy name/id tolerated). */
export function resolveSystemRef(ref: string) {
  return resolveRef(SalvageUnionReference.Systems, ref)
}

/** Resolve an installed module ref (slug; legacy name/id tolerated). */
export function resolveModuleRef(ref: string) {
  return resolveRef(SalvageUnionReference.Modules, ref)
}

/**
 * Resolve an installed system-or-module ref — systems win a (theoretical)
 * cross-schema name collision, matching the historical lookup order.
 */
export function resolveInstalledRef(ref: string) {
  return resolveSystemRef(ref) ?? resolveModuleRef(ref)
}

/**
 * Resolve a crawler `type` ref (slug; legacy name/id tolerated).
 *
 * Crawler refs were NEVER slug-migrated the way mech `chassisRef` was
 * (migration 6), so the app-side lookups for them were written as
 * `id === ref || name === ref` and are correct *today* purely because no slug
 * has ever reached them. That makes them a trap for whoever migrates crawler
 * refs next: the day a slug is stored, every one of those comparisons starts
 * returning undefined and the surfaces fall back to printing the raw ref —
 * exactly the failure `chassisRef` already had on the Dashboard.
 *
 * Resolving through here is slug-tolerant in advance, and indexed rather than
 * a linear scan.
 */
export function resolveCrawlerRef(ref: string) {
  return resolveRef(SalvageUnionReference.Crawlers, ref)
}

/** Resolve a crawler-bay ref (slug; legacy name/id tolerated). See `resolveCrawlerRef`. */
export function resolveCrawlerBayRef(ref: string) {
  return resolveRef(SalvageUnionReference.CrawlerBays, ref)
}

/** Resolve an action ref (slug; legacy name/id tolerated). */
export function resolveActionRef(ref: string) {
  return resolveRef(SalvageUnionReference.Actions, ref)
}

/** Resolve a pilot `classRef` (slug; legacy name/id tolerated). */
export function resolveClassRef(ref: string) {
  return resolveRef(SalvageUnionReference.Classes, ref)
}
