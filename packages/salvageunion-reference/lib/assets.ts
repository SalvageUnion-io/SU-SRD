/**
 * Artwork URL derivation.
 *
 * Split out of the old `lib/utilities.ts` grab bag; still re-exported from
 * there (and from the package barrel), so this is an internal home, not a new
 * public surface.
 */

import type { SURefMetaEntity } from './types/index.js'
import { getEntitySlug } from './slug.js'

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
