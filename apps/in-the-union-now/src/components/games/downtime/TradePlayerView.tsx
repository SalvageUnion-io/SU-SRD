import { useMemo } from 'react'
import { Text } from 'suref-react'
import { Check } from 'lucide-react'
import { DowntimeWaitState } from '../../shared/DowntimeWaitState'
import { resolveTradeEntities, rollKeyToCategory, isTradeComplete } from '../../../lib/tradeUtils'
import type { TradeResult } from '../../../lib/tradeUtils'
import { ReferenceEntityListingItem } from '../../shared/ReferenceEntityListingItem'
import type { DowntimeRecordRow } from '../../../types/common'

type TradePlayerViewProps = {
  activeDowntime: DowntimeRecordRow
}

export function TradePlayerView({ activeDowntime }: TradePlayerViewProps) {
  const tradeResult = activeDowntime.trade_result as TradeResult | null
  const tradeComplete = isTradeComplete(tradeResult)

  const resolvedEntities = useMemo(
    () => (tradeResult ? resolveTradeEntities(tradeResult) : []),
    [tradeResult]
  )

  // No result yet — distinguish pre-roll from post-roll states
  if (!tradeResult) {
    if (!activeDowntime.trade_roll_key) {
      return (
        <DowntimeWaitState
          message="Waiting for mediator to roll on the Trading Bay table..."
          orientationCopy="The mediator is rolling on the Trading Bay table."
        />
      )
    }
    return <DowntimeWaitState message="Mediator is selecting trade items..." />
  }

  // Roll 1 — nothing
  if (rollKeyToCategory(tradeResult.roll_key) === 'nothing') {
    return (
      <div className="flex items-center gap-2 pt-2">
        <Text variant="default" as="span" className="text-sm text-su-white/50">
          Nothing available for trade this downtime.
        </Text>
      </div>
    )
  }

  // Mediator hasn't finished selecting yet
  if (!tradeComplete) {
    return <DowntimeWaitState message="Mediator is selecting trade items..." />
  }

  // Show selected entities
  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-su-green" />
        <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
          Available for Trade
        </Text>
      </div>
      {resolvedEntities.map(({ entity }) => (
        <ReferenceEntityListingItem key={entity.id} entity={entity} showDetailButton />
      ))}
    </div>
  )
}
