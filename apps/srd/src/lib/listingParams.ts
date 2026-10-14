/**
 * Where a listing keeps its state outside React: the URL query a filtered
 * view rides (bookmarkable, shareable, kept on back-navigation) and the
 * reader's stored view choice. Free of React, so the client entry can ask
 * whether a listing must mount at once (`runtime/mountNow.ts`) without
 * loading the island.
 */

/** The query keys of a filtered listing. */
export const PARAM_TECH_LEVEL = 'tl'
export const PARAM_SOURCE = 'source'
export const PARAM_TREE = 'tree'
export const PARAM_NAME = 'q'
/** A shared link's view: `?view=catalog` or `?view=tree`. */
export const PARAM_VIEW = 'view'

/** Every key a listing reads from the URL. */
export const LISTING_PARAMS: readonly string[] = [
  PARAM_TECH_LEVEL,
  PARAM_SOURCE,
  PARAM_TREE,
  PARAM_NAME,
  PARAM_VIEW,
]

/** The reader's last explicit view choice on a listing, kept across visits. */
export function listingViewStorageKey(schemaId: string): string {
  return `srd:listing-view:${schemaId}`
}
