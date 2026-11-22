/**
 * When an `interaction` island cannot wait for the reader: its server markup
 * is not what this visit should show, so it mounts as soon as it is in view
 * (a listing at once, `mountsUnseen`).
 *
 * The server draws a listing unfiltered, in its default view. A shared link
 * that names a filter or a view, or a view the reader chose on an earlier
 * visit, is only known in the browser, so that listing mounts at once rather
 * than showing the wrong cards until someone touches the rail. A hero search,
 * or the bar's on the Reference page, mounts at once for an address with a query
 * (`/reference/?q=mule`, where the retired search page's links land), to open on it.
 * A chassis's Homebrew mounts at once when the reader left its switch on, to
 * list them; off, it waits for a press, which is held and played back.
 *
 * Free of React and of the islands, like `interaction.ts`: the client entry
 * asks this on every page.
 */

import { SHOW_HOMEBREW_KEY } from '../lib/homebrew/endpoint'
import { LISTING_PARAMS, listingViewStorageKey } from '../lib/listingParams'
import { SEARCH_PAGE, searchQuery } from '../lib/searchHref'

type Predicate = (props: Record<string, unknown>, win: Window) => boolean

/** A stored value, or null where storage is absent or throws (a private window). */
function stored(win: Window, key: string): string | null {
  try {
    return win.localStorage.getItem(key)
  } catch {
    return null
  }
}

const MOUNTS_NOW: Record<string, Predicate> = {
  HomebrewIsland: (_props, win) => stored(win, SHOW_HOMEBREW_KEY) === 'on',
  SearchIsland: (props, win) =>
    (props.variant === 'hero' || win.location.pathname === SEARCH_PAGE) &&
    searchQuery(win.location.search) !== undefined,
  SchemaViewerIsland: (props, win) => {
    const query = new URLSearchParams(win.location.search)
    if (LISTING_PARAMS.some((key) => query.has(key))) return true
    const schemaId = typeof props.schemaId === 'string' ? props.schemaId : ''
    return schemaId !== '' && stored(win, listingViewStorageKey(schemaId)) !== null
  },
}

/**
 * Islands that mount without waiting to be seen: a listing is its page's
 * rows, and Back restores the scroll far below its first box, where a
 * listing waiting to be in view never mounted (r3 C1).
 */
const UNSEEN = ['SchemaViewerIsland']

/** Whether an island that mounts now does so wherever the reader is on the page. */
export function mountsUnseen(name: string): boolean {
  return UNSEEN.includes(name)
}

/** Whether the island `name` must mount now instead of on the reader's first intent. */
export function mountsNow(
  name: string,
  props: Record<string, unknown>,
  win: Window = window
): boolean {
  return Object.hasOwn(MOUNTS_NOW, name) && (MOUNTS_NOW[name]?.(props, win) ?? false)
}
