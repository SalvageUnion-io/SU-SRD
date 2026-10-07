/**
 * `/schema/[schemaId]` — the per-schema listing page.
 *
 * `SchemaViewerIsland` is `ssr={true}` (see the per-island table in
 * `ssg/DESIGN.md`), but what it server-renders is `SchemaItemLinks`, not the
 * island: the island's grid sits behind a client-only data gate, so its server
 * render was nine skeletons. The link list is the page's content for crawlers,
 * no-JS readers and the moment before the island mounts. Mounting is still
 * `createRoot`, so the list is discarded on the client and no mismatch is
 * possible.
 */

import type { EnhancedSchemaMetadata, SURefEntity } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import type { PageModule, PageResult, RouteContext } from '../../../../ssg/types'
import { SITE_URL, TITLE_SUFFIX } from '../../../lib/constants'
import { itemHref, schemaHref } from '../../../lib/entityHref'
import { getUniqueSources, getUniqueTechLevels, getUniqueTrees } from '../../../lib/gameData'
import { getSchemaPreloadList } from '../../../lib/schemaPreloadDeps'
import { getSchemaStaticPaths } from '../../../lib/staticPaths'
import { Island } from '../../../runtime/Island'

type Params = { schemaId: string }
type Props = { schema: EnhancedSchemaMetadata; data: SURefEntity[] }

/** One link per entity, in the island's own frame, for the server render. */
function SchemaItemLinks({ schemaId, data }: { schemaId: string; data: SURefEntity[] }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-2 pb-6 md:px-6">
      <ul className="columns-[16rem] gap-6">
        {data.map((item) => (
          <li key={item.id} className="py-1">
            <a href={itemHref(schemaId, getEntitySlug(item))} className="underline">
              {item.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

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
      title: `${schemaName}${TITLE_SUFFIX}`,
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
        <div className="flex flex-0 flex-col bg-wk-bg px-2 pt-4 pb-8 md:p-8 md:pt-4">
          {/* Visible heading band + description removed; the description now renders in
              the breadcrumb bar (SRD / Class — <description>). Keep a screen-reader h1
              so the listing page retains a heading for SEO/accessibility. */}
          <h1 className="sr-only">{schema.displayNamePlural || schemaName}</h1>
          <Island
            name="SchemaViewerIsland"
            client="visible"
            ssr
            props={{ schemaId, techLevels, sources, trees, preloadSchemas }}
          >
            <SchemaItemLinks schemaId={schemaId} data={data} />
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
