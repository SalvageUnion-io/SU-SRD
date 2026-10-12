type SRDLinkProps = {
  /**
   * The resolved absolute URL to the SRD entity page. The URL logic is
   * app-specific (ITUN builds it via its own `deepLinkTo`), so it is injected
   * as a prop — this component owns only the presentation of the link.
   */
  href: string
  /** Human-readable entity name for the accessible label, e.g. "Iron Mongrel". */
  entityName?: string
  /** Visible link text. Defaults to the canonical "View in SRD →". */
  label?: string
  className?: string
}

/**
 * Generic cross-link to a Salvage Union SRD entity page. Opens in a new tab.
 *
 * Presentation-only: the caller resolves the destination `href` (the URL-
 * building logic is app-specific and stays in the app, per ADR-011) and passes
 * it in. This component adds the new-tab + security attributes and the
 * accessible label.
 */
export function SRDLink({ href, entityName, label = 'View in SRD →', className }: SRDLinkProps) {
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
      {label}
    </a>
  )
}
