/**
 * CrawlerPilotsStandIn — placeholder rendered in crawler/view contexts when
 * no pilot SoftLinks exist for that crawler.
 *
 * Intentionally dumb: no entityStore access. The caller is responsible for
 * checking whether any SoftLinks exist and rendering this component when none
 * do.
 */

import { cn } from '../../lib/utils'

type CrawlerPilotsStandInProps = {
  className?: string
}

export function CrawlerPilotsStandIn({ className }: CrawlerPilotsStandInProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded border border-dashed border-muted-foreground/40 px-4 py-3',
        className
      )}
      aria-label="No pilots assigned"
    >
      <span className="text-sm text-muted-foreground">No Pilots Assigned</span>
    </div>
  )
}
