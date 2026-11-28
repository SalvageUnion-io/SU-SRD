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

import type {
  EnhancedSchemaMetadata,
  RefEntity,
  RefEnumSchemaName,
  RefMetaEntity,
} from 'salvageunion-reference'
import { truncate } from 'salvageunion-reference'
import { classContentsFor } from '../../../components/classContents.model'
import {
  abilityTreeNeighbours,
  CHAPTER_BAND_COLOR,
  NeighbourRow,
  resolveEntityPageMeta,
} from '../../../components/index'
import { HomebrewIsland } from '../../../components/islands/HomebrewIsland'
import { buildLinkFor, guideExitsFor, mediatorLinksFor } from '../../../lib/buildLink'
import { bandFillFor, chapterForSchema } from '../../../lib/chapters'
import { componentEmbedFor } from '../../../lib/componentEmbed'
import { entityTitle, META_DESCRIPTION_MAX, SITE_URL, titleName } from '../../../lib/constants'
import { itemHref, schemaHref } from '../../../lib/entityHref'
import { entityPageHead, previewDescriptionFor } from '../../../lib/entityPageHead'
import { extractStaticEntitySummary, getReferenceEntityData } from '../../../lib/gameData'
import { ogCardFor, ogMetaFor } from '../../../lib/ogCard'
import { relationsFor, sideLinksOf } from '../../../lib/pageRelations'
import { pageTitle } from '../../../lib/pageTitle'
import { columnsTablePageData, rollTablePageData } from '../../../lib/rollTablePageData'
import { isSparse, oneRelatedRules, sparseRailFor, tableRailFor } from '../../../lib/sparseRail'
import { getItemStaticPaths } from '../../../lib/staticPaths'
import { pagesCopy } from '../../../messages/reference-pages'
import { Island } from '../../../runtime/Island'
import { CrawlerTechLevelPage } from '../../CrawlerTechLevelPage'
import { EntityPageFrame } from '../../EntityPageFrame'
import { EntityView } from '../../EntityView'
import { guideNeighbours } from '../../guideNeighbours'
import { PageRelations } from '../../PageRelations'
import { ColumnsTablePage, RollTablePage } from '../../RollTablePage'
import { SparseRail } from '../../SparseRail'
import type { PageModule, PageResult, RouteContext } from '../../types'

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
  // A sparse Page's side column.
  // Its Related rules and the Page's own are one list.
  // A roll table's is who sends a reader to it (r3 C4); none, no column.
  const tableRail = schemaId === 'roll-tables' ? tableRailFor(item) : null
  const { rail: sparse, relations } = oneRelatedRules(
    tableRail
      ? tableRail.usedBy.length + tableRail.rules.length > 0
        ? tableRail
        : null
      : !rollPage && !techLevelPage && isSparse(item)
        ? sparseRailFor(schemaId as RefEnumSchemaName, item)
        : null,
    relationsFor(schemaId, item)
  )
  // The tables it is rolled on stand in the side column, a compact box: a
  // sparse Page's rail, or under the card's art (r7 review).
  const { side: sideLinks, rest: fullWidth } = sideLinksOf(relations)
  // An ability's Preceding and Next in its tree, at the Page's foot; a
  // guide's Previous and Next in the book's order (r5 E6).
  const neighbours = [
    ...abilityTreeNeighbours(item as RefMetaEntity).map(({ label, abilities }) => ({
      label,
      entities: abilities,
      end: label === 'Next',
    })),
    ...guideNeighbours(schemaId, item),
  ]
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
        ? pagesCopy('entityMetaWithStats', { itemName, schemaName, statLine, traitLine })
        : itemDescription || pagesCopy('entityMeta', { itemName, schemaName })),
    META_DESCRIPTION_MAX
  )

  const listingUrl = `${SITE_URL}${schemaHref(schemaId)}`

  return {
    meta: entityPageHead({
      title: entityTitle(titleName(schemaId, itemName), schemaName),
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
                name: pagesCopy('techLevel'),
                value: displayData.techLevel,
              },
            },
          }
        : {}),
      assetUrl: displayData?.assetUrl,
      // The preview's words and colour come from the same card its image is
      // screenshotted from, so the text beside the image matches it.
      og: ogMetaFor(ogCardFor(schemaId, itemId, item)),
      // A shared link says what the thing is: its stats, then its own summary.
      previewDescription: previewDescriptionFor({
        kind: schemaName,
        stats: staticSummary?.stats ?? [],
        traits: staticSummary?.traits ?? [],
        summary: firstParagraph || itemDescription || undefined,
      }),
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
        contents={classContentsFor(item)}
        buy={'purchaseLink' in item ? item.purchaseLink : undefined}
        exits={guideExitsFor(schemaId, item)}
        mediator={mediatorLinksFor(schemaId, item)}
        rail={
          sparse ? (
            <SparseRail rail={sparse} tone={chapter.tone} sideLinks={sideLinks} />
          ) : undefined
        }
        foot={
          // An ability's neighbours in its tree, or a guide's in the book, under the body.
          <NeighbourRow as="h2" neighbours={neighbours} />
        }
      >
        {/* The Entity renders as one unit — interactive island card + its static
            SEO / no-JS sub-content (EntityView). */}
        {rollPage ??
          (techLevelPage ? (
            <CrawlerTechLevelPage item={item} />
          ) : (
            <EntityView
              item={item}
              schemaId={schemaId}
              sideLinks={sparse ? undefined : sideLinks}
            />
          ))}
        {/* What links here, listed back (E26). */}
        <PageRelations relations={fullWidth} />
        {/* A chassis's players' patterns, under the book's (ADR-061). It waits
            for its switch (`interaction` holds the press that wakes it and
            plays it back), or mounts in view when the reader left it on
            (`mountsNow`). */}
        {schemaId === 'chassis' && (
          <Island name="HomebrewIsland" client="interaction" ssr props={{ chassisRef: itemId }}>
            <HomebrewIsland chassisRef={itemId} />
          </Island>
        )}
      </EntityPageFrame>
    ),
  }
}

export const itemPage: PageModule<Params, Props> = {
  pattern: '/[schemaId]/[itemId]',
  getStaticPaths: getItemStaticPaths,
  page,
}
