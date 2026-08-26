/**
 * URL derivation for the two hosts the dataset addresses: the artwork CDN
 * (`assets.salvageunion.io`) and the public reference site
 * (`salvageunion.io`).
 *
 * Both bases live here for the same reason: an entity's artwork URL and its
 * reference-site page are DERIVED from the dataset (schema name + slug), so
 * the grammar belongs with the dataset rather than being retyped by every
 * surface that links out.
 *
 * Split out of the old `lib/utilities.ts` grab bag; still re-exported from
 * there (and from the package barrel), so this is an internal home, not a new
 * public surface.
 */

import { getEntitySlug } from './slug.js'
import type { SURefMetaEntity } from './types/index.js'

/**
 * Base URL of the Netlify-hosted artwork CDN (the su-assets site, backed by a
 * Netlify Blobs store). Asset URLs are derived from this base plus the entity's
 * schema name and slug — see getAssetUrl().
 */

export const ASSET_BASE_URL = 'https://assets.salvageunion.io'

/**
 * Derive an entity's asset URL from its schema name and slug.
 *
 * Artwork is unified on WebP, so the whole URL is inferred:
 * `{ASSET_BASE_URL}/{schemaName}/{slug}.webp`. The boolean `hasArtwork` flag
 * marks which entities have artwork; the slug matches `getEntitySlug`, so the
 * artwork path lines up with the entity's canonical reference path.
 *
 * @param entity - The entity to derive from (must carry a stamped `schemaName`)
 * @returns The asset URL, or undefined if the entity has no artwork
 */

export function getAssetUrl(entity: SURefMetaEntity): string | undefined {
  if (!('hasArtwork' in entity) || entity.hasArtwork !== true) {
    return undefined
  }
  if (!('schemaName' in entity) || typeof entity.schemaName !== 'string') {
    return undefined
  }
  const slug = getEntitySlug(entity)
  return `${ASSET_BASE_URL}/${entity.schemaName}/${slug}.webp`
}

/**
 * The derivative widths that exist in the asset store beside every master.
 *
 * Written by `tools/generate-lp-asset-derivatives.ts`. The render slot is 220
 * CSS px (`CardImage`'s container), so 440 covers a 2x display and 880 covers
 * 4x. **Changing this list means re-running that tool** — a width named here
 * with no object behind it is a 404 in a `srcset`, which browsers handle by
 * quietly falling back rather than by telling anyone.
 */
export const ASSET_DERIVATIVE_WIDTHS = [440, 880] as const

/**
 * An entity's artwork as a `srcset`, or undefined if it has none.
 *
 * The masters are print scans — measured across all 57, 30.9 MB total, up to
 * 1,295,746 B and 6098x7016 (42.8 megapixels) — and they were being delivered
 * whole into a 220px slot. That is a ~28x linear oversample, and it made an
 * illustrated entity page roughly 1.3 MB for a thumbnail.
 *
 * The master stays the widest candidate rather than being dropped: it is what
 * the og:image screenshot pass renders (catalog tile at a 1440 viewport), and
 * it is the only source that survives if the derivatives are ever pruned.
 *
 * Pair with `sizes` — without it a browser assumes `100vw` and picks the widest
 * candidate, which is exactly the behaviour this replaces.
 */
export function getAssetSrcSet(entity: SURefMetaEntity): string | undefined {
  const master = getAssetUrl(entity)
  if (!master) return undefined
  const derivatives = ASSET_DERIVATIVE_WIDTHS.map(
    (width) => `${master.replace(/\.webp$/, `-${width}.webp`)} ${width}w`
  )
  // A `w` descriptor for the master would be a guess: masters vary from 1772px
  // to 7196px wide and the entity carries no dimensions. Omitting it is not an
  // option either — a candidate with no descriptor is treated as `1x` and
  // competes with the `w` set. So the master is deliberately NOT in the srcset;
  // it stays on `src`, which is what a browser uses when no candidate fits and
  // what a `srcset`-blind client gets.
  return derivatives.join(', ')
}

/**
 * Origin of the public Salvage Union reference site (the `apps/srd` Netlify
 * site). Every deep link into the SRD — from ITUN, from the Discord bot, from
 * the site's own canonical/OG tags — is this base plus {@link srdEntityPath},
 * so the host is named once here rather than retyped per surface.
 */

export const SRD_SITE_URL = 'https://salvageunion.io'

/**
 * The reference site's ROOT-RELATIVE path for one entity's page.
 *
 * This is the site's route grammar (`/schema/{schemaName}/item/{slug}` — it
 * matches the srd `getStaticPaths`), expressed once. The srd site itself wants
 * the relative form (it is that origin); anything linking in from outside
 * prefixes {@link SRD_SITE_URL} via {@link srdEntityUrl}.
 *
 * Takes the SLUG rather than the entity, because callers arrive with either —
 * a resolved entity (slug it with `getEntitySlug`) or a bare name already run
 * through `nameToSlug` (the bot's trait/table/drone links).
 *
 * @param schemaName - The entity's schema id (e.g. `'chassis'`)
 * @param slug - The entity's slug
 * @returns The root-relative page path
 */

export function srdEntityPath(schemaName: string, slug: string): string {
  return `${srdSchemaPath(schemaName)}/item/${slug}`
}

/**
 * The reference site's ROOT-RELATIVE path for one schema's LISTING page.
 *
 * The other half of the route grammar, and it exists for the same reason
 * {@link srdEntityPath} does. Both are written WITHOUT a trailing slash; srd
 * emits directory-style output and appends the slash itself in exactly one
 * place (`apps/srd/src/lib/entityHref.ts`), so the slash is a rendering
 * decision of that app rather than part of the grammar.
 *
 * Keep this the only place either shape is spelled. Two modules previously each
 * claimed to be the single source of the route grammar and disagreed on the
 * trailing slash — the package emitted `/schema/x/item/y` while srd emitted
 * `/schema/x/item/y/`. Directory-style output meant the un-slashed form
 * redirected rather than 404ing, so the divergence cost a hop on every bot and
 * ITUN deep link and split the canonical URL in two, without ever failing.
 *
 * @param schemaName - The entity's schema id (e.g. `'chassis'`)
 * @returns The root-relative listing path
 */
export function srdSchemaPath(schemaName: string): string {
  return `/schema/${schemaName}`
}

/**
 * The reference site's ABSOLUTE URL for one schema's listing page —
 * {@link SRD_SITE_URL} + {@link srdSchemaPath}.
 *
 * @param schemaName - The entity's schema id (e.g. `'chassis'`)
 * @returns The absolute listing URL
 */
export function srdSchemaUrl(schemaName: string): string {
  return `${SRD_SITE_URL}${srdSchemaPath(schemaName)}`
}

/**
 * The reference site's ABSOLUTE URL for one entity's page —
 * {@link SRD_SITE_URL} + {@link srdEntityPath}.
 *
 * @param schemaName - The entity's schema id (e.g. `'chassis'`)
 * @param slug - The entity's slug
 * @returns The absolute page URL
 */

export function srdEntityUrl(schemaName: string, slug: string): string {
  return `${SRD_SITE_URL}${srdEntityPath(schemaName, slug)}`
}
