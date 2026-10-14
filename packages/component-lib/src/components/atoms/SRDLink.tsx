type SRDLinkProps = {
  /**
   * The resolved absolute URL to the SRD entity page. The URL logic is
   * app-specific (ITUN builds it via its own `deepLinkTo`), so it is injected
   * as a prop — this component owns only the presentation of the link.
   */
  href: string
  /** Human-readable entity name for the accessible label, e.g. "Iron Mongrel". */
  entityName?: string
  className?: string
}

/**
 * Generic cross-link to a Salvage Union SRD entity page, in this tab and with
 * no arrow: the Reference and the builder are one union, so the link is not
 * off-site (ruleset §3.11) and opens no new tab (EDL E5).
 *
 * Presentation-only: the caller resolves the destination `href` (the URL-
 * building logic is app-specific and stays in the app, per ADR-011) and passes
 * it in. This component adds the accessible label.
 */
export function SRDLink({ href, entityName, className }: SRDLinkProps) {
  const ariaLabel = entityName ? `View ${entityName} in SRD` : 'View in SRD'

  return (
    <a href={href} aria-label={ariaLabel} className={className}>
      View in SRD
    </a>
  )
}
