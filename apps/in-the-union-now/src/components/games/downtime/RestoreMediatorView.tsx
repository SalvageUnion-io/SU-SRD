import { Text } from 'suref-react'
import { Check, Loader2 } from 'lucide-react'
import type { PilotRow } from '../../../types/common'
import type { RestoreReceipt } from '../../../lib/restoreUtils'
import { isRestoreComplete } from '../../../lib/restoreUtils'

type RestoreMediatorViewProps = {
  pilots: PilotRow[]
  restoreReceipts?: Record<string, RestoreReceipt>
  compact?: boolean
}

function PilotRestoreStatus({ pilot, receipt }: { pilot: PilotRow; receipt?: RestoreReceipt }) {
  const complete = isRestoreComplete(receipt)
  const partial = receipt && (receipt.mech_restored || receipt.pilot_restored) && !complete

  return (
    <div className="flex items-center gap-2 rounded border border-su-white/10 bg-su-black/20 px-3 py-2">
      {complete ? (
        <Check className="h-4 w-4 text-su-green" />
      ) : partial ? (
        <Loader2 className="h-4 w-4 animate-spin text-su-orange" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin text-su-white/40" />
      )}
      <Text variant="pseudoheader" as="span" className="text-xs">
        {pilot.callsign}
      </Text>
      <Text variant="default" as="span" className="ml-auto text-[10px] text-su-white/40">
        {complete
          ? 'Done'
          : partial
            ? `${receipt!.mech_restored ? 'Mech' : 'Pilot'} done`
            : 'Waiting...'}
      </Text>
    </div>
  )
}

export function RestoreMediatorView({
  pilots,
  restoreReceipts,
  compact = true,
}: RestoreMediatorViewProps) {
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
        <PilotRestoreStatus key={pilot.id} pilot={pilot} receipt={restoreReceipts?.[pilot.id]} />
      ))}
    </div>
  )
}
