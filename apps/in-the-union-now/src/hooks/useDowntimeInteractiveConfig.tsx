import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { SURefObjectGuideStep } from 'salvageunion-reference'
import type { GuideStepsInteractiveConfig } from 'suref-react'
import { Check } from 'lucide-react'

// Step IDs from the Crawler Downtime guide
const TALLY_SALVAGE_ID = 'b8ef9784-3967-4f7d-8e8c-b8d487788a39'
const UPKEEP_ID = 'a1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e'
const RESTORE_ID = 'b2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f'
const TRADE_ID = 'c3e4f5a6-b7c8-4d9e-0f1a-2b3c4d5e6f7a'
const CRAFT_ID = 'd4f5a6b7-c8d9-4e0f-1a2b-3c4d5e6f7a8b'
const CUSTOMISE_ID = 'e5a6b7c8-d9e0-4f1a-2b3c-4d5e6f7a8b9c'
const TRAIN_ID = 'f6b7c8d9-e0f1-4a2b-3c4d-5e6f7a8b9c0d'
const EQUIPMENT_ID = 'a7c8d9e0-f1a2-4b3c-4d5e-6f7a8b9c0d1e'
const RUMOURS_ID = 'b8d9e0f1-a2b3-4c4d-5e6f-7a8b9c0d1e2f'
const PREPARE_ID = 'c9e0f1a2-b3c4-4d5e-6f7a-8b9c0d1e2f3a'

const OPTIONAL_STEP_IDS = new Set([CRAFT_ID, CUSTOMISE_ID, TRAIN_ID, EQUIPMENT_ID])
const PRE_SESSION_STEP_IDS = new Set([RUMOURS_ID, PREPARE_ID])

type UseDowntimeInteractiveConfigParams = {
  // Mandatory phase (steps 1-4)
  tallySalvageComplete: boolean
  upkeepPaid: boolean
  restoreComplete: boolean
  tradeComplete: boolean

  // Phase flags
  preSessionStarted: boolean

  // Optional phase completion (steps 5-8)
  craftComplete: boolean
  customiseComplete: boolean
  trainComplete: boolean
  equipmentComplete: boolean

  // Pre-session completion (step 9)
  rumoursComplete: boolean

  // Render callbacks for steps 1-4
  renderTallySalvageContent: () => ReactNode
  renderUpkeepContent: () => ReactNode
  renderRestoreContent: () => ReactNode
  renderTradeContent: () => ReactNode
  renderTradeSideContent?: () => ReactNode

  // Render callbacks for steps 5-10
  renderCraftContent?: () => ReactNode
  renderCustomiseContent?: () => ReactNode
  renderTrainContent?: () => ReactNode
  renderEquipmentContent?: () => ReactNode
  renderRumoursContent?: () => ReactNode
  renderPrepareContent?: () => ReactNode

  renderFooter?: () => ReactNode
}

export function useDowntimeInteractiveConfig({
  tallySalvageComplete,
  upkeepPaid,
  restoreComplete,
  tradeComplete,
  preSessionStarted,
  craftComplete,
  customiseComplete,
  trainComplete,
  equipmentComplete,
  rumoursComplete,
  renderTallySalvageContent,
  renderUpkeepContent,
  renderRestoreContent,
  renderTradeContent,
  renderTradeSideContent,
  renderCraftContent,
  renderCustomiseContent,
  renderTrainContent,
  renderEquipmentContent,
  renderRumoursContent,
  renderPrepareContent,
  renderFooter,
}: UseDowntimeInteractiveConfigParams): GuideStepsInteractiveConfig {
  const getStepState = useCallback(
    (step: SURefObjectGuideStep) => {
      // Steps 1-4: sequential (unchanged)
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

      // Steps 5-8: all current simultaneously after trade, until pre-session starts
      if (OPTIONAL_STEP_IDS.has(step.id)) {
        const isCurrent = tradeComplete && !preSessionStarted
        let isComplete = false
        if (step.id === CRAFT_ID) isComplete = craftComplete
        else if (step.id === CUSTOMISE_ID) isComplete = customiseComplete
        else if (step.id === TRAIN_ID) isComplete = trainComplete
        else if (step.id === EQUIPMENT_ID) isComplete = equipmentComplete
        return { isCurrent, isComplete, isUnlocked: true }
      }

      // Steps 9-10: current during pre-session
      if (PRE_SESSION_STEP_IDS.has(step.id)) {
        const isCurrent = preSessionStarted
        let isComplete = false
        if (step.id === RUMOURS_ID) isComplete = rumoursComplete
        else if (step.id === PREPARE_ID) isComplete = preSessionStarted
        return { isCurrent, isComplete, isUnlocked: true }
      }

      return { isCurrent: false, isComplete: false, isUnlocked: true }
    },
    [
      tallySalvageComplete,
      upkeepPaid,
      restoreComplete,
      tradeComplete,
      preSessionStarted,
      craftComplete,
      customiseComplete,
      trainComplete,
      equipmentComplete,
      rumoursComplete,
    ]
  )

  const renderStepStartContent = useCallback(
    (step: SURefObjectGuideStep): ReactNode | undefined => {
      if (step.id === TALLY_SALVAGE_ID) return renderTallySalvageContent()
      if (step.id === RESTORE_ID) return renderRestoreContent()
      if (step.id === CRAFT_ID) return renderCraftContent?.()
      if (step.id === CUSTOMISE_ID) return renderCustomiseContent?.()
      if (step.id === TRAIN_ID) return renderTrainContent?.()
      if (step.id === EQUIPMENT_ID) return renderEquipmentContent?.()
      if (step.id === RUMOURS_ID) return renderRumoursContent?.()
      if (step.id === PREPARE_ID) return renderPrepareContent?.()
      return undefined
    },
    [
      renderTallySalvageContent,
      renderRestoreContent,
      renderCraftContent,
      renderCustomiseContent,
      renderTrainContent,
      renderEquipmentContent,
      renderRumoursContent,
      renderPrepareContent,
    ]
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
        (step.id === TRADE_ID && tradeComplete) ||
        (step.id === CRAFT_ID && craftComplete) ||
        (step.id === CUSTOMISE_ID && customiseComplete) ||
        (step.id === TRAIN_ID && trainComplete) ||
        (step.id === EQUIPMENT_ID && equipmentComplete) ||
        (step.id === RUMOURS_ID && rumoursComplete)
      if (!isComplete) return null
      return <Check className="h-4 w-4 text-su-green" />
    },
    [
      tallySalvageComplete,
      upkeepPaid,
      restoreComplete,
      tradeComplete,
      craftComplete,
      customiseComplete,
      trainComplete,
      equipmentComplete,
      rumoursComplete,
    ]
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
