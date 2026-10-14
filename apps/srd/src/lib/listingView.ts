import { useCallback, useState } from 'react'

/**
 * How a listing lays its entities out: `catalog`, one flat grid of Tiles with
 * no group headings, or `tree` (a `TREE_LISTINGS` schema only), each tree
 * under its heading on its class-page track. Every listing is a Catalog; only
 * a tree listing has a choice, and it opens on its Tree.
 */
export type ListingView = 'catalog' | 'tree'

/**
 * Listings whose entities have no artwork and whose lead is the content: a
 * handful of tiles, so no TL facet, and wider columns (`data-catalog`).
 */
export const CATALOG_LISTINGS: ReadonlySet<string> = new Set([
  'tech-levels',
  'crawler-tech-levels',
  'crawlers',
  'distances',
  'factions',
  'sources',
  'crawler-bays',
])

/**
 * Listings grouped by ability tree, which open on the Tree: each tree under
 * its heading on its track, as a class page draws it. Their Catalog is flat,
 * by name.
 */
export const TREE_LISTINGS: ReadonlySet<string> = new Set(['abilities'])

const VIEWS: readonly ListingView[] = ['catalog']
const TREE_VIEWS: readonly ListingView[] = ['catalog', 'tree']

/** The views a listing offers, in the rail's order: one means no toggle. */
function listingViews(schemaId: string): readonly ListingView[] {
  return TREE_LISTINGS.has(schemaId) ? TREE_VIEWS : VIEWS
}

/** The view a listing opens on: a tree listing's Tree, every other's Catalog. */
export function defaultListingView(schemaId: string): ListingView {
  return TREE_LISTINGS.has(schemaId) ? 'tree' : 'catalog'
}

/** A shared link's view: `?view=catalog` or `?view=tree`. */
export const PARAM_VIEW = 'view'

/** The reader's last explicit choice on a listing, kept across visits. */
function storageKey(schemaId: string): string {
  return `srd:listing-view:${schemaId}`
}

/** `raw` if it names one of `views`, else null. */
function parseView(
  raw: string | null | undefined,
  views: readonly ListingView[]
): ListingView | null {
  return views.find((view) => view === raw) ?? null
}

/** A view the URL names, or null. SSR-safe. */
function readUrlView(views: readonly ListingView[]): ListingView | null {
  if (typeof window === 'undefined') return null
  return parseView(new URLSearchParams(window.location.search).get(PARAM_VIEW), views)
}

/** The stored choice, or null. Storage can be absent or throw (a private window). */
function readStoredView(schemaId: string, views: readonly ListingView[]): ListingView | null {
  try {
    return parseView(window.localStorage.getItem(storageKey(schemaId)), views)
  } catch {
    return null
  }
}

function storeView(schemaId: string, view: ListingView) {
  try {
    window.localStorage.setItem(storageKey(schemaId), view)
  } catch {
    // Not remembered past this page; the toggle still works.
  }
}

/**
 * The listing's view. A reader's choice wins — a shared link's `?view=`, then
 * the one they last made on this listing — and otherwise `defaultListingView`.
 *
 * `fromUrl` says whether the view should ride the URL: only once the reader
 * chose it on this page, or arrived on a link that named it.
 */
export function useListingView(schemaId: string): {
  view: ListingView
  views: readonly ListingView[]
  setView: (view: ListingView) => void
  fromUrl: boolean
} {
  const views = listingViews(schemaId)
  const [urlView] = useState(() => readUrlView(views))
  const [choice, setChoice] = useState<ListingView | null>(
    () => urlView ?? readStoredView(schemaId, views)
  )
  const [fromUrl, setFromUrl] = useState(urlView !== null)

  const setView = useCallback(
    (next: ListingView) => {
      setChoice(next)
      setFromUrl(true)
      storeView(schemaId, next)
    },
    [schemaId]
  )

  return { view: choice ?? defaultListingView(schemaId), views, setView, fromUrl }
}
