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
 * Base URL of the artwork CDN — the `su-assets` Cloudflare Worker, backed by the
 * `su-lp-assets` R2 bucket. Asset URLs are derived from this base plus the
 * entity's schema name and slug; see getAssetUrl().
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
