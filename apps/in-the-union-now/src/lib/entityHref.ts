import { getEntitySlug } from 'salvageunion-reference'
import type { EntityHrefBuilder } from 'suref-react'

import { deepLinkTo } from './suref-web-deep-link'

/**
 * ITUN's entity href builder for nested reference-entity links (gap 35).
 * ITUN has no in-app SRD item routes, so nested "View Details" links resolve
 * to the suref-web SRD show page via deepLinkTo (slugs, never UUIDs).
 * Supplied app-wide through `EntityHrefProvider` in routes/__root.tsx.
 */
export const itunEntityHref: EntityHrefBuilder = (entity) => {
  const schemaName =
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  return schemaName ? deepLinkTo({ schemaName, slug: getEntitySlug(entity) }) : undefined
}
