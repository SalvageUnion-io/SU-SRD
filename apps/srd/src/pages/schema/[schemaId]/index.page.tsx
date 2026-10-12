/**
 * `/schema/[schemaId]` — the per-schema listing page.
 *
 * Headed by its chapter's band (the schema's plural name notched in), then the
 * listing, in the groups the book prints them in: one Row per entity, or where
 * the schema has art an art-first Tile (the Catalog, the default at a desktop
 * measure; `lib/listingView.ts`). A `CATALOG_LISTINGS` schema (tech levels) is
 * a Catalog at every width, one grid with no groups. It ends on the same chapter's band (`foot`),
 * as an entity page does.
 *
 * `SchemaViewerIsland` is `ssr={true}` (see the per-island table in
 * `ssg/DESIGN.md`), but what it server-renders is `SchemaItemLinks`, not the
 * island: the island's grid sits behind a client-only data gate, so its server
 * render was nine skeletons. The named rows are the page's content for
 * crawlers, no-JS readers and the moment before the island mounts, laid out in
 * the list view's own grid. Mounting is still `createRoot`, so the rows are
 * discarded on the client and no mismatch is possible.
 */

import { ChapterBand } from 'component-lib'
import type { EnhancedSchemaMetadata, SURefEntity } from 'salvageunion-reference'
import { getAssetUrl, getEntitySlug } from 'salvageunion-reference'
import type { PageModule, PageResult, RouteContext } from '../../../../ssg/types'
import { chapterForSchema } from '../../../lib/chapters'
import { SITE_URL, TITLE_SUFFIX } from '../../../lib/constants'
import { itemHref, schemaHref } from '../../../lib/entityHref'
import { getUniqueSources, getUniqueTechLevels, getUniqueTrees } from '../../../lib/gameData'
import { CATALOG_LISTINGS } from '../../../lib/listingView'
import { getSchemaPreloadList } from '../../../lib/schemaPreloadDeps'
import { getSchemaStaticPaths } from '../../../lib/staticPaths'
import { Island } from '../../../runtime/Island'

type Params = { schemaId: string }
type Props = { schema: EnhancedSchemaMetadata; data: SURefEntity[] }

/** The listing's measure — the island's own container. */
const MEASURE = '87.5rem'

/** One named row per entity, in the list view's own grid, for the server render. */
function SchemaItemLinks({
  schemaId,
  data,
  hasArt,
  catalogOnly,
}: {
  schemaId: string
  data: SURefEntity[]
  hasArt: boolean
  catalogOnly: boolean
}) {
  return (
    <div
      className="srd-listing"
      data-art={hasArt || undefined}
      data-catalog={catalogOnly || undefined}
    >
      <ul className="srd-listing__cards">
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
  // A schema with artwork has a Catalog view, the default at a desktop measure.
  const hasArt = data.some((item) => !!getAssetUrl(item))
  // A listing whose tiles are the content is a Catalog at every width.
  const catalogOnly = CATALOG_LISTINGS.has(schemaId)

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
    // The listing ends on its chapter's band, as its entity pages do.
    foot: { tone: chapter.tone, measure: MEASURE },
    children: (
      <div className="srd-listing-shell">
        {/* The chapter band is the visible heading: the plural name in the
            notch. The description rides the trail. */}
        <ChapterBand tone={chapter.tone} measure={MEASURE}>
          {pluralName}
        </ChapterBand>
        <div className="srd-listing-page">
          <Island
            name="SchemaViewerIsland"
            client="visible"
            ssr
            props={{ schemaId, techLevels, sources, trees, preloadSchemas, hasArt, catalogOnly }}
          >
            <SchemaItemLinks
              schemaId={schemaId}
              data={data}
              hasArt={hasArt}
              catalogOnly={catalogOnly}
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
