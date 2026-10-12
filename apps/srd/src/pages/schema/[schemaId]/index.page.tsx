/**
 * `/schema/[schemaId]` — the per-schema listing page.
 *
 * Headed by its chapter's band (the schema's plural name notched in), then the
 * listing, in the groups the book prints them in: one Row per entity, or where
 * the schema has art an art-first Tile (the Catalog, the default at a desktop
 * measure; `lib/listingView.ts`). A `CATALOG_LISTINGS` schema (the two tech-level tables) is
 * a Catalog at every width, one grid with no groups. It ends on the same
 * chapter's band (`foot`), as an entity page does.
 *
 * `SchemaViewerIsland` is `ssr={true}` (see the per-island table in
 * `ssg/DESIGN.md`), but what it server-renders is `SchemaItemLinks`, not the
 * island: the island's grid sits behind a client-only data gate, so its server
 * render was nine skeletons. The named rows are the page's content for
 * crawlers, no-JS readers and the moment before the island mounts, laid out as
 * the island lays its grid out: below its rail (`ListingRail`, inert here), in
 * its default groups (`lib/listingGroups.ts`), each row in a tile's shape where
 * the Catalog is the default. The island's skeleton takes the same rail and
 * groups (its `shape` prop), so neither the mount nor the data arriving moves
 * the grid. Mounting is still `createRoot`, so the rows are discarded on the
 * client and no mismatch is possible.
 */

import { ChapterBand, Slab } from 'component-lib'
import type { EnhancedSchemaMetadata, SURefEntity } from 'salvageunion-reference'
import { getAssetUrl, getEntitySlug } from 'salvageunion-reference'
import type { PageModule, PageResult, RouteContext } from '../../../../ssg/types'
import { ListingRail } from '../../../components/islands/ListingRail'
import { chapterForSchema } from '../../../lib/chapters'
import { SITE_URL, TITLE_SUFFIX } from '../../../lib/constants'
import { itemHref, schemaHref } from '../../../lib/entityHref'
import { getUniqueSources, getUniqueTechLevels, getUniqueTrees } from '../../../lib/gameData'
import type { ListingGroup, ListingShape, TechLevel } from '../../../lib/listingGroups'
import { defaultGroups, orderTechLevels, WIDE_LISTINGS } from '../../../lib/listingGroups'
import { CATALOG_LISTINGS } from '../../../lib/listingView'
import { getSchemaPreloadList } from '../../../lib/schemaPreloadDeps'
import { getSchemaStaticPaths } from '../../../lib/staticPaths'
import { Island } from '../../../runtime/Island'

type Params = { schemaId: string }
type Props = { schema: EnhancedSchemaMetadata; data: SURefEntity[] }

/** The listing's measure — the island's own container. */
const MEASURE = '87.5rem'

/**
 * One named row per entity, in the island's default groups under their
 * headings and below its rail (inert until the island's replaces it), for the
 * server render: the grid the island mounts lands where this one stood.
 */
function SchemaItemLinks({
  schemaId,
  groups,
  count,
  techLevels,
  sources,
  trees,
  hasArt,
  catalogOnly,
}: {
  schemaId: string
  groups: ListingGroup[]
  count: number
  techLevels: TechLevel[]
  sources: string[]
  trees: string[]
  hasArt: boolean
  catalogOnly: boolean
}) {
  return (
    <div
      className="srd-listing"
      data-art={hasArt || undefined}
      data-wide={WIDE_LISTINGS.has(schemaId) || undefined}
      data-catalog={catalogOnly || undefined}
    >
      <ListingRail
        facets={{ count, techLevels: orderTechLevels(techLevels), sources, trees, hasArt }}
      />
      <div className="srd-listing__groups">
        {groups.map((group) => (
          <section key={group.key} className="srd-listing__group" aria-label={group.label}>
            {group.label && <Slab variant="solid" label={group.label} />}
            <ul className="srd-listing__cards">
              {group.items.map((item) => (
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
          </section>
        ))}
      </div>
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

  // A listing whose tiles are the content is a Catalog at every width.
  const catalogOnly = CATALOG_LISTINGS.has(schemaId)
  // Pre-compute filter facets at build time. A Catalog-only listing's tiles
  // are each a tech level, so it has no TL facet and no TL groups.
  const techLevels = catalogOnly ? [] : getUniqueTechLevels(data)
  const sources = schemaId === 'sources' ? [] : getUniqueSources(data)
  const trees = schemaId === 'abilities' ? getUniqueTrees(data) : []
  const preloadSchemas = getSchemaPreloadList(schemaId)
  // A schema with artwork has a Catalog view, the default at a desktop measure.
  const hasArt = data.some((item) => !!getAssetUrl(item))
  // The island's default grouping, so the server render and the skeleton
  // set the same headings the grid mounts under.
  const groups = defaultGroups(data, trees, techLevels)
  const shape: ListingShape = {
    count: data.length,
    groups: groups.map(({ key, label, items }) => ({ key, label, count: items.length })),
  }

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
            props={{
              schemaId,
              techLevels,
              sources,
              trees,
              preloadSchemas,
              hasArt,
              catalogOnly,
              shape,
            }}
          >
            <SchemaItemLinks
              schemaId={schemaId}
              groups={groups}
              count={data.length}
              techLevels={techLevels}
              sources={sources}
              trees={trees}
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
