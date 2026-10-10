/**
 * `/schema/[schemaId]` — the per-schema listing page.
 *
 * Headed by its chapter's band (the schema's plural name notched in, its entry
 * count stamped beside it), then the listing: one header-only row per entity
 * by default, with a Catalog toggle for the artwork tiles.
 *
 * `SchemaViewerIsland` is `ssr={true}` (see the per-island table in
 * `ssg/DESIGN.md`), but what it server-renders is `SchemaItemLinks`, not the
 * island: the island's grid sits behind a client-only data gate, so its server
 * render was nine skeletons. The named rows are the page's content for
 * crawlers, no-JS readers and the moment before the island mounts, laid out in
 * the list view's own grid. Mounting is still `createRoot`, so the rows are
 * discarded on the client and no mismatch is possible.
 */

import { Badge, ChapterBand } from 'component-lib'
import type { EnhancedSchemaMetadata, SURefEntity } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import type { PageModule, PageResult, RouteContext } from '../../../../ssg/types'
import { chapterForSchema } from '../../../lib/chapters'
import { SITE_URL, TITLE_SUFFIX } from '../../../lib/constants'
import { itemHref, schemaHref } from '../../../lib/entityHref'
import { getUniqueSources, getUniqueTechLevels, getUniqueTrees } from '../../../lib/gameData'
import { getSchemaPreloadList } from '../../../lib/schemaPreloadDeps'
import { getSchemaStaticPaths } from '../../../lib/staticPaths'
import { Island } from '../../../runtime/Island'

type Params = { schemaId: string }
type Props = { schema: EnhancedSchemaMetadata; data: SURefEntity[] }

/** The listing's measure — the island's own container. */
const MEASURE = '87.5rem'

/** One named row per entity, in the list view's own grid, for the server render. */
function SchemaItemLinks({ schemaId, data }: { schemaId: string; data: SURefEntity[] }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-2 pt-2 pb-6 md:px-6">
      <ul className="srd-listing__rows">
        {data.map((item) => (
          <li key={item.id}>
            <a
              href={itemHref(schemaId, getEntitySlug(item))}
              aria-label={item.name}
              className="srd-listing__fallback-row"
            >
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
  const pluralName = schema.displayNamePlural || schemaName
  const chapter = chapterForSchema(schemaId)
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
        { name: 'Contents', url: `${SITE_URL}/` },
        ...(chapter.href === '/'
          ? []
          : [{ name: chapter.title, url: `${SITE_URL}${chapter.href}` }]),
        { name: pluralName, url: canonicalUrl },
      ],
      breadcrumbDescription: schema.description,
    },
    children: (
      <div className="flex min-h-full flex-col">
        {/* The chapter band is the visible heading: the plural name in the
            notch and the count beside it. The description rides the trail. */}
        <ChapterBand
          tone={chapter.tone}
          measure={MEASURE}
          aside={
            <Badge shape="stamp" size="compact">
              {data.length} {data.length === 1 ? schemaName : pluralName}
            </Badge>
          }
        >
          {pluralName}
        </ChapterBand>
        <div className="flex flex-0 flex-col bg-wk-bg px-2 pt-4 pb-8 md:px-8">
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
