import { useCallback, useState, useSyncExternalStore } from 'react'

/**
 * How a listing lays its entities out: `list`, one Row each (the scannable
 * index), `catalog`, the Tiles, or `tree` (a `TREE_LISTINGS` schema only),
 * each tree on its class-page track. Every listing offers List | Catalog.
 */
export type ListingView = 'list' | 'catalog' | 'tree'

/**
 * Listings that open on the Catalog at every width: short ones whose entities
 * have no artwork, so each tile is its band, cells and lead, and the tiles are
 * the content. The List is still a click away.
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
 * its heading on its track, as a class page draws it. Their List and Catalog
 * are flat, by name.
 */
export const TREE_LISTINGS: ReadonlySet<string> = new Set(['abilities'])

const VIEWS: readonly ListingView[] = ['list', 'catalog']
const TREE_VIEWS: readonly ListingView[] = ['list', 'catalog', 'tree']

/** The views a listing offers, in the rail's order. */
export function listingViews(schemaId: string): readonly ListingView[] {
  return TREE_LISTINGS.has(schemaId) ? TREE_VIEWS : VIEWS
}

/** A shared link's view: `?view=catalog` or `?view=list`. */
export const PARAM_VIEW = 'view'

/**
 * The reader's last explicit choice, kept across listings and visits. A
 * `TREE_LISTINGS` schema keeps its own, so a List picked on the chassis does
 * not take the abilities off their Tree.
 */
const STORAGE_KEY = 'srd:listing-view'

function storageKey(schemaId: string): string {
  return TREE_LISTINGS.has(schemaId) ? `${STORAGE_KEY}:${schemaId}` : STORAGE_KEY
}

/**
 * Where the Catalog is the default: a desktop measure, where a column of
 * tiles still sets four or more across. A phone or a narrow window keeps the
 * List. `pages.css` sizes the pre-mount placeholders on the same query.
 */
export const CATALOG_QUERY = '(min-width: 75rem)'

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

function subscribeWide(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {
      // No media queries here (SSR, an old test DOM): nothing to unsubscribe.
    }
  }
  const query = window.matchMedia(CATALOG_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function isWide(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(CATALOG_QUERY).matches
}

/**
 * The view a listing opens on before the reader picks one: a tree listing's
 * Tree, a `CATALOG_LISTINGS` schema's Catalog, a schema with art's Catalog at
 * a desktop measure, and otherwise the List.
 */
function defaultListingView(schemaId: string, hasArt: boolean, wide: boolean): ListingView {
  if (TREE_LISTINGS.has(schemaId)) return 'tree'
  if (CATALOG_LISTINGS.has(schemaId)) return 'catalog'
  return hasArt && wide ? 'catalog' : 'list'
}

/**
 * The listing's view. A reader's choice wins — a shared link's `?view=`, then
 * the one they last made — and otherwise `defaultListingView` decides, the
 * Catalog with art following a resize across the desktop measure.
 *
 * The island mounts with `createRoot` (never hydrates), so the media query is
 * read on its very first render: no list-then-catalog flash, no mismatch.
 *
 * `fromUrl` says whether the view should ride the URL: only once the reader
 * chose it on this page, or arrived on a link that named it.
 */
export function useListingView(
  schemaId: string,
  hasArt: boolean
): {
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
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false)

  const setView = useCallback(
    (next: ListingView) => {
      setChoice(next)
      setFromUrl(true)
      storeView(schemaId, next)
    },
    [schemaId]
  )

  const view = choice ?? defaultListingView(schemaId, hasArt, wide)
  return { view, views, setView, fromUrl }
}
