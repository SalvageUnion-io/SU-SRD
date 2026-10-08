/**
 * Object store name constants for the ITUN IndexedDB database.
 * The entity stores use `id` as the keyPath, and `meta` holds one row, keyed by
 * `id` like the entity stores, under the fixed id `cache`.
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
  // v18: one row saying where the rows above came from and whose they are
  // (`cacheMeta.ts`). Keyed by `id`; the one row's id is always `cache`.
  meta: 'meta',
} as const

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES]
