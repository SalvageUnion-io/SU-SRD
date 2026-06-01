/**
 * PilotStandIn — placeholder rendered in mech/view contexts when no pilot
 * SoftLink exists for that mech.
 *
 * Intentionally dumb: no entityStore access. The caller is responsible for
 * checking whether a SoftLink exists and rendering this component when it
 * does not.
 */

import { cn } from '../../lib/utils'

type PilotStandInProps = {
  className?: string
}

export function PilotStandIn({ className }: PilotStandInProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded border border-dashed border-muted-foreground/40 px-4 py-3',
        className
      )}
      aria-label="No pilot assigned"
    >
      <span className="text-sm text-muted-foreground">No Pilot Assigned</span>
    </div>
  )
}
