import type { RefEntity, RefMetaEntity } from 'salvageunion-reference'
import { assetUrl, getAssetUrl, getEntitySlug } from 'salvageunion-reference'

/**
 * The books whose covers are in the art store, at `sources/<slug>.webp`: each
 * digital edition's cover page. The list lives here, in the site, not as a
 * `hasArtwork` flag in the game data. The Workshop Manual's is not in the
 * bucket yet; We Were Here First and False Flag have none.
 */
const SOURCE_COVERS: ReadonlySet<string> = new Set([
  'salvage-union-starter-set',
  'rainmaker',
  'reclamation-of-the-wastes',
  'the-hive',
  'thatchers-mech-base',
  'relics-of-a-time-gone-by',
])

/** Whether an entity's art is a book's cover from the list above (drawn bare, no frame). */
export function isBookCover(entity: RefMetaEntity): boolean {
  if (getAssetUrl(entity)) return false
  const slug = getEntitySlug(entity as unknown as RefEntity)
  return 'schemaName' in entity && entity.schemaName === 'sources' && SOURCE_COVERS.has(slug)
}

/** An entity's artwork: its own (`getAssetUrl`), or a book's cover from the list above. */
export function artUrlFor(entity: RefMetaEntity): string | undefined {
  const own = getAssetUrl(entity)
  if (own) return own
  // The slug helper is typed for the entity union; every meta entity has one.
  const slug = getEntitySlug(entity as unknown as RefEntity)
  const isSource = 'schemaName' in entity && entity.schemaName === 'sources'
  return isSource && SOURCE_COVERS.has(slug) ? assetUrl(`sources/${slug}.webp`) : undefined
}
