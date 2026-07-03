import { getEntitySlug } from 'salvageunion-reference'
import type { EntityExternalLinkBuilder } from 'suref-react'

import { hasSRDPage } from '../../lib/suref-web-deep-link'
import { ViewInSRDLink } from './ViewInSRDLink'

/**
 * ITUN's app-wide "View in SRD →" cross-link builder (design review P-3).
 *
 * Supplied through suref-react's `EntityExternalLinkProvider` (wired in
 * `GameDataReady`), so every FULL — non-compact, non-listing — entity card,
 * including the `useDetailModal` detail view, uniformly renders the link in
 * its foot band. Compact/listing cards stay uncluttered by design; entities
 * whose schema has no suref-web page get no link.
 */
export const srdEntityExternalLink: EntityExternalLinkBuilder = (entity) => {
  const schemaName =
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  if (!schemaName || !hasSRDPage(schemaName)) return undefined

  const entityName = 'name' in entity && typeof entity.name === 'string' ? entity.name : undefined

  return (
    <ViewInSRDLink
      schemaName={schemaName}
      slug={getEntitySlug(entity)}
      entityName={entityName}
      className="underline decoration-1 underline-offset-2 transition-opacity hover:opacity-70"
    />
  )
}
