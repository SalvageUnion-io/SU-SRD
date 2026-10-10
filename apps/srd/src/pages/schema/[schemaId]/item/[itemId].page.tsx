/**
 * `/schema/[schemaId]/item/[itemId]` — an entity's show page.
 *
 * The largest route family on the site (~850 of 1,038 pages), so a change here
 * reaches almost the whole SRD at once.
 *
 * A Workshop Manual page (boards 07, 08): the entity's chapter band, the card
 * as the page's body (`presentation="page"`), and the citation on the foot
 * band. A roll table gets its own page to roll on (board 08b).
 */

import { assetSrcSetFor, heroImageSizes, resolveEntityPageMeta } from 'component-lib'
import type { EnhancedSchemaMetadata, SURefEntity } from 'salvageunion-reference'
import { truncate } from 'salvageunion-reference'
import type { PageModule, PageResult, RouteContext, StructuredData } from '../../../../../ssg/types'
import { EntityPageFrame, entityPageFoot } from '../../../../components/EntityPageFrame'
import { EntityView } from '../../../../components/EntityView'
import {
  ROLL_TABLE_PAGE_MEASURE,
  RollTablePage,
  rollTablePageData,
} from '../../../../components/RollTablePage'
import { chapterForSchema } from '../../../../lib/chapters'
import { META_DESCRIPTION_MAX, SITE_URL, TITLE_SUFFIX } from '../../../../lib/constants'
import { itemHref, schemaHref } from '../../../../lib/entityHref'
import { extractStaticEntitySummary, getReferenceEntityData } from '../../../../lib/gameData'
import { ogCardFor, ogMetaFor } from '../../../../lib/ogCard'
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
  const pluralName = schema.displayNamePlural || schemaName
  const chapter = chapterForSchema(schemaId)
  const pageMeta = resolveEntityPageMeta(item)
  // A banded d20 table rolls on a page of its own (board 08b); a two-roll
  // columns table, and every other entity, is the card's page.
  const rollTable = rollTablePageData(item)
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
  const metaDescription = truncate(
    firstParagraph ||
      (statLine
        ? `${itemName} — ${schemaName} for the Salvage Union TTRPG. ${statLine}.${traitLine}`
        : itemDescription ||
          `${itemName}: ${schemaName} reference for the Salvage Union tabletop RPG.`),
    META_DESCRIPTION_MAX
  )

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
  // rewrites the meta afterwards for each entity whose card PNG actually
  // rendered. Doing it in that order means a skipped, budget-capped or failed
  // generation leaves a working default rather than an og:image that 404s.
  const preloadImage = displayData?.assetUrl
  // The preload MUST carry the same srcset/sizes as the <img>, or it selects a
  // different candidate and the page downloads both files. See `cardImageSizes`.
  const preloadImageSrcSet = assetSrcSetFor(displayData?.assetUrl)

  // The preview's words and colour come from the same card its image is
  // screenshotted from (issue 1280), so the text beside the image matches it.
  const og = ogMetaFor(ogCardFor(schemaId, itemId, item))

  return {
    meta: {
      title: `${itemName} - ${schemaName}${TITLE_SUFFIX}`,
      description: metaDescription,
      ...og,
      canonical: canonicalUrl,
      ogType: 'article',
      structuredData,
      preloadImage,
      preloadImageSrcSet,
      // The art is the page's hero now, so the preload repeats ITS `sizes`.
      preloadImageSizes: preloadImageSrcSet ? heroImageSizes() : undefined,
      breadcrumbs: [
        { name: 'Contents', url: `${SITE_URL}/` },
        ...(chapter.href === '/'
          ? []
          : [{ name: chapter.title, url: `${SITE_URL}${chapter.href}` }]),
        { name: pluralName, url: `${SITE_URL}${schemaHref(schemaId)}` },
        { name: itemName, url: canonicalUrl },
      ],
    },
    foot: entityPageFoot(chapter.tone, pageMeta, rollTable ? ROLL_TABLE_PAGE_MEASURE : undefined),
    children: rollTable ? (
      <EntityPageFrame
        title={itemName}
        tone={chapter.tone}
        meta={pageMeta}
        measure={ROLL_TABLE_PAGE_MEASURE}
      >
        <RollTablePage data={rollTable} />
      </EntityPageFrame>
    ) : (
      <EntityPageFrame title={itemName} tone={chapter.tone} meta={pageMeta}>
        {/* The Entity renders as one unit — interactive island card + its static
            SEO / no-JS sub-content (EntityView). */}
        <EntityView item={item} schemaId={schemaId} />
      </EntityPageFrame>
    ),
  }
}

export const itemPage: PageModule<Params, Props> = {
  pattern: '/schema/[schemaId]/item/[itemId]',
  getStaticPaths: getItemStaticPaths,
  page,
}
