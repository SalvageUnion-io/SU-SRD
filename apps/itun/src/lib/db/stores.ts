/**
 * Object store name constants for the ITUN IndexedDB database.
 * The entity stores use `id` as the keyPath, and `meta` holds one row, keyed by
 * `id` like the entity stores, under the fixed id `cache`.
 */
export const STORE_NAMES = {
  pilots: 'pilots',
  mechs: 'mechs',
  crawlers: 'crawlers',
  npcs: 'npcs',
  softLinks: 'softLinks',
  mechPatterns: 'mechPatterns',
  encounterNpcs: 'encounterNpcs',
  // Whose rows the stores above hold (`cacheMeta.ts`).
  meta: 'meta',
} as const

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES]
