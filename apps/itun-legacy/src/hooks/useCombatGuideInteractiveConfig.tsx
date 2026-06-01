import type { ReactNode } from 'react'
import type { SURefGuide, SURefObjectGuideStep } from 'salvageunion-reference'
import type { GuideStepsInteractiveConfig, GuideStepRollState } from 'suref-react'
import { RollInput } from '../components/shared/RollInput'

// ---------------------------------------------------------------------------
// Guide IDs
// ---------------------------------------------------------------------------

export const COMBAT_GUIDE_IDS: readonly string[] = [
  'e20e13d5-7fdc-40e7-a301-68f5e2f03c0e', // Pushing a Mech
  '4da07865-196c-4897-a1cc-91bb89fd190a', // Mech Damage
  '4bded796-5062-41bb-b97d-1f324bfb5255', // Pilot Damage
  '8a018b6f-a0ad-4765-ac66-25a98ac8fef9', // Salvaging
]

// The step ID of "Push Procedure" within the Pushing a Mech guide
const PUSH_PROCEDURE_STEP_ID = 'a8b9c0d1-e2f3-4a4b-5c6d-7e8f9a0b1c2d'

// ---------------------------------------------------------------------------
// Pure config builder (testable without hooks)
// ---------------------------------------------------------------------------

type BuildCombatGuideConfigParams = {
  guide?: SURefGuide
  rollValues: Record<string, string>
  onRollValueChange: (stepId: string, value: string) => void
  onPush?: () => void
}

/**
 * Pure function that builds a GuideStepsInteractiveConfig for a combat guide.
 *
 * Combat guides have no completion tracking — all steps are always unlocked
 * and never marked complete. Roll-table steps render RollInput. The Push
 * Procedure step renders an "Execute Push" button if onPush is provided.
 */
export function buildCombatGuideConfig({
  rollValues,
  onRollValueChange,
  onPush,
}: BuildCombatGuideConfigParams): GuideStepsInteractiveConfig {
  const getStepState = (step: SURefObjectGuideStep) => ({
    isCurrent: false,
    isComplete: false,
    isUnlocked: true,
    isActivated: step.stepType === 'roll-table' && !!rollValues[step.id],
  })

  const getStepRollState = (step: SURefObjectGuideStep): GuideStepRollState | null => {
    if (step.stepType !== 'roll-table') return null
    return { textValue: rollValues[step.id] ?? '' }
  }

  const renderRollInteraction = (
    step: SURefObjectGuideStep,
    rollState: GuideStepRollState,
    handleRoll: () => void,
    handleTextChange: (value: string) => void
  ): ReactNode => (
    <RollInput
      value={rollState.textValue}
      onChange={handleTextChange}
      onRoll={handleRoll}
      placeholder={
        step.rollTable ? `Roll or type result for ${step.name.toLowerCase()}...` : `Enter result...`
      }
      rollTableName={step.rollTable}
    />
  )

  // RollInput fires onRoll to trigger an internal random result and then calls
  // onChange with the result. For combat guides the value flows via onTextChange
  // (wired through renderRollInteraction) — no separate roll-event dispatch needed.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onRoll = (_: string) => {}

  const onTextChange = (stepId: string, value: string) => {
    onRollValueChange(stepId, value)
  }

  const renderStepContent =
    onPush !== undefined
      ? (step: SURefObjectGuideStep): ReactNode | undefined => {
          if (step.id !== PUSH_PROCEDURE_STEP_ID) return undefined
          return (
            <div className="mt-3 flex justify-start">
              <button
                type="button"
                onClick={onPush}
                className="inline-flex cursor-pointer items-center gap-2 border border-su-black bg-su-rust px-4 py-2 font-mono text-sm font-bold uppercase tracking-wide text-su-white transition-colors hover:bg-su-rust/80 active:scale-95"
              >
                Push — Spend 2 Heat
              </button>
            </div>
          )
        }
      : undefined

  return {
    getStepState,
    getStepRollState,
    onRoll,
    onTextChange,
    renderRollInteraction,
    ...(renderStepContent !== undefined ? { renderStepContent } : {}),
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

import { useState, useCallback, useMemo } from 'react'

type UseCombatGuideInteractiveConfigParams = {
  guide: SURefGuide
  onPush?: () => void
}

/**
 * React hook wrapping buildCombatGuideConfig with local roll-value state.
 * Returns the GuideStepsInteractiveConfig to pass to ReferenceEntityDisplay.
 */
export function useCombatGuideInteractiveConfig({
  guide,
  onPush,
}: UseCombatGuideInteractiveConfigParams): GuideStepsInteractiveConfig {
  const [rollValues, setRollValues] = useState<Record<string, string>>({})

  const onRollValueChange = useCallback((stepId: string, value: string) => {
    setRollValues((prev) => ({ ...prev, [stepId]: value }))
  }, [])

  return useMemo(
    () =>
      buildCombatGuideConfig({
        guide,
        rollValues,
        onRollValueChange,
        onPush,
      }),
    [guide, rollValues, onRollValueChange, onPush]
  )
}
