/**
 * Utility functions for Salvage Union entities.
 *
 * This module is now a PURE RE-EXPORT BARREL. It used to be a 1233-line grab
 * bag holding seven unrelated jobs at once; each of those now has its own named
 * module, and the barrel stays so that every existing import keeps resolving —
 * the package barrel does `export * from './utilities.js'`, and this file's
 * export set is unchanged apart from seven deliberately-deleted dead type
 * guards (see `entityGuards.ts`).
 *
 * Where things went:
 *
 * - `entityFields.ts`     — the plain, dependency-free property extractors.
 * - `actionResolution.ts` — the cached action map and every getter that
 *                           resolves through an entity's self-action.
 * - `entityGuards.ts`     — the type guards that still have a consumer.
 * - `patterns.ts`         — patterns, the hidden-pattern rule, formations.
 * - `assets.ts`           — `ASSET_BASE_URL` + `getAssetUrl`.
 * - `traitText.ts`        — `[[Trait]]` markup parsing.
 * - `inventorySlots.ts`   — the Heavy/Portable inventory-slot rule.
 *
 * Prefer importing from those modules directly in new package-internal code;
 * consumers outside the package should keep importing from the package barrel.
 */

export * from './actionResolution.js'
export * from './assets.js'
export * from './entityFields.js'
export * from './entityGuards.js'
export * from './inventorySlots.js'
export * from './patterns.js'
export * from './traitText.js'
