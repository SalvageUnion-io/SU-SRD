/**
 * `/schema/[schemaId]` — the per-schema listing page. Port of
 * `schema/[schemaId]/index.astro`.
 *
 * `SchemaViewerIsland` is `ssr={true}` (see the per-island table in
 * `ssg/DESIGN.md`): the entity grid is this page's SEO content, so the island
 * element is also rendered into the placeholder for crawlers / no-JS. Mounting
 * is still `createRoot`, so the server markup is discarded on the client and no
 * mismatch is possible.
 */

import type { EnhancedSchemaMetadata, SURefEntity } from 'salvageunion-reference'
import type { PageModule, PageResult, RouteContext } from '../../../../ssg/types'
import { SchemaViewerIsland } from '../../../components/islands/SchemaViewerIsland'
import { SITE_URL } from '../../../lib/constants'
import { schemaHref } from '../../../lib/entityHref'
import { getUniqueSources, getUniqueTechLevels, getUniqueTrees } from '../../../lib/gameData'
import { getSchemaPreloadList } from '../../../lib/schemaPreloadDeps'
import { getSchemaStaticPaths } from '../../../lib/staticPaths'
import { Island } from '../../../runtime/Island'

type Params = { schemaId: string }
type Props = { schema: EnhancedSchemaMetadata; data: SURefEntity[] }

function page({ params, props }: RouteContext<Params, Props>): PageResult {
  const { schemaId } = params
  const { schema, data } = props

  const schemaName = schema.displayName || 'Schema'
  const canonicalUrl = `${SITE_URL}${schemaHref(schemaId)}`
  const description = `Browse all ${schemaName} in the Salvage Union SRD (System Reference Document). Complete reference with stats, abilities, and details.`

  // Pre-compute filter facets at build time
  const techLevels = getUniqueTechLevels(data)
  const sources = schemaId === 'sources' ? [] : getUniqueSources(data)
  const trees = schemaId === 'abilities' ? getUniqueTrees(data) : []
  const preloadSchemas = getSchemaPreloadList(schemaId)

  return {
    meta: {
      title: `${schemaName} - Salvage Union System Reference Document`,
      description,
      canonical: canonicalUrl,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: schemaName,
        description,
        url: canonicalUrl,
        keywords: ['Salvage Union', 'TTRPG', 'SRD', 'System Reference Document', schemaName],
        isPartOf: {
          '@type': 'WebSite',
          name: 'Salvage Union System Reference Document',
          url: `${SITE_URL}/`,
        },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: data.length,
        },
        creator: {
          '@type': 'Organization',
          name: 'Leyline Press',
        },
      },
      breadcrumbs: [
        { name: 'SRD', url: `${SITE_URL}/` },
        { name: schemaName, url: canonicalUrl },
      ],
      breadcrumbDescription: schema.description,
    },
    children: (
      <div className="flex min-h-full flex-col">
        <div className="flex flex-0 flex-col items-center bg-wk-bg px-2 pt-4 pb-8 md:p-8 md:pt-4">
          {/* Visible heading band + description removed; the description now renders in
              the breadcrumb bar (SRD / Class — <description>). Keep a screen-reader h1
              so the listing page retains a heading for SEO/accessibility. */}
          <h1 className="sr-only">{schema.displayNamePlural || schemaName}</h1>
          <Island
            name="SchemaViewerIsland"
            client="visible"
            ssr
            props={{ initialData: data, schemaId, techLevels, sources, trees, preloadSchemas }}
          >
            <SchemaViewerIsland
              initialData={data}
              schemaId={schemaId}
              techLevels={techLevels}
              sources={sources}
              trees={trees}
              preloadSchemas={preloadSchemas}
            />
          </Island>
        </div>
      </div>
    ),
  }
}

export const schemaListingPage: PageModule<Params, Props> = {
  pattern: '/schema/[schemaId]',
  getStaticPaths: getSchemaStaticPaths,
  page,
}
