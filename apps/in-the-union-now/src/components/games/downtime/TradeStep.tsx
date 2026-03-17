import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Text } from 'suref-react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { useSaveTradeResult } from '../../../hooks/useCrawlers'
import { rollKeyToCategory, resolveTradeEntities, isTradeComplete } from '../../../lib/tradeUtils'
import type { TradeResult, TradeCategory } from '../../../lib/tradeUtils'
import { getErrorMessage } from '../../../lib/errors'
import { ReferenceEntityListingItem } from '../../shared/ReferenceEntityListingItem'
import { TradeSelectionModal } from './TradeSelectionModal'
import type { DowntimeRecordRow } from '../../../types/common'

type TradeStepProps = {
  crawlerId: string
  crawlerTL: number
  activeDowntime: DowntimeRecordRow
  rollKey: string | null
  rollValue: number | null
}

export function TradeStep({
  crawlerId,
  crawlerTL,
  activeDowntime,
  rollKey,
  rollValue,
}: TradeStepProps) {
  const tradeResult = activeDowntime.trade_result as TradeResult | null
  const saveTradeResult = useSaveTradeResult()

  const category: TradeCategory | null = rollKey ? rollKeyToCategory(rollKey) : null

  // Auto-open modal when roll happens and no result saved yet
  const [modalOpen, setModalOpen] = useState(false)
  const autoOpenedRef = useRef(false)

  // Auto-open once when rollKey arrives and no saved result.
  // setModalOpen here is intentional: this effect synchronises an external
  // event (a new rollKey from the server) into local modal UI state exactly once.
  useEffect(() => {
    if (rollKey && !tradeResult && !autoOpenedRef.current && category !== 'nothing') {
      autoOpenedRef.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModalOpen(true)
    }
  }, [rollKey, tradeResult, category])

  const handleSelect = useCallback(
    (selections: {
      selected_chassis?: string
      selected_system?: string
      selected_module?: string
    }) => {
      if (!rollKey || rollValue === null) return
      const result: TradeResult = {
        roll_key: rollKey,
        roll_value: rollValue,
        ...selections,
      }
      saveTradeResult.mutate(
        { recordId: activeDowntime.id, result, crawlerId },
        {
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [rollKey, rollValue, activeDowntime.id, crawlerId, saveTradeResult]
  )

  // Auto-save "nothing" result for roll 1
  useEffect(() => {
    if (rollKey && !tradeResult && category === 'nothing') {
      const result: TradeResult = { roll_key: rollKey, roll_value: rollValue ?? 1 }
      saveTradeResult.mutate(
        { recordId: activeDowntime.id, result, crawlerId },
        {
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    }
  }, [rollKey, tradeResult, category]) // eslint-disable-line react-hooks/exhaustive-deps

  const tradeComplete = isTradeComplete(tradeResult)
  const resolvedEntities = useMemo(
    () => (tradeResult ? resolveTradeEntities(tradeResult) : []),
    [tradeResult]
  )

  // Before roll: show nothing
  if (!rollKey) return null

  // Roll 1 (nothing): show message
  if (tradeResult && rollKeyToCategory(tradeResult.roll_key) === 'nothing') {
    return (
      <div className="flex items-center gap-2 pt-2">
        <Text variant="default" as="span" className="text-sm text-su-white/50">
          Nothing available for trade this downtime.
        </Text>
      </div>
    )
  }

  // Selections made — show entity listings
  if (tradeComplete && resolvedEntities.length > 0) {
    return (
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-su-green" />
          <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
            Trade Items Selected
          </Text>
        </div>
        {resolvedEntities.map(({ entity }) => (
          <ReferenceEntityListingItem key={entity.id} entity={entity} showDetailButton />
        ))}
      </div>
    )
  }

  // Waiting for selection (modal open or pending)
  return (
    <>
      <div className="flex items-center gap-2 pt-2">
        <Text variant="default" as="span" className="text-sm text-su-white/50">
          {saveTradeResult.isPending ? 'Saving...' : 'Select items from the roll result...'}
        </Text>
        {!tradeResult && !modalOpen && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="cursor-pointer text-xs text-su-orange underline hover:opacity-80"
          >
            Open picker
          </button>
        )}
      </div>
      {category && category !== 'nothing' && (
        <TradeSelectionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          category={category}
          crawlerTL={crawlerTL}
          onSelect={handleSelect}
        />
      )}
    </>
  )
}
