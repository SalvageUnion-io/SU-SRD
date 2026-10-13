import { useCallback, useState, useSyncExternalStore } from 'react'

/**
 * How a listing lays its entities out: `list`, one Row each (the scannable
 * index), or `catalog`, the art-first Tiles.
 */
export type ListingView = 'list' | 'catalog'

/**
 * Listings that are a Catalog at every width: short ones whose entities have
 * no artwork, so each tile is its band, cells and lead, and the tiles are the
 * whole content — so no List view and no toggle.
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

/** A shared link's view: `?view=catalog` or `?view=list`. */
export const PARAM_VIEW = 'view'

/** The reader's last explicit choice, kept across listings and visits. */
const STORAGE_KEY = 'srd:listing-view'

/**
 * Where the Catalog is the default: a desktop measure, where a column of
 * tiles still sets four or more across. A phone or a narrow window keeps the
 * List. `pages.css` sizes the pre-mount placeholders on the same query.
 */
export const CATALOG_QUERY = '(min-width: 75rem)'

function parseView(raw: string | null | undefined): ListingView | null {
  return raw === 'catalog' || raw === 'list' ? raw : null
}

/** A view the URL names, or null. SSR-safe. */
function readUrlView(): ListingView | null {
  if (typeof window === 'undefined') return null
  return parseView(new URLSearchParams(window.location.search).get(PARAM_VIEW))
}

/** The stored choice, or null. Storage can be absent or throw (a private window). */
function readStoredView(): ListingView | null {
  try {
    return parseView(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function storeView(view: ListingView) {
  try {
    window.localStorage.setItem(STORAGE_KEY, view)
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
 * The listing's view. A reader's choice wins — a shared link's `?view=`, then
 * the one they last made — and otherwise the viewport decides: the Catalog at
 * a desktop measure, the List below it, following a resize.
 *
 * The island mounts with `createRoot` (never hydrates), so the media query is
 * read on its very first render: no list-then-catalog flash, no mismatch.
 *
 * `fromUrl` says whether the view should ride the URL: only once the reader
 * chose it on this page, or arrived on a link that named it.
 *
 * `catalogOnly` (`CATALOG_LISTINGS`) pins the Catalog: there is nothing to choose.
 */
export function useListingView(
  hasArt: boolean,
  catalogOnly = false
): {
  view: ListingView
  setView: (view: ListingView) => void
  fromUrl: boolean
} {
  const [urlView] = useState(readUrlView)
  const [choice, setChoice] = useState<ListingView | null>(() => urlView ?? readStoredView())
  const [fromUrl, setFromUrl] = useState(urlView !== null)
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false)

  const setView = useCallback((next: ListingView) => {
    setChoice(next)
    setFromUrl(true)
    storeView(next)
  }, [])

  const view: ListingView = catalogOnly
    ? 'catalog'
    : !hasArt
      ? 'list'
      : (choice ?? (wide ? 'catalog' : 'list'))
  return { view, setView, fromUrl: hasArt && !catalogOnly && fromUrl }
}
