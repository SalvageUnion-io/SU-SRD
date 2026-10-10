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
} from 'component-lib'
import type {
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectPattern,
} from 'salvageunion-reference'
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
  pattern?: SURefObjectPattern,
  patternId?: string
): OgCardProps {
  const href =
    pattern && patternId ? patternHref(schemaId, itemId, patternId) : itemHref(schemaId, itemId)
  return ogCardForEntity({
    schemaName: schemaId as SURefEnumSchemaName,
    entity,
    pattern,
    // The foot prints the path; its wordmark already says SalvageUnion.io.
    address: href.slice(0, -1),
  })
}

/**
 * The head tags a preview needs beyond the image: `og:title` is the name,
 * `og:description` the kicker and byline (never the body), and `theme-color`
 * the band's tone so Discord's side bar matches the card.
 */
export function ogMetaFor(card: OgCardProps): {
  ogTitle: string
  ogDescription: string
  themeColor: string
} {
  return {
    ogTitle: ogCardTitle(card),
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
