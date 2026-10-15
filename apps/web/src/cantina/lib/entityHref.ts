import { getEntitySlug } from 'salvageunion-reference'
import type { EntityHrefBuilder } from '../../ui/index'
import { deepLinkTo, hasSRDPage } from './srd-deep-link'

/**
 * The Cantina's entity href builder for nested reference-entity links.
 * The Cantina has no in-app SRD item routes, so nested "View Details" links resolve
 * to the srd SRD show page via deepLinkTo (slugs, never UUIDs).
 * Supplied app-wide through `EntityHrefProvider` in routes/__root.tsx.
 *
 * Gated on `hasSRDPage`, exactly like `srdEntityExternalLink` — srd publishes
 * no item page for a meta schema, so an ungated link on e.g. an action would
 * render as a link and 404. No href means the card renders plain text.
 */
export const cantinaEntityHref: EntityHrefBuilder = (entity) => {
  const schemaName =
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  if (!schemaName || !hasSRDPage(schemaName)) return undefined
  return deepLinkTo({ schemaName, slug: getEntitySlug(entity) })
}
