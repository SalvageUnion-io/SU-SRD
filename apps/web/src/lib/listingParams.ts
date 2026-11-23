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
/** A trait every listed entity carries: `?trait=Hot`. */
export const PARAM_TRAIT = 'trait'
/** A range band a listed entity reaches, its action type, and weapons only: `?range=Long&action=Turn&weapons=1`. */
export const PARAM_RANGE = 'range'
export const PARAM_ACTION = 'action'
export const PARAM_WEAPONS = 'weapons'
/** The List's sort: `?sort=sp` up by that column, `?sort=-sp` down. */
export const PARAM_SORT = 'sort'
/** The stat columns a phone's List shows, where the reader chose them: `?cols=range,damage`. */
export const PARAM_COLUMNS = 'cols'
/** A shared link's view: `?view=catalog` or `?view=tree`. */
export const PARAM_VIEW = 'view'

/** Every key a listing reads from the URL. */
export const LISTING_PARAMS: readonly string[] = [
  PARAM_TECH_LEVEL,
  PARAM_SOURCE,
  PARAM_TREE,
  PARAM_NAME,
  PARAM_TRAIT,
  PARAM_RANGE,
  PARAM_ACTION,
  PARAM_WEAPONS,
  PARAM_SORT,
  PARAM_COLUMNS,
  PARAM_VIEW,
]

/** The reader's last explicit view choice on a listing, kept across visits. */
export function listingViewStorageKey(schemaId: string): string {
  return `srd:listing-view:${schemaId}`
}

/** The phone columns the reader last chose on a listing, kept across visits (r7 E5). */
export function listingColumnsStorageKey(schemaId: string): string {
  return `srd:listing-cols:${schemaId}`
}
