/**
 * An entity page's head: the one builder the entity and pattern show pages
 * share, so their JSON-LD, preview, preload and trail cannot drift apart.
 */

import { assetSrcSetFor, heroImageSizes } from '../components/index'
import type { DocumentMeta, StructuredData } from '../reference/types'
import { PUBLISHER, SRD_CRUMB } from './constants'
import type { ogMetaFor } from './ogCard'

type Crumb = { name: string; url: string }

type EntityPageHead = {
  /** The page's `<title>` (`entityTitle`). */
  title: string
  /** The thing's name in the structured data. */
  name: string
  description: string
  /** The page's absolute URL. */
  canonical: string
  /** The structured data's keywords, after the site's own. */
  keywords: readonly string[]
  /** The page this one is part of: its schema's listing, or a pattern's host. */
  parentPage: { type: 'CollectionPage' | 'ItemPage'; name: string; url: string }
  /** The book it is printed in, as the structured data cites it. */
  source: string | undefined
  /** Facts the structured data adds after its main entity (a tech level). */
  additional?: StructuredData
  /** The entity's art: the page's hero, which the head preloads. */
  assetUrl: string | undefined
  /** The link preview's words and colour (`ogMetaFor`). */
  og: ReturnType<typeof ogMetaFor>
  /** The page's Discord Component Embed (`componentEmbedFor`). */
  componentEmbed: string
  /** The trail between the Reference crumb and this page's own. */
  crumbs: readonly Crumb[]
  /** This page's own crumb. */
  crumb: string
}

/** The site's words every entity page's structured data is keyed by. */
const SITE_KEYWORDS = ['Salvage Union', 'TTRPG', 'SRD', 'System Reference Document'] as const

/** An entity or pattern show page's `meta`. */
export function entityPageHead(head: EntityPageHead): DocumentMeta {
  const { title, name, description, canonical, source, assetUrl } = head
  const structuredData: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemPage',
    name,
    description,
    url: canonical,
    keywords: [...SITE_KEYWORDS, ...head.keywords],
    isPartOf: {
      '@type': head.parentPage.type,
      name: head.parentPage.name,
      url: head.parentPage.url,
    },
    mainEntity: {
      '@type': 'Thing',
      name,
      description,
      ...(source ? { isPartOf: { '@type': 'Book', name: source, author: PUBLISHER } } : {}),
    },
    ...head.additional,
  }

  // The og:image is NOT set here: the page emits the site-wide default
  // (BaseLayout's DEFAULT_OG_IMAGE), and `scripts/og-screenshots.ts` rewrites
  // the meta afterwards for each entity whose card PNG rendered, so a skipped,
  // budget-capped or failed generation leaves a working default rather than an
  // og:image that 404s.
  //
  // The preload MUST carry the same srcset/sizes as the <img>, or it selects a
  // different candidate and the page downloads both files. See `cardImageSizes`.
  const preloadImageSrcSet = assetSrcSetFor(assetUrl)

  return {
    title,
    description,
    ...head.og,
    componentEmbed: head.componentEmbed,
    canonical,
    ogType: 'article',
    structuredData,
    preloadImage: assetUrl,
    preloadImageSrcSet,
    // The art is the page's hero, so the preload repeats ITS `sizes`.
    preloadImageSizes: preloadImageSrcSet ? heroImageSizes() : undefined,
    breadcrumbs: [SRD_CRUMB, ...head.crumbs, { name: head.crumb, url: canonical }],
  }
}
