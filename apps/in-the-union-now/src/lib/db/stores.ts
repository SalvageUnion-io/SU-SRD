/**
 * Object store name constants for the ITUN IndexedDB database.
 * The entity stores use `id` as the keyPath; the append-only `changeLog`
 * (provenance) store is the exception — it uses an autoIncrement `seq` key.
 */
export const STORE_NAMES = {
  pilots: 'pilots',
  mechs: 'mechs',
  crawlers: 'crawlers',
  workspaces: 'workspaces',
  softLinks: 'softLinks',
  // Wave 4 (cycle-1): patterns store. ADR in src/lib/schemas/pattern.ts.
  mechPatterns: 'mechPatterns',
  // Design-review R-5: GM encounter-tray NPC instances.
  encounterNpcs: 'encounterNpcs',
  // ADR-022: append-only per-entity Change Log (provenance). autoIncrement
  // `seq` key + a `by-entity` index — NOT keyed by `id` like the entity stores.
  changeLog: 'changeLog',
} as const

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES]
