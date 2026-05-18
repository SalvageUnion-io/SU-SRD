import { useState, useCallback, useMemo } from 'react'
import { Text } from 'suref-react'
import { Check, Loader2, Save, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '../../ui/input'
import { useSaveRumourReceipt } from '../../../hooks/useCrawlers'
import { hasReceivedRumour } from '../../../lib/rumourUtils'
import type { RumourReceipt } from '../../../lib/rumourUtils'
import { getErrorMessage } from '../../../lib/errors'
import type { PilotRow, DowntimeRecordRow } from '../../../types/common'

type RumourMediatorViewProps = {
  pilots: PilotRow[]
  activeDowntime: DowntimeRecordRow
  crawlerId: string
}

export function RumourMediatorView({ pilots, activeDowntime, crawlerId }: RumourMediatorViewProps) {
  if (pilots.length === 0) {
    return (
      <Text variant="default" as="p" className="py-4 text-center text-su-white/50">
        No pilots assigned to this crawler.
      </Text>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {pilots.map((pilot) => (
        <PilotRumourInput
          key={pilot.id}
          pilot={pilot}
          activeDowntime={activeDowntime}
          crawlerId={crawlerId}
        />
      ))}
    </div>
  )
}

function PilotRumourInput({
  pilot,
  activeDowntime,
  crawlerId,
}: {
  pilot: PilotRow
  activeDowntime: DowntimeRecordRow
  crawlerId: string
}) {
  const saveReceipt = useSaveRumourReceipt()

  const existingReceipt = useMemo(() => {
    const receipts = activeDowntime.rumour_receipts as Record<string, RumourReceipt> | null
    return receipts?.[pilot.id] ?? undefined
  }, [activeDowntime.rumour_receipts, pilot.id])

  const hasSaved = hasReceivedRumour(existingReceipt)
  const [text, setText] = useState(existingReceipt?.rumour_text ?? '')
  const [editing, setEditing] = useState(!hasSaved)

  const handleSave = useCallback(() => {
    if (!text.trim()) return
    saveReceipt.mutate(
      {
        recordId: activeDowntime.id,
        pilotId: pilot.id,
        receipt: { rumour_text: text.trim() },
        crawlerId,
      },
      {
        onSuccess: () => {
          setEditing(false)
          toast.success(`Rumour saved for ${pilot.callsign}`)
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [text, activeDowntime.id, pilot.id, pilot.callsign, crawlerId, saveReceipt])

  return (
    <div className="flex flex-col gap-1.5 rounded border border-su-white/10 bg-su-black/20 px-3 py-2">
      <div className="flex items-center gap-2">
        {hasSaved ? (
          <Check className="h-4 w-4 text-su-green" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-su-white/40" />
        )}
        <Text variant="pseudoheader" as="span" className="text-xs">
          {pilot.callsign}
        </Text>
      </div>

      {editing ? (
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter a rumour..."
            className="flex-1 border-su-white/20 bg-su-black/30 text-sm text-su-white placeholder:text-su-white/30"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!text.trim() || saveReceipt.isPending}
            className="flex cursor-pointer items-center gap-1 bg-su-green px-3 py-1 text-su-white transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
          >
            {saveReceipt.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <Text variant="default" as="p" className="flex-1 text-xs italic text-su-white/60">
            &ldquo;{existingReceipt?.rumour_text}&rdquo;
          </Text>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="cursor-pointer text-su-white/40 transition-colors hover:text-su-white/80"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
