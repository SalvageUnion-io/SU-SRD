import { useMemo } from 'react'
import { Text } from 'suref-react'
import { Check, Loader2 } from 'lucide-react'
import type { PilotRow, DowntimeRecordRow } from '../../../types/common'
import type { CraftReceipt } from '../../../lib/craftUtils'

type CraftMediatorViewProps = {
  pilots: PilotRow[]
  activeDowntime: DowntimeRecordRow
}

export function CraftMediatorView({ pilots, activeDowntime }: CraftMediatorViewProps) {
  if (pilots.length === 0) {
    return (
      <Text variant="default" as="p" className="py-4 text-center text-su-white/50">
        No pilots assigned to this crawler.
      </Text>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {pilots.map((pilot) => (
        <PilotCraftStatus key={pilot.id} pilot={pilot} activeDowntime={activeDowntime} />
      ))}
    </div>
  )
}

function PilotCraftStatus({
  pilot,
  activeDowntime,
}: {
  pilot: PilotRow
  activeDowntime: DowntimeRecordRow
}) {
  const receipt = useMemo(() => {
    const receipts = activeDowntime.craft_receipts as Record<string, CraftReceipt> | null
    return receipts?.[pilot.id] ?? undefined
  }, [activeDowntime.craft_receipts, pilot.id])

  const craftedCount = receipt?.crafted_items.length ?? 0

  return (
    <div className="flex items-center gap-2 rounded border border-su-white/10 bg-su-black/20 px-3 py-2">
      {craftedCount > 0 ? (
        <Check className="h-4 w-4 text-su-green" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin text-su-white/40" />
      )}
      <Text variant="pseudoheader" as="span" className="text-xs">
        {pilot.callsign}
      </Text>
      <Text variant="default" as="span" className="ml-auto text-[10px] text-su-white/40">
        {craftedCount > 0
          ? `Crafted: ${craftedCount} item${craftedCount !== 1 ? 's' : ''}`
          : 'No crafting'}
      </Text>
    </div>
  )
}
