/**
 * `/[schemaId]/[itemId]/pattern/[patternId]` — a pattern's own page: a
 * chassis's mech pattern or a Bio-Titan's variant.
 *
 * `schemaId` is the host's schema, so the route sits inside the existing
 * `/<schema>/<item>/` tree and its breadcrumbs resolve like every
 * other page's.
 */

import type { EnhancedSchemaMetadata, RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { toEntityModel, truncate } from 'salvageunion-reference'
import type {
  PageModule,
  PageResult,
  RouteContext,
  StructuredData,
} from '../../../../../../ssg/types'
import {
  assetSrcSetFor,
  heroImageSizes,
  isLegalStartingPatternOf,
  resolveEntityPageMeta,
} from '../../../../../components/index'
import { patternBuildLinkFor } from '../../../../../lib/buildLink'
import { bandFillFor, chapterForSchema } from '../../../../../lib/chapters'
import { componentEmbedFor } from '../../../../../lib/componentEmbed'
import {
  entityTitle,
  META_DESCRIPTION_MAX,
  SITE_URL,
  SRD_CRUMB,
} from '../../../../../lib/constants'
import { itemHref, patternHref, schemaHref } from '../../../../../lib/entityHref'
import { getReferenceEntityData } from '../../../../../lib/gameData'
import { ogCardFor, ogMetaFor } from '../../../../../lib/ogCard'
import { pageTitle } from '../../../../../lib/pageTitle'
import { patternStaticSummary } from '../../../../../lib/patternSummary'
import { getPatternStaticPaths } from '../../../../../lib/staticPaths'
import { EntityPageFrame } from '../../../../EntityPageFrame'
import { EntityView } from '../../../../EntityView'

type Params = { schemaId: string; itemId: string; patternId: string }

type Props = {
  host: RefEntity
  schema: EnhancedSchemaMetadata
  pattern: RefObjectAnyPattern
  hostName: string
  patternName: string
}

function page({ params, props }: RouteContext<Params, Props>): PageResult {
  const { host, schema, pattern, hostName, patternName } = props
  const { schemaId, itemId, patternId } = params

  const canonicalUrl = `${SITE_URL}${patternHref(schemaId, itemId, patternId)}`
  const hostUrl = `${SITE_URL}${itemHref(schemaId, itemId)}`
  const pluralName = schema.displayNamePlural || schema.displayName || 'Items'

  const displayData = getReferenceEntityData(host)
  const summary = patternStaticSummary(host, pattern)
  const chapter = chapterForSchema(schemaId)
  const pageMeta = resolveEntityPageMeta(host, pattern)

  // The PATTERN's own prose (`summary.description`), not the leading host
  // prose — otherwise every pattern of a host ships the same meta description
  // as the host page and as each other.
  const firstParagraph = summary.description
  const metaDescription = truncate(
    firstParagraph || `${patternName}: a ${hostName} Pattern for the Salvage Union tabletop RPG.`,
    META_DESCRIPTION_MAX
  )

  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemPage',
    name: summary.name,
    description: metaDescription,
    url: canonicalUrl,
    keywords: [
      'Salvage Union',
      'TTRPG',
      'SRD',
      'System Reference Document',
      'Pattern',
      hostName,
      patternName,
    ],
    isPartOf: {
      '@type': 'ItemPage',
      name: pageTitle(hostName),
      url: hostUrl,
    },
    mainEntity: {
      '@type': 'Thing',
      name: summary.name,
      description: metaDescription,
      ...(summary.source
        ? {
            isPartOf: {
              '@type': 'Book',
              name: summary.source,
              author: { '@type': 'Organization', name: 'Leyline Press' },
            },
          }
        : {}),
    },
  }

  // The preload MUST carry the same srcset/sizes as the <img>, or it selects a
  // different candidate and the page downloads both files. See `cardImageSizes`.
  const preloadImageSrcSet = assetSrcSetFor(displayData?.assetUrl)

  // The preview's words and colour come from the card its image is
  // screenshotted from.
  const og = ogMetaFor(ogCardFor(schemaId, itemId, host, pattern, patternId))

  return {
    meta: {
      title: entityTitle(patternName, `${hostName} Pattern`),
      description: metaDescription,
      ...og,
      componentEmbed: componentEmbedFor(host, pattern),
      canonical: canonicalUrl,
      ogType: 'article',
      structuredData,
      preloadImage: displayData?.assetUrl,
      preloadImageSrcSet,
      // The art is the page's hero, so the preload repeats ITS `sizes`.
      preloadImageSizes: preloadImageSrcSet ? heroImageSizes() : undefined,
      breadcrumbs: [
        SRD_CRUMB,
        { name: pluralName, url: `${SITE_URL}${schemaHref(schemaId)}` },
        { name: hostName, url: hostUrl },
        { name: patternName, url: canonicalUrl },
      ],
    },
    foot: { printings: pageMeta.printings },
    children: (
      <EntityPageFrame
        title={`“${patternName}”`}
        tone={chapter.tone}
        // A bio-chassis's pattern wears its chassis's green band.
        fill={bandFillFor(schemaId, host)}
        meta={pageMeta}
        parent={{
          label: 'Pattern of',
          entityRef: toEntityModel(host).ref,
          href: itemHref(schemaId, itemId),
        }}
        legalStartingPattern={isLegalStartingPatternOf(pattern)}
        build={patternBuildLinkFor(schemaId, host, pattern)}
      >
        {/* The pattern renders through the same Entity unit as every other page —
            the interactive island card (in its pattern view) plus the static
            SEO / no-JS sub-content. */}
        <EntityView item={host} schemaId={schemaId} pattern={pattern} />
      </EntityPageFrame>
    ),
  }
}

export const patternPage: PageModule<Params, Props> = {
  pattern: '/[schemaId]/[itemId]/pattern/[patternId]',
  getStaticPaths: getPatternStaticPaths,
  page,
}
