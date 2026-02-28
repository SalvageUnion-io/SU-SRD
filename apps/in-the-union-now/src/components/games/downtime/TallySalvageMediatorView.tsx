import { StatDisplay, Text } from 'suref-react'
import { Check, Loader2 } from 'lucide-react'
import { useMechCargo } from '../../../hooks/useMechs'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../../ui/tooltip'
import type { PilotRow } from '../../../types/common'
import type { OffloadReceipt } from '../../../lib/tallySalvageUtils'

type TallySalvageMediatorViewProps = {
  pilots: PilotRow[]
  offloadReceipts?: Record<string, OffloadReceipt>
  compact?: boolean
}

function PilotOffloadStatus({ pilot, receipt }: { pilot: PilotRow; receipt?: OffloadReceipt }) {
  const { data: cargo, isLoading } = useMechCargo(pilot.mech_id ?? undefined)
  const isOffloaded = !isLoading && (!cargo || cargo.length === 0)

  const row = (
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

  if (!receipt || !isOffloaded) return row

  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="top" className="border-su-white/20 bg-su-grey-dark">
        <div className="flex flex-col gap-1.5 py-1">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(receipt.scrapByTL)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([tl, amount]) => (
                <StatDisplay key={`tl-${tl}`} label={`TL${tl}`} value={amount} compact />
              ))}
            {Object.keys(receipt.scrapByTL).length === 0 && (
              <Text variant="default" as="span" className="text-xs text-su-white/30">
                No scrap
              </Text>
            )}
          </div>
          {receipt.storageCount > 0 && (
            <StatDisplay
              label="Storage"
              value={receipt.storageCount}
              compact
              bg="bg-su-pink/20"
              borderColor="border-su-pink/50"
            />
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export function TallySalvageMediatorView({
  pilots,
  offloadReceipts,
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
    <TooltipProvider delayDuration={200}>
      <div className={`grid gap-2 ${compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2'}`}>
        {pilots.map((pilot) => (
          <PilotOffloadStatus key={pilot.id} pilot={pilot} receipt={offloadReceipts?.[pilot.id]} />
        ))}
      </div>
    </TooltipProvider>
  )
}
