/**
 * `/schema/[schemaId]/item/[itemId]/pattern/[patternId]` — a chassis pattern's
 * own page. Port of `[patternId].astro`.
 *
 * `schemaId` is always `chassis`; it stays a param so the route sits inside the
 * existing `/schema/<schema>/item/<item>/` tree and its breadcrumbs resolve
 * like every other page's.
 */

import { cardImageSizes } from 'component-lib'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import type {
  PageModule,
  PageResult,
  RouteContext,
  StructuredData,
} from '../../../../../../../ssg/types'
import { EntityView } from '../../../../../../components/EntityView'
import { SITE_URL } from '../../../../../../lib/constants'
import { itemHref, patternHref, schemaHref } from '../../../../../../lib/entityHref'
import { getReferenceEntityData } from '../../../../../../lib/gameData'
import { patternStaticSummary } from '../../../../../../lib/patternSummary'
import { getPatternStaticPaths } from '../../../../../../lib/staticPaths'

type Params = { schemaId: string; itemId: string; patternId: string }

type Props = {
  chassis: SURefEntity
  pattern: SURefObjectPattern
  chassisName: string
  patternName: string
}

function page({ params, props }: RouteContext<Params, Props>): PageResult {
  const { chassis, pattern, chassisName, patternName } = props
  const { schemaId, itemId, patternId } = params

  const canonicalUrl = `${SITE_URL}${patternHref(schemaId, itemId, patternId)}`
  const chassisUrl = `${SITE_URL}${itemHref(schemaId, itemId)}`

  const displayData = getReferenceEntityData(chassis)
  const summary = patternStaticSummary(chassis, pattern)

  // The PATTERN's own prose (`summary.description`), not the leading chassis
  // prose — otherwise every pattern of a chassis ships the same meta description
  // as the chassis page and as each other.
  const firstParagraph = summary.description
  const metaDescription = firstParagraph
    ? firstParagraph.length > 155
      ? `${firstParagraph.slice(0, 152)}...`
      : firstParagraph
    : `${patternName}: a ${chassisName} Pattern for the Salvage Union tabletop RPG.`

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
      chassisName,
      patternName,
    ],
    isPartOf: {
      '@type': 'ItemPage',
      name: `${chassisName} - Salvage Union SRD`,
      url: chassisUrl,
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

  return {
    meta: {
      title: `${patternName} - ${chassisName} Pattern - Salvage Union System Reference Document`,
      description: metaDescription,
      canonical: canonicalUrl,
      ogType: 'article',
      structuredData,
      preloadImage: displayData?.assetUrl,
      // Same srcset/sizes as the <img>, or the preload fetches a second file.
      preloadImageSrcSet: displayData?.assetSrcSet,
      preloadImageSizes: displayData?.assetSrcSet ? cardImageSizes() : undefined,
      breadcrumbs: [
        { name: 'SRD', url: `${SITE_URL}/` },
        { name: 'Chassis', url: `${SITE_URL}${schemaHref(schemaId)}` },
        { name: chassisName, url: chassisUrl },
        { name: patternName, url: canonicalUrl },
      ],
    },
    children: (
      <article className="flex min-h-full flex-1 flex-col items-center justify-center p-4">
        {/* The pattern renders through the same Entity unit as every other page —
            the interactive island card (in its pattern view) plus the static
            SEO / no-JS sub-content. */}
        <EntityView item={chassis} schemaId={schemaId} pattern={pattern} />
      </article>
    ),
  }
}

export const patternPage: PageModule<Params, Props> = {
  pattern: '/schema/[schemaId]/item/[itemId]/pattern/[patternId]',
  getStaticPaths: getPatternStaticPaths,
  page,
}
