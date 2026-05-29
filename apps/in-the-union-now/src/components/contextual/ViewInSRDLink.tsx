import { deepLinkTo } from '../../lib/suref-web-deep-link'

type ViewInSRDLinkProps = {
  schemaName: string
  slug: string
  /** Human-readable entity name for the accessible label, e.g. "Iron Mongrel". */
  entityName?: string
  className?: string
}

/**
 * Link component that deep-links to a suref-web entity page.
 * Opens in a new tab.
 */
export function ViewInSRDLink({ schemaName, slug, entityName, className }: ViewInSRDLinkProps) {
  const href = deepLinkTo({ schemaName, slug })
  const ariaLabel = entityName
    ? `View ${entityName} in SRD (opens in new tab)`
    : 'View in SRD (opens in new tab)'

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className={className}
    >
      View in SRD →
    </a>
  )
}
