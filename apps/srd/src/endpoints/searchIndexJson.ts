/**
 * `/search-index.json` — port of `src/pages/search-index.json.ts`.
 *
 * Compact, build-time-generated search index — a small static JSON asset
 * (id/name/slug/schemaName/schemaTitle/text per entity, no full entity data)
 * fetched lazily by `useSearchIndex.ts` on first search interaction, instead
 * of the search islands preloading the full ~1.3 MB reference corpus just to
 * run `search()`.
 */

import type { EndpointModule } from '../../ssg/types'
import { buildSearchIndexEntries } from '../lib/searchIndexBuild'

export const searchIndexJsonEndpoint: EndpointModule = {
  pattern: 'search-index.json',
  contentType: 'application/json',
  body: () => JSON.stringify(buildSearchIndexEntries()),
}
