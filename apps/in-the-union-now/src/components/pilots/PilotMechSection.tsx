import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import type { PilotRow } from '../../types/common'

type PilotMechSectionProps = {
  pilot: PilotRow
  compact?: boolean
  readOnly?: boolean
  mech?: { id: string; pattern_name: string | null } | null
  mechLoading: boolean
}

export function PilotMechSection({
  pilot,
  compact,
  readOnly,
  mech,
  mechLoading,
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
        <p className={`${compact ? 'text-xs' : 'text-sm'} text-su-grey-dark`}>
          Mech loaded — switch to the Mech tab.
        </p>
      ) : null}
    </div>
  )
}
