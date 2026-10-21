/**
 * `/[schemaId]/[itemId]` — an entity's show page (`/chassis/mule/`).
 *
 * The largest route family on the site (most of its pages), so a change here
 * reaches almost the whole SRD at once.
 *
 * A Workshop Manual page: the entity's chapter band, the card
 * as the page's body (`presentation="page"`), and the citation on the foot
 * band. A roll table gets its own page to roll on.
 */

import type { EnhancedSchemaMetadata, RefEntity } from 'salvageunion-reference'
import { truncate } from 'salvageunion-reference'
import type { PageModule, PageResult, RouteContext } from '../../../../ssg/types'
import { CHAPTER_BAND_COLOR, resolveEntityPageMeta } from '../../../components/index'
import { buildLinkFor, guideExitsFor } from '../../../lib/buildLink'
import { bandFillFor, chapterForSchema } from '../../../lib/chapters'
import { componentEmbedFor } from '../../../lib/componentEmbed'
import { entityTitle, META_DESCRIPTION_MAX, SITE_URL } from '../../../lib/constants'
import { itemHref, schemaHref } from '../../../lib/entityHref'
import { entityPageHead } from '../../../lib/entityPageHead'
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
  // Points (R47).
  const techLevelPage = schemaId === 'crawler-tech-levels'
  const resolvedMeta = resolveEntityPageMeta(item)
  const pageMeta = techLevelPage
    ? {
        ...resolvedMeta,
        stats: resolvedMeta.stats.filter((stat) => BAND_STATS.has(stat.label)),
        facts: [],
      }
    : resolvedMeta
  // A banded d20 table rolls on a page of its own, and so does a
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

  const listingUrl = `${SITE_URL}${schemaHref(schemaId)}`

  return {
    meta: entityPageHead({
      title: entityTitle(itemName, schemaName),
      name: itemName,
      description: metaDescription,
      canonical: canonicalUrl,
      keywords: [schemaName, itemName],
      parentPage: { type: 'CollectionPage', name: pageTitle(schemaName), url: listingUrl },
      source: displayData?.source,
      ...(displayData?.techLevel != null
        ? {
            additional: {
              additionalProperty: {
                '@type': 'PropertyValue',
                name: 'Tech Level',
                value: displayData.techLevel,
              },
            },
          }
        : {}),
      assetUrl: displayData?.assetUrl,
      // The preview's words and colour come from the same card its image is
      // screenshotted from, so the text beside the image matches it.
      og: ogMetaFor(ogCardFor(schemaId, itemId, item)),
      componentEmbed: componentEmbedFor(item),
      crumbs: [{ name: pluralName, url: listingUrl }],
      crumb: itemName,
    }),
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
