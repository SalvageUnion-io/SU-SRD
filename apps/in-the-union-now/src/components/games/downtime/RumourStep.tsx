import { useMemo } from 'react'
import { Text } from 'suref-react'
import { Loader2, AlertTriangle, MessageSquare } from 'lucide-react'
import { isCantinaDamaged } from '../../../lib/bayDamageUtils'
import { hasReceivedRumour } from '../../../lib/rumourUtils'
import type { RumourReceipt } from '../../../lib/rumourUtils'
import type { DowntimeRecordRow } from '../../../types/common'
import type { BayNpcData } from '../../../types/common'

type RumourStepProps = {
  pilotId: string
  activeDowntime: DowntimeRecordRow
  bayNpcs: Record<string, BayNpcData>
}

export function RumourStep({ pilotId, activeDowntime, bayNpcs }: RumourStepProps) {
  const bayDamaged = isCantinaDamaged(bayNpcs)

  const receipt = useMemo(() => {
    const receipts = activeDowntime.rumour_receipts as Record<string, RumourReceipt> | null
    return receipts?.[pilotId] ?? undefined
  }, [activeDowntime.rumour_receipts, pilotId])

  const hasRumour = hasReceivedRumour(receipt)

  if (bayDamaged) {
    return (
      <div className="flex items-center gap-2 py-2">
        <AlertTriangle className="h-4 w-4 text-su-rust" />
        <Text variant="default" as="span" className="text-sm text-su-rust">
          Cantina is damaged — rumours unavailable.
        </Text>
      </div>
    )
  }

  if (hasRumour) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-su-green" />
          <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
            Rumour Received
          </Text>
        </div>
        <div className="rounded border border-su-white/10 bg-su-black/20 px-3 py-2">
          <Text variant="default" as="p" className="text-sm italic text-su-white/80">
            &ldquo;{receipt!.rumour_text}&rdquo;
          </Text>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <Loader2 className="h-4 w-4 animate-spin text-su-white/40" />
      <Text variant="default" as="span" className="text-sm text-su-white/50">
        Waiting for mediator to share a rumour...
      </Text>
    </div>
  )
}
