/**
 * `/search-index.json` — the client search index.
 *
 * Compact, build-time-generated search index — a small static JSON asset
 * (id/name/slug/schemaName/schemaTitle/text per entity, no full entity data)
 * fetched lazily by `useSearchIndex.ts` on first search interaction, instead
 * of the search islands preloading the full ~1.3 MB reference corpus just to
 * run `search()`.
 */

import { buildSearchIndexEntries } from '../../lib/searchIndexBuild'
import { searchNames } from '../../lib/searchNames'
import type { EndpointModule } from '../types'

export const searchIndexJsonEndpoint: EndpointModule = {
  pattern: 'search-index.json',
  contentType: 'application/json',
  body: () => JSON.stringify(buildSearchIndexEntries()),
}

/**
 * `/search-names.json` — every entry's name, kind and page, a few kilobytes:
 * the first search on a slow line shows the names it matches at once while
 * the whole index loads (r8 G1, `useSearchIndex`).
 */
export const searchNamesJsonEndpoint: EndpointModule = {
  pattern: 'search-names.json',
  contentType: 'application/json',
  body: () => JSON.stringify(searchNames(buildSearchIndexEntries())),
}
