import type { APIRoute } from 'astro'
import { buildSearchIndexEntries } from '../lib/searchIndexBuild'

/**
 * Compact, build-time-generated search index — a small static JSON asset
 * (id/name/slug/schemaName/schemaTitle/text per entity, no full entity data)
 * fetched lazily by `useSearchIndex.ts` on first search interaction, instead
 * of the search islands preloading the full ~1.3 MB reference corpus just to
 * run `search()`.
 */
export const GET: APIRoute = () => {
  return new Response(JSON.stringify(buildSearchIndexEntries()), {
    headers: { 'Content-Type': 'application/json' },
  })
}
