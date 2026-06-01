import type { SURefEntity } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'

/**
 * Build the SRD show-page href for an entity: `/schema/<schema>/item/<slug>/`.
 *
 * NOTE: this is the one place that couples a nested "View Details" link to the
 * suref-web reference-site route shape. It assumes that route exists. If a
 * consumer with different routing (e.g. ITUN) needs nested detail links, inject
 * a builder instead of relying on this default.
 */
export function getEntityDetailHref(
  entity: SURefEntity & { schemaName?: string }
): string | undefined {
  const schemaName =
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  if (!schemaName) {
    return undefined
  }
  return `/schema/${schemaName}/item/${getEntitySlug(entity)}/`
}
