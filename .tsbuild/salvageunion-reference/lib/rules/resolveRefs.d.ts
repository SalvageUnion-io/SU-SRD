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
import type { RefChassis, RefCrawler, RefCrawlerBay, RefModule, RefSystem } from '../schemas/index';
/**
 * A resolved row: the entity plus the `schemaName` `BaseModel` stamps on it.
 * The resolvers below declare it rather than letting TypeScript infer it, so
 * their emitted declarations name the entity type instead of spelling out its
 * whole structure.
 */
type Resolved<T> = (T & {
    schemaName: string;
}) | null;
/** Resolve a mech `chassisRef` slug. */
export declare function resolveChassisRef(ref: string): Resolved<RefChassis>;
/** Resolve an installed system slug. */
export declare function resolveSystemRef(ref: string): Resolved<RefSystem>;
/** Resolve an installed module slug. */
export declare function resolveModuleRef(ref: string): Resolved<RefModule>;
/**
 * Resolve an installed system-or-module slug — systems win a (theoretical)
 * cross-schema slug collision.
 */
export declare function resolveInstalledRef(ref: string): Resolved<RefSystem | RefModule>;
/** Resolve a crawler `type` slug. */
export declare function resolveCrawlerRef(ref: string): Resolved<RefCrawler>;
/** Resolve a crawler-bay slug (`crawlerBays[].bayRef`, the `bayChoices` keys). */
export declare function resolveCrawlerBayRef(ref: string): Resolved<RefCrawlerBay>;
export {};
