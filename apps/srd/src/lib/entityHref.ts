import { getEntitySlug } from 'salvageunion-reference'
import type { EntityHrefBuilder } from 'component-lib'

/**
 * srd's show-page route for an entity: `/schema/<schema>/item/<slug>/`.
 * Supplied to component-lib via `EntityHrefProvider` so nested "View Details"
 * links resolve to this app's routes (the shared library stays route-agnostic).
 */
export const srdEntityHref: EntityHrefBuilder = (entity) => {
  const schemaName =
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  return schemaName ? `/schema/${schemaName}/item/${getEntitySlug(entity)}/` : undefined
}
