import { Text } from 'suref-react'
import { Check, Loader2 } from 'lucide-react'
import { useMechCargo } from '../../../hooks/useMechs'
import type { PilotRow } from '../../../types/common'

type TallySalvageMediatorViewProps = {
  pilots: PilotRow[]
  compact?: boolean
}

function PilotOffloadStatus({ pilot }: { pilot: PilotRow }) {
  const { data: cargo, isLoading } = useMechCargo(pilot.mech_id ?? undefined)
  const isOffloaded = !isLoading && (!cargo || cargo.length === 0)

  return (
    <div className="flex items-center gap-2 rounded border border-su-white/10 bg-su-black/20 px-3 py-2">
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-su-white/40" />
      ) : isOffloaded ? (
        <Check className="h-4 w-4 text-su-green" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin text-su-orange" />
      )}
      <Text variant="pseudoheader" as="span" className="text-xs">
        {pilot.callsign}
      </Text>
      <Text variant="default" as="span" className="ml-auto text-[10px] text-su-white/40">
        {isLoading ? 'Loading...' : isOffloaded ? 'Done' : 'Offloading...'}
      </Text>
    </div>
  )
}

export function TallySalvageMediatorView({
  pilots,
  compact = true,
}: TallySalvageMediatorViewProps) {
  if (pilots.length === 0) {
    return (
      <Text variant="default" as="p" className="py-4 text-center text-su-white/50">
        No pilots assigned to this crawler.
      </Text>
    )
  }

  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2'}`}>
      {pilots.map((pilot) => (
        <PilotOffloadStatus key={pilot.id} pilot={pilot} />
      ))}
    </div>
  )
}
