import { SRDLink } from 'component-lib'

import { deepLinkTo } from '../../lib/srd-deep-link'

type ViewInSRDLinkProps = {
  schemaName: string
  slug: string
  /** Human-readable entity name for the accessible label, e.g. "Iron Mongrel". */
  entityName?: string
  className?: string
}

/**
 * ITUN adapter for the shared `SRDLink`. Owns the app-specific bit — resolving
 * the srd deep-link URL via `deepLinkTo` (ADR-011: the URL logic stays in the
 * app) — and hands the resolved `href` to the generic component-lib link.
 */
export function ViewInSRDLink({ schemaName, slug, entityName, className }: ViewInSRDLinkProps) {
  return (
    <SRDLink
      href={deepLinkTo({ schemaName, slug })}
      entityName={entityName}
      className={className}
    />
  )
}
