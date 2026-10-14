/**
 * `/[schemaId]` — the per-schema listing page (`/chassis/`).
 *
 * Headed by its chapter's band (the schema's plural name notched in), then the
 * listing: the Catalog, one flat grid of Tiles with no group headings, at
 * every width (`lib/listingView.ts`). The abilities open on their Tree
 * instead, each tree under its heading on its track, with Catalog | Tree in
 * the rail. It ends on the same chapter's band (`foot`), as an entity page
 * does.
 *
 * `SchemaViewerIsland` is `ssr={true}` (see the per-island table in
 * `ssg/DESIGN.md`), but what it server-renders is `SchemaItemLinks`, not the
 * island: the island's grid sits behind a client-only data gate, so its server
 * render was nine skeletons. The named rows are the page's content for
 * crawlers, no-JS readers and the moment before the island mounts, laid out as
 * the island lays its grid out: below its rail (`ListingRail`, inert here), in
 * its default view's groups (the Tree's, `lib/listingGroups.ts`; the Catalog
 * has one), each row in a tile's shape where the Catalog is the default. The island's skeleton takes the same rail and
 * groups (its `shape` prop), so neither the mount nor the data arriving moves
 * the grid. Mounting is still `createRoot`, so the rows are discarded on the
 * client and no mismatch is possible.
 */

import { ChapterBand, Slab } from 'component-lib'
import type { EnhancedSchemaMetadata, SURefEntity } from 'salvageunion-reference'
import { getAssetUrl, getEntitySlug } from 'salvageunion-reference'
import type { PageModule, PageResult, RouteContext } from '../../../ssg/types'
import { ListingRail } from '../../components/islands/ListingRail'
import { chapterForSchema, listingBandFillFor } from '../../lib/chapters'
import { CONTENTS_CRUMB, SITE_URL, TITLE_SUFFIX } from '../../lib/constants'
import { itemHref, schemaHref } from '../../lib/entityHref'
import { getUniqueSources, getUniqueTechLevels, getUniqueTrees } from '../../lib/gameData'
import { listingEntries } from '../../lib/listingEntries'
import type { ListingGroup, ListingShape, TechLevel } from '../../lib/listingGroups'
import { defaultGroups, orderTechLevels, WIDE_LISTINGS } from '../../lib/listingGroups'
import type { ListingView } from '../../lib/listingView'
import { CATALOG_LISTINGS, defaultListingView, listingViews } from '../../lib/listingView'
import { getSchemaPreloadList } from '../../lib/schemaPreloadDeps'
import { getSchemaStaticPaths } from '../../lib/staticPaths'
import { Island } from '../../runtime/Island'

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
  view,
}: {
  schemaId: string
  groups: ListingGroup[]
  count: number
  techLevels: TechLevel[]
  sources: string[]
  trees: string[]
  hasArt: boolean
  view: ListingView
}) {
  return (
    <div
      className="srd-listing"
      data-art={hasArt || undefined}
      data-wide={WIDE_LISTINGS.has(schemaId) || undefined}
      data-catalog={(view === 'catalog' && !hasArt) || undefined}
      data-view={view}
    >
      <ListingRail
        facets={{
          count,
          techLevels: orderTechLevels(techLevels),
          sources,
          trees,
          views: listingViews(schemaId),
        }}
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
  const { schema } = props
  // What the listing lists: the roll tables only their top-level ones.
  const data = listingEntries(schemaId, props.data)
  // The island reads its schema from the ORM, so a listing that lists fewer
  // than its schema holds hands it the ids it lists.
  const entryIds = data.length < props.data.length ? data.map((item) => item.id) : undefined

  const schemaName = schema.displayName || 'Schema'
  const pluralName = schema.displayNamePlural || schemaName
  const chapter = chapterForSchema(schemaId)
  const fill = listingBandFillFor(schemaId)
  const canonicalUrl = `${SITE_URL}${schemaHref(schemaId)}`
  const description = `Browse all ${schemaName} in the Salvage Union SRD (System Reference Document). Complete reference with stats, abilities, and details.`

  // Pre-compute filter facets at build time. A `CATALOG_LISTINGS` schema is a
  // handful of tiles, so it has no TL facet.
  const techLevels = CATALOG_LISTINGS.has(schemaId) ? [] : getUniqueTechLevels(data)
  const sources = schemaId === 'sources' ? [] : getUniqueSources(data)
  const trees = schemaId === 'abilities' ? getUniqueTrees(data) : []
  const preloadSchemas = getSchemaPreloadList(schemaId)
  // Art-less tiles take the Catalog's wider columns.
  const hasArt = data.some((item) => !!getAssetUrl(item))
  // The island's default view and its groups (the Catalog has one), so the
  // server render and the skeleton set the headings the grid mounts under.
  const view = defaultListingView(schemaId)
  const groups: ListingGroup[] =
    view === 'tree'
      ? defaultGroups(data, trees, techLevels, schemaId)
      : [{ key: 'all', label: undefined, items: data }]
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
        CONTENTS_CRUMB,
        ...(chapter.href === '/'
          ? []
          : [{ name: chapter.title, url: `${SITE_URL}${chapter.href}` }]),
        { name: pluralName, url: canonicalUrl },
      ],
      breadcrumbDescription: schema.description,
    },
    // The listing ends on its chapter's band, as its entity pages do.
    foot: { tone: chapter.tone, measure: MEASURE, ...(fill ? { fill: fill.foot } : {}) },
    children: (
      <div className="srd-listing-shell">
        {/* The chapter band is the visible heading: the plural name in the
            notch. The description rides the trail. */}
        <ChapterBand tone={chapter.tone} fill={fill?.band} measure={MEASURE}>
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
              shape,
              entryIds,
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
              view={view}
            />
          </Island>
        </div>
      </div>
    ),
  }
}

export const schemaListingPage: PageModule<Params, Props> = {
  pattern: '/[schemaId]',
  getStaticPaths: getSchemaStaticPaths,
  page,
}
