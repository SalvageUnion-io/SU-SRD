import { getEntitySlug } from 'salvageunion-reference'
import { deepLinkTo, hasSRDPage } from '../../lib/srd-deep-link'
import type { EntityExternalLinkBuilder } from '../index'
import { SRDLink } from '../index'

/**
 * The Cantina's app-wide "View in SRD" cross-link builder.
 *
 * Supplied through the UI library's `EntityExternalLinkProvider` (wired in
 * `GameDataReady`), so every FULL — non-compact, non-listing — entity card,
 * including the `useDetailModal` detail view, uniformly renders the link in
 * its foot band. Compact/listing cards stay uncluttered by design; entities
 * whose schema has no srd page get no link. The srd URL is resolved here, in
 * the app (`deepLinkTo`, ADR-011), and handed to the generic `SRDLink`.
 */
export const srdEntityExternalLink: EntityExternalLinkBuilder = (entity) => {
  const schemaName =
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  if (!schemaName || !hasSRDPage(schemaName)) return undefined

  const entityName = 'name' in entity && typeof entity.name === 'string' ? entity.name : undefined

  return (
    <SRDLink
      href={deepLinkTo({ schemaName, slug: getEntitySlug(entity) })}
      entityName={entityName}
      // `.su-srd-entity-external-link` (styles/unitSlot.css): it fades on hover.
      className="su-srd-entity-external-link"
    />
  )
}
