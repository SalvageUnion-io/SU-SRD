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
} as const

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES]
