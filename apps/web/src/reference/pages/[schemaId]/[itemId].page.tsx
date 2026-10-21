/**
 * `/[schemaId]/[itemId]` — an entity's show page (`/chassis/mule/`).
 *
 * The largest route family on the site (~850 of 1,038 pages), so a change here
 * reaches almost the whole SRD at once.
 *
 * A Workshop Manual page (boards 07, 08): the entity's chapter band, the card
 * as the page's body (`presentation="page"`), and the citation on the foot
 * band. A roll table gets its own page to roll on (board 08b).
 */

import type { EnhancedSchemaMetadata, RefEntity } from 'salvageunion-reference'
import { truncate } from 'salvageunion-reference'
import type { PageModule, PageResult, RouteContext, StructuredData } from '../../../../ssg/types'
import {
  assetSrcSetFor,
  CHAPTER_BAND_COLOR,
  heroImageSizes,
  resolveEntityPageMeta,
} from '../../../components/index'
import { buildLinkFor, guideExitsFor } from '../../../lib/buildLink'
import { bandFillFor, chapterForSchema } from '../../../lib/chapters'
import { componentEmbedFor } from '../../../lib/componentEmbed'
import { entityTitle, META_DESCRIPTION_MAX, SITE_URL, SRD_CRUMB } from '../../../lib/constants'
import { itemHref, schemaHref } from '../../../lib/entityHref'
import { extractStaticEntitySummary, getReferenceEntityData } from '../../../lib/gameData'
import { ogCardFor, ogMetaFor } from '../../../lib/ogCard'
import { pageTitle } from '../../../lib/pageTitle'
import { columnsTablePageData, rollTablePageData } from '../../../lib/rollTablePageData'
import { getItemStaticPaths } from '../../../lib/staticPaths'
import { CrawlerTechLevelPage } from '../../CrawlerTechLevelPage'
import { EntityPageFrame } from '../../EntityPageFrame'
import { EntityView } from '../../EntityView'
import { ColumnsTablePage, RollTablePage } from '../../RollTablePage'

/** The stats a crawler tech level's band keeps; the rest are its body's text. */
const BAND_STATS: ReadonlySet<string> = new Set(['Tech Level', 'Structure Points'])

type Params = { schemaId: string; itemId: string }

type Props = {
  item: RefEntity
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
  const fill = bandFillFor(schemaId, item)
  // A crawler tech level's facts are its body's block of text, the book's
  // (`CrawlerTechLevelPage`): its band keeps its Tech Level and Structure
  // Points (owner, round 6: "move SP to the page header").
  const techLevelPage = schemaId === 'crawler-tech-levels'
  const resolvedMeta = resolveEntityPageMeta(item)
  const pageMeta = techLevelPage
    ? {
        ...resolvedMeta,
        stats: resolvedMeta.stats.filter((stat) => BAND_STATS.has(stat.label)),
        facts: [],
      }
    : resolvedMeta
  // A banded d20 table rolls on a page of its own (board 08b), and so does a
  // two-roll columns table; every other entity is the card's page. The table
  // bands in the page's own tone: its band's colour.
  const rollTable = rollTablePageData(item)
  const columnsTable = rollTable ? null : columnsTablePageData(item)
  const pageTone = fill ?? CHAPTER_BAND_COLOR[chapter.tone]
  const rollPage = rollTable ? (
    <RollTablePage data={rollTable} tone={pageTone} />
  ) : columnsTable ? (
    <ColumnsTablePage data={columnsTable} tone={pageTone} />
  ) : null
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
      name: pageTitle(schemaName),
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
  // screenshotted from, so the text beside the image matches it.
  const og = ogMetaFor(ogCardFor(schemaId, itemId, item))

  return {
    meta: {
      title: entityTitle(itemName, schemaName),
      description: metaDescription,
      ...og,
      componentEmbed: componentEmbedFor(item),
      canonical: canonicalUrl,
      ogType: 'article',
      structuredData,
      preloadImage,
      preloadImageSrcSet,
      // The art is the page's hero now, so the preload repeats ITS `sizes`.
      preloadImageSizes: preloadImageSrcSet ? heroImageSizes() : undefined,
      breadcrumbs: [
        SRD_CRUMB,
        { name: pluralName, url: `${SITE_URL}${schemaHref(schemaId)}` },
        { name: itemName, url: canonicalUrl },
      ],
    },
    foot: { printings: pageMeta.printings },
    // A roll table has no build link or guide exits: both are null for it.
    children: (
      <EntityPageFrame
        title={itemName}
        tone={chapter.tone}
        fill={fill}
        meta={pageMeta}
        build={buildLinkFor(schemaId, item)}
        exits={guideExitsFor(schemaId, item)}
      >
        {/* The Entity renders as one unit — interactive island card + its static
            SEO / no-JS sub-content (EntityView). */}
        {rollPage ??
          (techLevelPage ? (
            <CrawlerTechLevelPage item={item} />
          ) : (
            <EntityView item={item} schemaId={schemaId} />
          ))}
      </EntityPageFrame>
    ),
  }
}

export const itemPage: PageModule<Params, Props> = {
  pattern: '/[schemaId]/[itemId]',
  getStaticPaths: getItemStaticPaths,
  page,
}
