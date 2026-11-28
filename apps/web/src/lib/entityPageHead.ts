/**
 * An entity page's head: the one builder the entity and pattern show pages
 * share, so their JSON-LD, preview, preload and trail cannot drift apart.
 */

import { truncate } from 'salvageunion-reference'
import { assetDerivativeUrl } from 'salvageunion-reference/assetDerivatives'
import { assetSrcSetFor, heroImageSizes } from '../components/index'
import { libCopy } from '../messages/lib'
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
  /**
   * The preview's description: the entity's stats and summary
   * (`previewDescriptionFor`). Without one, `og`'s kind and cite.
   */
  previewDescription?: string
  /** The page's Discord Component Embed (`componentEmbedFor`). */
  componentEmbed: string
  /** The trail between the Reference crumb and this page's own. */
  crumbs: readonly Crumb[]
  /** This page's own crumb. */
  crumb: string
}

/** The site's words every entity page's structured data is keyed by. */
const SITE_KEYWORDS = [
  libCopy('salvageUnion'),
  'TTRPG',
  'SRD',
  libCopy('systemReferenceDocument'),
] as const

/** A preview's room for words: Discord and Slack show about this much. */
const PREVIEW_DESCRIPTION_MAX = 200

/** The art's width in a preview: the widest the artwork CDN renders. */
const PREVIEW_ART_WIDTH = 880

/**
 * What a shared link says of an entity: its kind and stats as its page prints
 * them, its traits, then its own summary ("System · TL 4, RNG Long, DMG 9 SP
 * · Hot (3). A rail of…"). The summary alone where it has no stats; nothing
 * where it has neither, and the preview keeps its kind and cite.
 */
export function previewDescriptionFor({
  kind,
  stats,
  traits,
  summary,
}: {
  kind: string
  stats: readonly { label: string; value: string | number }[]
  traits: readonly string[]
  summary: string | undefined
}): string | undefined {
  const statLine = stats.map((stat) => `${stat.label} ${stat.value}`).join(', ')
  const lead = statLine ? `${[kind, statLine, traits.join(', ')].filter(Boolean).join(' · ')}.` : ''
  const line = [lead, summary?.trim()].filter(Boolean).join(' ')
  return line ? truncate(line, PREVIEW_DESCRIPTION_MAX) : undefined
}

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

  // An entity with art previews as its art (r4 F7): the artwork CDN's own
  // rendered width of it, never the print-scan master. For one without, the
  // og:image is NOT set here: the page emits the site-wide default
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
    ...(head.previewDescription ? { ogDescription: head.previewDescription } : {}),
    ...(assetUrl
      ? { ogImage: assetDerivativeUrl(assetUrl, PREVIEW_ART_WIDTH), ogImageArt: true }
      : {}),
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
