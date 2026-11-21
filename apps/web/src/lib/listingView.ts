import { useCallback, useState } from 'react'
import { listingViewStorageKey, PARAM_VIEW } from './listingParams'

/**
 * How a listing lays its entities out: `list`, the Ledger, a line an entity
 * with its stats in fixed columns (`IndexLedger`, ledger.md L1); `catalog`, one
 * flat grid of CompactIndexes with no group headings; or `tree` (a
 * `TREE_LISTINGS` schema only), each tree under its heading on its class-page
 * track. Every listing opens on its List.
 */
export type ListingView = 'catalog' | 'tree' | 'list'

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
 * Listings grouped by ability tree, which offer the Tree: each tree under its
 * heading on its track, as a class page draws it. Their List and Catalog are
 * flat, by name.
 */
export const TREE_LISTINGS: ReadonlySet<string> = new Set(['abilities'])

const VIEWS: readonly ListingView[] = ['list', 'catalog']
const TREE_VIEWS: readonly ListingView[] = ['list', 'tree', 'catalog']

/** The views a listing offers, in the rail's order: its List leads. */
function listingViews(schemaId: string): readonly ListingView[] {
  return TREE_LISTINGS.has(schemaId) ? TREE_VIEWS : VIEWS
}

/** The view every listing opens on: its List, the Ledger. */
const DEFAULT_LISTING_VIEW: ListingView = 'list'

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
    return parseView(window.localStorage.getItem(listingViewStorageKey(schemaId)), views)
  } catch {
    return null
  }
}

function storeView(schemaId: string, view: ListingView) {
  try {
    window.localStorage.setItem(listingViewStorageKey(schemaId), view)
  } catch {
    // Not remembered past this page; the toggle still works.
  }
}

/**
 * The listing's view. A reader's choice wins — a shared link's `?view=`, then
 * the one they last made on this listing — and otherwise `DEFAULT_LISTING_VIEW`.
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

  return { view: choice ?? DEFAULT_LISTING_VIEW, views, setView, fromUrl }
}
