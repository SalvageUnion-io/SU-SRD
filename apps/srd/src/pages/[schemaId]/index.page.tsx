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
 * `ssg/DESIGN.md`), and what it server-renders is its own listing
 * (`SchemaViewerListing`) from build-time data, rail inert. The island loads
 * its data before its first render, so that commit draws the same listing
 * over the server's: the cards paint once, at first paint, rather than as
 * named rows replaced by cards when the data arrives. Mounting is still
 * `createRoot`, so no hydration mismatch is possible.
 */

import { ChapterBand } from 'component-lib'
import type { EnhancedSchemaMetadata, SURefEntity } from 'salvageunion-reference'
import { getAssetUrl } from 'salvageunion-reference'
import type { PageModule, PageResult, RouteContext } from '../../../ssg/types'
import { SchemaViewerListing } from '../../components/islands/SchemaViewerIsland'
import { chapterForSchema } from '../../lib/chapters'
import { CONTENTS_CRUMB, SITE_URL, TITLE_SUFFIX } from '../../lib/constants'
import { schemaHref } from '../../lib/entityHref'
import { getUniqueSources, getUniqueTechLevels, getUniqueTrees } from '../../lib/gameData'
import { listingEntries } from '../../lib/listingEntries'
import type { ListingGroup, ListingShape } from '../../lib/listingGroups'
import { defaultGroups } from '../../lib/listingGroups'
import { CATALOG_LISTINGS, defaultListingView } from '../../lib/listingView'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { getSchemaPreloadList } from '../../lib/schemaPreloadDeps'
import { getSchemaStaticPaths } from '../../lib/staticPaths'
import { Island } from '../../runtime/Island'

type Params = { schemaId: string }
type Props = { schema: EnhancedSchemaMetadata; data: SURefEntity[] }

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
  // The island's default view and its groups (the Catalog has one), so its
  // skeleton sets the headings the grid mounts under.
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
    foot: { tone: chapter.tone, measure: PAGE_MEASURE },
    children: (
      <div className="srd-listing-shell">
        {/* The chapter band is the visible heading: the plural name in the
            notch. The description rides the trail. */}
        <ChapterBand tone={chapter.tone} measure={PAGE_MEASURE}>
          {pluralName}
        </ChapterBand>
        <div className="srd-listing-page srd-page-body">
          <Island
            name="SchemaViewerIsland"
            client="interaction"
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
            <SchemaViewerListing
              schemaId={schemaId}
              techLevels={techLevels}
              sources={sources}
              trees={trees}
              hasArt={hasArt}
              entryIds={entryIds}
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
