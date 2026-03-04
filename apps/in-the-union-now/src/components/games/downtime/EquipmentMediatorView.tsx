import { useMemo } from 'react'
import { Text } from 'suref-react'
import { Check, Loader2 } from 'lucide-react'
import type { PilotRow, DowntimeRecordRow } from '../../../types/common'
import { hasObtainedEquipment } from '../../../lib/equipmentUtils'
import type { EquipmentReceipt } from '../../../lib/equipmentUtils'

type EquipmentMediatorViewProps = {
  pilots: PilotRow[]
  activeDowntime: DowntimeRecordRow
}

export function EquipmentMediatorView({ pilots, activeDowntime }: EquipmentMediatorViewProps) {
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
        <PilotEquipmentStatus key={pilot.id} pilot={pilot} activeDowntime={activeDowntime} />
      ))}
    </div>
  )
}

function PilotEquipmentStatus({
  pilot,
  activeDowntime,
}: {
  pilot: PilotRow
  activeDowntime: DowntimeRecordRow
}) {
  const receipt = useMemo(() => {
    const receipts = activeDowntime.equipment_receipts as Record<string, EquipmentReceipt> | null
    return receipts?.[pilot.id] ?? undefined
  }, [activeDowntime.equipment_receipts, pilot.id])

  const obtained = hasObtainedEquipment(receipt)

  return (
    <div className="flex items-center gap-2 rounded border border-su-white/10 bg-su-black/20 px-3 py-2">
      {obtained ? (
        <Check className="h-4 w-4 text-su-green" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin text-su-white/40" />
      )}
      <Text variant="pseudoheader" as="span" className="text-xs">
        {pilot.callsign}
      </Text>
      <Text variant="default" as="span" className="ml-auto text-[10px] text-su-white/40">
        {obtained ? `Obtained: ${receipt!.item!.name}` : 'No equipment'}
      </Text>
    </div>
  )
}
