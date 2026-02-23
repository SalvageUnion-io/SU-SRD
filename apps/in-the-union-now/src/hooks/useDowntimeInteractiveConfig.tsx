import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { SURefObjectGuideStep } from 'salvageunion-reference'
import type { GuideStepsInteractiveConfig } from 'suref-react'
import { Check } from 'lucide-react'

const TALLY_SALVAGE_ID = 'b8ef9784-3967-4f7d-8e8c-b8d487788a39'
const UPKEEP_ID = 'a1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e'

type UseDowntimeInteractiveConfigParams = {
  tallySalvageComplete: boolean
  upkeepPaid: boolean
  renderTallySalvageContent: () => ReactNode
  renderUpkeepContent: () => ReactNode
  renderFooter?: () => ReactNode
}

export function useDowntimeInteractiveConfig({
  tallySalvageComplete,
  upkeepPaid,
  renderTallySalvageContent,
  renderUpkeepContent,
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
      // Steps 3-10: always unlocked, static info
      return { isCurrent: false, isComplete: false, isUnlocked: true }
    },
    [tallySalvageComplete, upkeepPaid]
  )

  const renderStepContent = useCallback(
    (step: SURefObjectGuideStep): ReactNode | undefined => {
      if (step.id === TALLY_SALVAGE_ID) return renderTallySalvageContent()
      if (step.id === UPKEEP_ID) return renderUpkeepContent()
      return undefined
    },
    [renderTallySalvageContent, renderUpkeepContent]
  )

  const renderStepHeaderExtra = useCallback(
    (step: SURefObjectGuideStep): ReactNode => {
      const isComplete =
        (step.id === TALLY_SALVAGE_ID && tallySalvageComplete) ||
        (step.id === UPKEEP_ID && upkeepPaid)
      if (!isComplete) return null
      return <Check className="h-4 w-4 text-su-green" />
    },
    [tallySalvageComplete, upkeepPaid]
  )

  return useMemo(
    () => ({
      getStepState,
      renderStepContent,
      renderStepHeaderExtra,
      renderFooter,
    }),
    [getStepState, renderStepContent, renderStepHeaderExtra, renderFooter]
  )
}
