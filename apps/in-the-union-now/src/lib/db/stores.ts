/**
 * Object store name constants for the ITUN IndexedDB database.
 * All stores use `id` as the keyPath.
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
} as const

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES]
