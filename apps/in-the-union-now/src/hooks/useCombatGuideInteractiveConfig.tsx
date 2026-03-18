import type { ReactNode } from 'react'
import type { SURefGuide, SURefObjectGuideStep } from 'salvageunion-reference'
import type { GuideStepsInteractiveConfig, GuideStepRollState } from 'suref-react'
import { RollInput } from '../components/shared/RollInput'

// ---------------------------------------------------------------------------
// Guide IDs
// ---------------------------------------------------------------------------

export const COMBAT_GUIDE_IDS: readonly string[] = [
  'e4b5c6d7-f8a9-4b0c-1d2e-3f4a5b6c7d8e', // Pushing a Mech
  'c6d7e8f9-a0b1-4c2d-3e4f-5a6b7c8d9e0f', // Mech Damage
  'd8e9f0a1-b2c3-4d4e-5f6a-7b8c9d0e1f2a', // Pilot Damage
  'b6c7d8e9-f0a1-4b2c-3d4e-5f6a7b8c9d0e', // Salvaging
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
                Execute Push — Spend 2 Heat
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
