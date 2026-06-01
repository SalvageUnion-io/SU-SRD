import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import type { PilotRow, MechRow } from '../../types/common'

type PilotMechSectionProps = {
  pilot: PilotRow
  compact?: boolean
  readOnly?: boolean
  mech?: Pick<MechRow, 'id' | 'pattern_name' | 'active'> | null
  mechLoading: boolean
  onShutdown?: () => void
  onActivate?: () => void
}

export function PilotMechSection({
  pilot,
  compact,
  readOnly,
  mech,
  mechLoading,
  onShutdown,
  onActivate,
}: PilotMechSectionProps) {
  const navigate = useNavigate()

  return (
    <div>
      {!pilot.mech_id ? (
        readOnly ? (
          <p className={`${compact ? 'text-xs' : 'text-sm'} text-su-grey-dark`}>
            No mech assigned.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-su-grey-light/50 p-6">
            <p className={`${compact ? 'text-xs' : 'text-sm'} text-su-grey-dark`}>
              No mech assigned yet.
            </p>
            <Button
              size="sm"
              onClick={() =>
                navigate({ to: '/pilots/$pilotId/create-mech', params: { pilotId: pilot.id } })
              }
              className="font-mono text-xs uppercase"
            >
              <Plus className="h-4 w-4" />
              Create Starting Mech
            </Button>
          </div>
        )
      ) : mechLoading ? (
        <Skeleton className="h-[40px] rounded-md" />
      ) : mech ? (
        <div className="flex flex-col gap-2">
          <p className={`${compact ? 'text-xs' : 'text-sm'} text-su-grey-dark`}>
            Mech loaded — switch to the Mech tab.
          </p>
          {!readOnly && (
            <div className="flex gap-2">
              {mech.active === true && onShutdown && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onShutdown}
                  className="font-mono text-xs uppercase"
                >
                  Shut Down
                </Button>
              )}
              {mech.active === false && onActivate && (
                <Button
                  size="sm"
                  onClick={onActivate}
                  disabled={pilot.ap < 1}
                  className="font-mono text-xs uppercase"
                >
                  Activate (1 AP)
                </Button>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
