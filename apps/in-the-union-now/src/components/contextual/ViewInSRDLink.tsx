import { deepLinkTo } from '../../lib/suref-web-deep-link'

type ViewInSRDLinkProps = {
  schemaName: string
  slug: string
  className?: string
}

/**
 * Link component that deep-links to a suref-web entity page.
 * Opens in a new tab.
 */
export function ViewInSRDLink({ schemaName, slug, className }: ViewInSRDLinkProps) {
  const href = deepLinkTo({ schemaName, slug })

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      View in SRD →
    </a>
  )
}
