import { useCallback, useMemo } from 'react'
import type { Dispatch } from 'react'
import type { SURefObjectGuideStep } from 'salvageunion-reference'
import type { GuideStepsInteractiveConfig, GuideStepRollState } from 'suref-react'
import { Text } from 'suref-react'
import {
  resolveStepEntities,
  resolveConstraintMax,
  rollOnTable,
  validateStep,
} from '../lib/pilotUtils'
import type { WizardState, WizardAction } from '../lib/pilotUtils'
import { Input } from '../components/ui/input'

export type WizardBudgetConfig = {
  /** Max budget (e.g. 20) */
  budget: number
  /** Current total cost of all selections */
  totalCost: number
  /** Budget remaining (budget - totalCost) */
  remainingBudget: number
  /** Schema names that participate in the budget (e.g. chassis, systems, modules) */
  budgetSchemas: Set<string>
}

/** Builds a GuideStepsInteractiveConfig from wizard state + dispatch.
 *  Pass the returned config to `<EntityDisplay interactive={config} />`. */
export function useGuideInteractiveConfig(
  steps: SURefObjectGuideStep[],
  state: WizardState,
  dispatch: Dispatch<WizardAction>,
  budgetConfig?: WizardBudgetConfig
): GuideStepsInteractiveConfig {
  const getStepState = useCallback(
    (step: SURefObjectGuideStep, index: number) => {
      const validation = validateStep(step, state, steps)
      const isCurrent = index === state.currentStepIndex
      const hasSelections = !!state.selections[step.id]
      const allPreviousComplete =
        index === 0 || steps.slice(0, index).every((s) => validateStep(s, state, steps).canProceed)
      const isUnlocked = allPreviousComplete || hasSelections

      return {
        isCurrent,
        isComplete: validation.isComplete,
        isUnlocked,
        isActivated: hasSelections,
      }
    },
    [state, steps]
  )

  const getStepSelectionState = useCallback(
    (step: SURefObjectGuideStep) => {
      const selection = state.selections[step.id]
      if (!selection) return null

      const dynamicMax = resolveConstraintMax(step, state, steps)
      return {
        selectedIds: new Set(selection.selectedIds),
        countBadge:
          dynamicMax < Infinity ? { current: selection.selectedIds.length, max: dynamicMax } : null,
      }
    },
    [state, steps]
  )

  const getStepRollState = useCallback(
    (step: SURefObjectGuideStep) => {
      const selection = state.selections[step.id]
      return { textValue: selection?.textValue ?? '' }
    },
    [state]
  )

  const onEntityToggle = useCallback(
    (stepId: string, entityId: string, schemaName: string) => {
      dispatch({ type: 'SELECT_ENTITY', stepId, entityId, schemaName })
    },
    [dispatch]
  )

  const onRoll = useCallback(
    (stepId: string) => {
      const step = steps.find((s) => s.id === stepId)
      if (!step?.rollTable) return
      const { text, roll } = rollOnTable(step.rollTable)
      if (text) {
        dispatch({ type: 'SET_ROLL', stepId, rollValue: roll, textValue: text })
      }
    },
    [dispatch, steps]
  )

  const onTextChange = useCallback(
    (stepId: string, value: string) => {
      dispatch({ type: 'SET_TEXT', stepId, value })
    },
    [dispatch]
  )

  const onStepClick = useCallback(
    (_step: SURefObjectGuideStep, index: number) => {
      dispatch({ type: 'GO_TO_STEP', stepIndex: index })
    },
    [dispatch]
  )

  const resolveEntities = useCallback(
    (step: SURefObjectGuideStep) => {
      const entities = resolveStepEntities(step, state)
      if (!budgetConfig) return entities

      const schemaName = step.schema?.[0]
      if (!schemaName || !budgetConfig.budgetSchemas.has(schemaName)) return entities

      const selectedIds = new Set(state.selections[step.id]?.selectedIds ?? [])

      return entities.map((e) => {
        if (e.disabled) return e
        const entityId = (e.data as { id: string }).id
        if (selectedIds.has(entityId)) return e
        const sv = (e.data as { salvageValue?: number }).salvageValue ?? 0
        if (sv > budgetConfig.remainingBudget) {
          return { ...e, disabled: true }
        }
        return e
      })
    },
    [state, budgetConfig]
  )

  const renderStepHeaderExtra = useCallback(
    (step: SURefObjectGuideStep) => {
      if (!budgetConfig) return null
      const schemaName = step.schema?.[0]
      if (!schemaName || !budgetConfig.budgetSchemas.has(schemaName)) return null

      return (
        <span className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black">
          <Text variant="pseudoheader" as="span" className="text-base font-semibold uppercase">
            SV
          </Text>
          <Text
            variant="pseudoheaderInverse"
            as="span"
            className="text-base font-semibold uppercase"
          >
            {budgetConfig.totalCost}/{budgetConfig.budget}
          </Text>
          <Text variant="pseudoheader" as="span" className="text-base font-semibold uppercase">
            TL1
          </Text>
        </span>
      )
    },
    [budgetConfig]
  )

  const renderRollInteraction = useCallback(
    (
      step: SURefObjectGuideStep,
      rollState: GuideStepRollState,
      _handleRoll: () => void,
      handleTextChange: (value: string) => void
    ) => (
      <Input
        value={rollState.textValue}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder={
          step.rollTable
            ? `Roll or type your ${step.name.toLowerCase()}...`
            : `Enter your ${step.name.toLowerCase()}...`
        }
        className="h-9 text-sm"
      />
    ),
    []
  )

  return useMemo(
    () => ({
      getStepState,
      getStepSelectionState,
      getStepRollState,
      onEntityToggle,
      onRoll,
      onTextChange,
      onStepClick,
      resolveEntities,
      renderRollInteraction,
      ...(budgetConfig ? { renderStepHeaderExtra } : {}),
    }),
    [
      getStepState,
      getStepSelectionState,
      getStepRollState,
      onEntityToggle,
      onRoll,
      onTextChange,
      onStepClick,
      resolveEntities,
      renderRollInteraction,
      budgetConfig,
      renderStepHeaderExtra,
    ]
  )
}
