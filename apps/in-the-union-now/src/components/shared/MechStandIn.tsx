/**
 * MechStandIn — placeholder rendered in pilot/view contexts when no mech
 * SoftLink exists for that pilot.
 *
 * Intentionally dumb: no entityStore access. The caller is responsible for
 * checking whether a SoftLink exists and rendering this component when it
 * does not.
 */

import { cn } from '../../lib/utils'

type MechStandInProps = {
  className?: string
}

export function MechStandIn({ className }: MechStandInProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded border border-dashed border-muted-foreground/40 px-4 py-3',
        className
      )}
      aria-label="No mech assigned"
    >
      <span className="text-sm text-muted-foreground">No Mech Assigned</span>
    </div>
  )
}
