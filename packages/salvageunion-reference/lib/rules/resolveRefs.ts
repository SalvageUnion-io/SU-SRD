/**
 * Resolution of stored entity refs against the reference ORM.
 *
 * Records store SLUG references into salvageunion-reference (the repo-wide
 * "entity links use slugs" rule): a mech's `chassisRef`, `systems` and
 * `modules`, a crawler's `type`, `crawlerBays[].bayRef` and `systems`, and a
 * pilot's `abilities` and `equipment`. Each resolver here is its model's slug
 * index and nothing else; a model without one (abilities, equipment) is read
 * with `Model.getBySlug(ref)` directly. Unresolvable refs return null and
 * callers degrade gracefully — never throw.
 *
 * All functions are pure and synchronous; reference data must be preloaded
 * (the app root's GameDataReady gate guarantees this).
 */

import { SalvageUnionReference } from '../index.js'
import type {
  SURefChassis,
  SURefCrawler,
  SURefCrawlerBay,
  SURefModule,
  SURefSystem,
} from '../schemas/index.js'

/**
 * A resolved row: the entity plus the `schemaName` `BaseModel` stamps on it.
 * The resolvers below declare it rather than letting TypeScript infer it, so
 * their emitted declarations name the entity type instead of spelling out its
 * whole structure.
 */
type Resolved<T> = (T & { schemaName: string }) | null

/** Resolve a mech `chassisRef` slug. */
export function resolveChassisRef(ref: string): Resolved<SURefChassis> {
  return SalvageUnionReference.Chassis.getBySlug(ref) ?? null
}

/** Resolve an installed system slug. */
export function resolveSystemRef(ref: string): Resolved<SURefSystem> {
  return SalvageUnionReference.Systems.getBySlug(ref) ?? null
}

/** Resolve an installed module slug. */
export function resolveModuleRef(ref: string): Resolved<SURefModule> {
  return SalvageUnionReference.Modules.getBySlug(ref) ?? null
}

/**
 * Resolve an installed system-or-module slug — systems win a (theoretical)
 * cross-schema slug collision.
 */
export function resolveInstalledRef(ref: string): Resolved<SURefSystem | SURefModule> {
  return resolveSystemRef(ref) ?? resolveModuleRef(ref)
}

/** Resolve a crawler `type` slug. */
export function resolveCrawlerRef(ref: string): Resolved<SURefCrawler> {
  return SalvageUnionReference.Crawlers.getBySlug(ref) ?? null
}

/** Resolve a crawler-bay slug (`crawlerBays[].bayRef`, the `bayChoices` keys). */
export function resolveCrawlerBayRef(ref: string): Resolved<SURefCrawlerBay> {
  return SalvageUnionReference.CrawlerBays.getBySlug(ref) ?? null
}
