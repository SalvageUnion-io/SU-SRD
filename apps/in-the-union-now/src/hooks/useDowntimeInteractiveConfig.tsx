import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { SURefObjectGuideStep } from 'salvageunion-reference'
import type { GuideStepsInteractiveConfig } from 'suref-react'
import { Check } from 'lucide-react'

const TALLY_SALVAGE_ID = 'b8ef9784-3967-4f7d-8e8c-b8d487788a39'
const UPKEEP_ID = 'a1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e'
const RESTORE_ID = 'b2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f'
const TRADE_ID = 'c3e4f5a6-b7c8-4d9e-0f1a-2b3c4d5e6f7a'

type UseDowntimeInteractiveConfigParams = {
  tallySalvageComplete: boolean
  upkeepPaid: boolean
  restoreComplete: boolean
  tradeComplete: boolean
  renderTallySalvageContent: () => ReactNode
  renderUpkeepContent: () => ReactNode
  renderRestoreContent: () => ReactNode
  renderTradeContent: () => ReactNode
  renderTradeSideContent?: () => ReactNode
  renderFooter?: () => ReactNode
}

export function useDowntimeInteractiveConfig({
  tallySalvageComplete,
  upkeepPaid,
  restoreComplete,
  tradeComplete,
  renderTallySalvageContent,
  renderUpkeepContent,
  renderRestoreContent,
  renderTradeContent,
  renderTradeSideContent,
  renderFooter,
}: UseDowntimeInteractiveConfigParams): GuideStepsInteractiveConfig {
  const getStepState = useCallback(
    (step: SURefObjectGuideStep) => {
      if (step.id === TALLY_SALVAGE_ID) {
        return {
          isCurrent: !tallySalvageComplete,
          isComplete: tallySalvageComplete,
          isUnlocked: true,
        }
      }
      if (step.id === UPKEEP_ID) {
        return {
          isCurrent: tallySalvageComplete && !upkeepPaid,
          isComplete: upkeepPaid,
          isUnlocked: true,
        }
      }
      if (step.id === RESTORE_ID) {
        return {
          isCurrent: upkeepPaid && !restoreComplete,
          isComplete: restoreComplete,
          isUnlocked: true,
        }
      }
      if (step.id === TRADE_ID) {
        return {
          isCurrent: restoreComplete && !tradeComplete,
          isComplete: tradeComplete,
          isUnlocked: true,
        }
      }
      // Steps 5-10: always unlocked, static info
      return { isCurrent: false, isComplete: false, isUnlocked: true }
    },
    [tallySalvageComplete, upkeepPaid, restoreComplete, tradeComplete]
  )

  const renderStepStartContent = useCallback(
    (step: SURefObjectGuideStep): ReactNode | undefined => {
      if (step.id === TALLY_SALVAGE_ID) return renderTallySalvageContent()
      if (step.id === RESTORE_ID) return renderRestoreContent()
      return undefined
    },
    [renderTallySalvageContent, renderRestoreContent]
  )

  const renderStepContent = useCallback(
    (step: SURefObjectGuideStep): ReactNode | undefined => {
      if (step.id === TRADE_ID) return renderTradeContent()
      return undefined
    },
    [renderTradeContent]
  )

  const renderStepSideContent = useCallback(
    (step: SURefObjectGuideStep): ReactNode | undefined => {
      if (step.id === UPKEEP_ID) return renderUpkeepContent()
      if (step.id === TRADE_ID) return renderTradeSideContent?.()
      return undefined
    },
    [renderUpkeepContent, renderTradeSideContent]
  )

  const renderStepHeaderExtra = useCallback(
    (step: SURefObjectGuideStep): ReactNode => {
      const isComplete =
        (step.id === TALLY_SALVAGE_ID && tallySalvageComplete) ||
        (step.id === UPKEEP_ID && upkeepPaid) ||
        (step.id === RESTORE_ID && restoreComplete) ||
        (step.id === TRADE_ID && tradeComplete)
      if (!isComplete) return null
      return <Check className="h-4 w-4 text-su-green" />
    },
    [tallySalvageComplete, upkeepPaid, restoreComplete, tradeComplete]
  )

  return useMemo(
    () => ({
      getStepState,
      renderStepStartContent,
      renderStepContent,
      renderStepSideContent,
      renderStepHeaderExtra,
      renderFooter,
    }),
    [
      getStepState,
      renderStepStartContent,
      renderStepContent,
      renderStepSideContent,
      renderStepHeaderExtra,
      renderFooter,
    ]
  )
}
