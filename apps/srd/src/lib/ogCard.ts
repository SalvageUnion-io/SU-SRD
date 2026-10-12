/**
 * The per-entity link preview (issue 1280): one `OgCard` per entity page,
 * screenshotted at build.
 *
 * One module so the render surface (`OgCardIsland` on `/og-card/`), the
 * generator (`scripts/og-screenshots.ts`) and the pages that reference the
 * output can never disagree about what the card says or where its PNG lives.
 */
import type { OgCardProps } from 'component-lib'
import {
  OG_CARD_HEIGHT,
  OG_CARD_WIDTH,
  ogCardDescription,
  ogCardForEntity,
  ogCardThemeColor,
  ogCardTitle,
  ogReferenceAddressFits,
} from 'component-lib'
import type {
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectAnyPattern,
} from 'salvageunion-reference'
import { displayTitle } from 'salvageunion-reference'
import { itemHref, patternHref } from './entityHref'

/**
 * og:image canvas. 1200×630 is the size BaseLayout declares for every image the
 * site emits (`og:image:width` / `:height`), and the ratio Slack/Discord/X/
 * Facebook render a "large" link card at. It is OgCard's own size, so the
 * card is screenshotted 1:1 with no fitting or resampling.
 */
export const OG_WIDTH = OG_CARD_WIDTH
export const OG_HEIGHT = OG_CARD_HEIGHT

/** What a page's link preview card says, for one entity or chassis pattern. */
export function ogCardFor(
  schemaId: string,
  itemId: string,
  entity: SURefMetaEntity,
  pattern?: SURefObjectAnyPattern,
  patternId?: string
): OgCardProps {
  const href =
    pattern && patternId ? patternHref(schemaId, itemId, patternId) : itemHref(schemaId, itemId)
  return ogCardForEntity({
    schemaName: schemaId as SURefEnumSchemaName,
    entity,
    pattern,
    address: ogAddress(href),
  })
}

/**
 * What the foot prints for a page: its bare path, as board OgCard does
 * (`/chassis/scrapper`). The SalvageUnion.io wordmark beside it already names
 * the host, and the grammar's constant `schema` and `item` segments say
 * nothing about where the link goes.
 *
 * The address is a readout, so it is never clipped. A path too long for the
 * foot's one line (`/roll-tables/salvage-cache-table-reclamation-of-the-wastes`)
 * steps down to the slug alone, which holds the longest SRD slug.
 */
export function ogAddress(href: string): string {
  const parts = href.split('/').filter((part) => part.length > 0)
  const bare = parts.filter(
    (part, index) => !(index === 0 && part === 'schema') && !(index === 2 && part === 'item')
  )
  const path = `/${bare.join('/')}`
  return ogReferenceAddressFits(path) ? path : `/${parts.at(-1) ?? ''}`
}

/**
 * The head tags a preview needs beyond the image: `og:title` is the name as
 * the book prints it (the card sets it in caps; the tag is plain text),
 * `og:description` the kicker and byline (never the body), and `theme-color`
 * the band's tone so Discord's side bar matches the card.
 */
export function ogMetaFor(card: OgCardProps): {
  ogTitle: string
  ogDescription: string
  themeColor: string
} {
  return {
    ogTitle: displayTitle(ogCardTitle(card)),
    ogDescription: ogCardDescription(card),
    themeColor: ogCardThemeColor(card),
  }
}

/**
 * Where an entity's og:image lives, relative to the site root.
 *
 * The generator writes the PNG here and rewrites the matching page's `og:image`
 * to point at it — keep both derived from this one function so a rename can't
 * silently 404 every social preview.
 *
 * A chassis pattern is addressed as an entity in its own right (it has its own
 * page, its own card and its own provenance), mirroring its page URL with
 * the `.og.png` suffix moved to the end.
 *
 * "Mirrors the page URL" is enforced, not merely asserted: the path is DERIVED
 * from the same `itemHref`/`patternHref` grammar the page routes are built from,
 * with the trailing slash swapped for the extension. Hand-writing the segments
 * here a second time is how a route rename silently 404s every social preview.
 */
export function ogImagePath(schemaId: string, itemId: string, patternId?: string): string {
  const pageHref = patternId ? patternHref(schemaId, itemId, patternId) : itemHref(schemaId, itemId)
  return `${pageHref.slice(0, -1)}.og.png`
}
