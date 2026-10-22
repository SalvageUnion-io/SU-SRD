/**
 * The Dataset API's address (ADR-056), a leaf with no imports so the Worker
 * can read it without pulling in the game data the endpoints emit.
 */

/** The major version the tree serves. A breaking change is a new tree, `/api/v2/`. */
export const API_VERSION = 1

/** The tree's root path, root-relative: `/api/v1`. */
export const API_V1_PATH = `/api/v${API_VERSION}`

/** One entity's v1 URL, root-relative: `/api/v1/chassis/mule.json`. */
export function apiV1ItemPath(schemaId: string, itemId: string): string {
  return `${API_V1_PATH}/${schemaId}/${itemId}.json`
}
