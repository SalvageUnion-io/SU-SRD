/**
 * `/schema/[schemaId]/item/[itemId]` — an entity's show page.
 * Port of `[itemId].astro`.
 *
 * The largest route family on the site (~880 of 1,039 pages), so a change here
 * reaches almost the whole SRD at once. `ssg/snapshot.ts` is what makes that
 * safe to touch: run `bun run gate` and the snapshot diff lists precisely which
 * of those pages moved.
 */

import type { EnhancedSchemaMetadata, SURefEntity } from 'salvageunion-reference'
import type { PageModule, PageResult, RouteContext, StructuredData } from '../../../../../ssg/types'
import { EntityView } from '../../../../components/EntityView'
import { SITE_URL } from '../../../../lib/constants'
import { itemHref, schemaHref } from '../../../../lib/entityHref'
import { extractStaticEntitySummary, getReferenceEntityData } from '../../../../lib/gameData'
import { getItemStaticPaths } from '../../../../lib/staticPaths'

type Params = { schemaId: string; itemId: string }

type Props = {
  item: SURefEntity
  schema: EnhancedSchemaMetadata
  itemName: string
  itemDescription: string
}

function page({ params, props }: RouteContext<Params, Props>): PageResult {
  const { item, schema, itemName, itemDescription } = props
  const { schemaId, itemId } = params

  const schemaName = schema.displayName || 'Item'
  const canonicalUrl = `${SITE_URL}${itemHref(schemaId, itemId)}`

  const displayData = item ? getReferenceEntityData(item) : null
  const staticSummary = item ? extractStaticEntitySummary(item) : null

  // Build meta description: first content paragraph > stat line > schema fallback
  const firstParagraph = staticSummary?.contentParagraphs[0]
  const statLine = staticSummary?.stats
    .slice(0, 4)
    .map((s) => `${s.label} ${s.value}`)
    .join(', ')
  const traitLine = staticSummary?.traits.length
    ? ` Traits: ${staticSummary.traits.join(', ')}.`
    : ''
  const metaDescription = firstParagraph
    ? firstParagraph.length > 155
      ? `${firstParagraph.slice(0, 152)}...`
      : firstParagraph
    : statLine
      ? `${itemName} — ${schemaName} for the Salvage Union TTRPG. ${statLine}.${traitLine}`.slice(
          0,
          158
        )
      : itemDescription ||
        `${itemName}: ${schemaName} reference for the Salvage Union tabletop RPG.`

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemPage',
    name: itemName,
    description: metaDescription,
    url: canonicalUrl,
    keywords: ['Salvage Union', 'TTRPG', 'SRD', 'System Reference Document', schemaName, itemName],
    isPartOf: {
      '@type': 'CollectionPage',
      name: `${schemaName} - Salvage Union SRD`,
      url: `${SITE_URL}${schemaHref(schemaId)}`,
    },
    mainEntity: {
      '@type': 'Thing',
      name: itemName,
      description: metaDescription,
      ...(displayData?.source
        ? {
            isPartOf: {
              '@type': 'Book',
              name: displayData.source,
              author: { '@type': 'Organization', name: 'Leyline Press' },
            },
          }
        : {}),
    },
  }

  if (displayData?.techLevel != null) {
    structuredData.additionalProperty = {
      '@type': 'PropertyValue',
      name: 'Tech Level',
      value: displayData.techLevel,
    }
  }

  // Real artwork (assetUrl) preloads for the on-page view.
  //
  // The og:image is deliberately NOT set here: this page always emits the
  // site-wide default (BaseLayout's DEFAULT_OG_IMAGE), and `scripts/og-screenshots.ts`
  // rewrites the meta afterwards for each entity whose Catalog-tile PNG actually
  // rendered. Doing it in that order means a skipped, budget-capped or failed
  // generation leaves a working default rather than an og:image that 404s.
  const preloadImage = displayData?.assetUrl

  return {
    meta: {
      title: `${itemName} - ${schemaName} - Salvage Union System Reference Document`,
      description: metaDescription,
      canonical: canonicalUrl,
      ogType: 'article',
      structuredData,
      preloadImage,
      breadcrumbs: [
        { name: 'SRD', url: `${SITE_URL}/` },
        { name: schemaName, url: `${SITE_URL}${schemaHref(schemaId)}` },
        { name: itemName, url: canonicalUrl },
      ],
    },
    children: (
      <article className="flex min-h-full flex-1 flex-col items-center justify-center p-4">
        {/* The Entity renders as one unit — interactive island card + its static
            SEO / no-JS sub-content (EntityView). */}
        <EntityView item={item} schemaId={schemaId} />
      </article>
    ),
  }
}

export const itemPage: PageModule<Params, Props> = {
  pattern: '/schema/[schemaId]/item/[itemId]',
  getStaticPaths: getItemStaticPaths,
  page,
}
