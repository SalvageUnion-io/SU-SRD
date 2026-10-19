import { entityHref } from '../../lib/entityHref'
import type { EntityExternalLinkBuilder } from '../index'
import { SRDLink } from '../index'

/**
 * The app's app-wide "View in the Reference" cross-link builder.
 *
 * Supplied through the UI library's `EntityExternalLinkProvider` (wired in
 * `GameDataReady`), so every FULL — non-compact, non-listing — entity card,
 * including the `useDetailModal` detail view, uniformly renders the link in
 * its foot band. Compact/listing cards stay uncluttered by design; an entity
 * with no page gets no link. The path is the app's one entity href
 * (`entityHref`, ADR-011), handed to the generic `SRDLink`.
 */
export const srdEntityExternalLink: EntityExternalLinkBuilder = (entity) => {
  const href = entityHref(entity)
  if (href === undefined) return undefined

  const entityName = 'name' in entity && typeof entity.name === 'string' ? entity.name : undefined

  return (
    <SRDLink
      href={href}
      entityName={entityName}
      // `.su-srd-entity-external-link` (styles/unitSlot.css): it fades on hover.
      className="su-srd-entity-external-link"
    />
  )
}
