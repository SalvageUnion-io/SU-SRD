/**
 * `/[schemaId]` — the per-schema listing page (`/chassis/`).
 *
 * Headed by its chapter's band, or its own (`listingBandFillFor`: the systems'
 * and modules' TL blue) (the schema's plural name notched in, the
 * listing's search and filters on it), then the listing: its List, the Ledger,
 * a line an entity (`IndexLedger`), at every width, with List | Catalog in the
 * rail (`lib/listingView.ts`); the abilities offer their Tree between the two.
 * Its footer wears the same chapter's band (the leading band's rule), as an
 * entity page does.
 *
 * `SchemaViewerIsland` is `ssr={true}` (see the per-island table in
 * `astro/DESIGN.md`), and what it server-renders is its own listing
 * (`SchemaViewerListing`) from build-time data, rail inert. The island loads
 * its data before its first render, so that commit draws the same listing
 * over the server's: the listing paints once, at first paint, rather than as
 * placeholders replaced when the data arrives. Mounting is still
 * `createRoot`, so no hydration mismatch is possible.
 */

import type { EnhancedSchemaMetadata, RefEntity, RefMetaEntity } from 'salvageunion-reference'
import type { ListingBand } from '../../../components/islands/ListingFrame'
import { SchemaViewerListing } from '../../../components/islands/SchemaViewerIsland'
import { chapterForSchema, listingBandFillFor } from '../../../lib/chapters'
import { PUBLISHER, SITE_URL, SRD_CRUMB, WEBSITE } from '../../../lib/constants'
import { schemaHref } from '../../../lib/entityHref'
import { getUniqueSources, getUniqueTechLevels, getUniqueTrees } from '../../../lib/gameData'
import { listingEntries } from '../../../lib/listingEntries'
import type { ListingGroup, ListingShape } from '../../../lib/listingGroups'
import { catalogGroupBy, groupEntities } from '../../../lib/listingGroups'
import { listingTraits } from '../../../lib/listingTraits'
import { CATALOG_LISTINGS } from '../../../lib/listingView'
import { pageTitle } from '../../../lib/pageTitle'
import { getSchemaPreloadList } from '../../../lib/schemaPreloadDeps'
import { artUrlFor } from '../../../lib/sourceCovers'
import { getSchemaStaticPaths } from '../../../lib/staticPaths'
import { pagesCopy } from '../../../messages/reference-pages'
import { Island } from '../../../runtime/Island'
import type { PageModule, PageResult, RouteContext } from '../../types'

type Params = { schemaId: string }
type Props = { schema: EnhancedSchemaMetadata; data: RefEntity[] }

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
  const description = pagesCopy('browseAll', { pluralName })

  // Pre-compute filter facets at build time. A `CATALOG_LISTINGS` schema is a
  // handful of tiles, so it has no TL facet.
  const techLevels = CATALOG_LISTINGS.has(schemaId) ? [] : getUniqueTechLevels(data)
  const sources = schemaId === 'sources' ? [] : getUniqueSources(data)
  const trees = schemaId === 'abilities' ? getUniqueTrees(data) : []
  // The weapons' and gear's traits: "which systems are Hot" is a filter.
  const traits = listingTraits(data)
  const preloadSchemas = getSchemaPreloadList(schemaId)
  // Art-less tiles take the Catalog's wider columns.
  const hasArt = data.some((item) => !!artUrlFor(item as RefMetaEntity))
  // The List's groups (one, but for the classes' Core and Hybrid), so the
  // island's skeleton sets a Ledger where each will mount.
  const groups: ListingGroup[] = groupEntities(data, catalogGroupBy(schemaId))
  // The band is the island's, so its search and filters can sit on it.
  const band: ListingBand = {
    title: pluralName,
    tone: chapter.tone,
    fill: listingBandFillFor(schemaId),
    trail: [
      { name: SRD_CRUMB.name, url: '/reference/' },
      { name: pluralName, url: schemaHref(schemaId) },
    ],
  }
  const shape: ListingShape = {
    count: data.length,
    groups: groups.map(({ key, label, items }) => ({ key, label, count: items.length })),
  }

  return {
    meta: {
      title: pageTitle(pluralName),
      description,
      canonical: canonicalUrl,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: schemaName,
        description,
        url: canonicalUrl,
        keywords: [
          pagesCopy('salvageUnion'),
          'TTRPG',
          'SRD',
          pagesCopy('systemReferenceDocument'),
          schemaName,
        ],
        isPartOf: WEBSITE,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: data.length,
        },
        creator: PUBLISHER,
      },
      breadcrumbs: [SRD_CRUMB, { name: pluralName, url: canonicalUrl }],
    },
    children: (
      <div className="su-listing-shell">
        {/* The island draws the chapter band (the plural name in the notch,
            the rail as its controls) and the listing under it. */}
        <Island
          name="SchemaViewerIsland"
          client="interaction"
          ssr
          props={{
            schemaId,
            band,
            techLevels,
            sources,
            trees,
            traits,
            preloadSchemas,
            hasArt,
            shape,
            entryIds,
          }}
        >
          <SchemaViewerListing
            schemaId={schemaId}
            band={band}
            techLevels={techLevels}
            sources={sources}
            trees={trees}
            traits={traits}
            hasArt={hasArt}
            entryIds={entryIds}
          />
        </Island>
      </div>
    ),
  }
}

export const schemaListingPage: PageModule<Params, Props> = {
  pattern: '/[schemaId]',
  getStaticPaths: getSchemaStaticPaths,
  page,
}
