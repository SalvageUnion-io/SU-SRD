import { useCallback } from 'react'
import type { WizardState } from './utils'
import { validateWizardStep } from './utils'
import { useBaseWizardState } from '../../hooks/useBaseWizardState'

export interface UseMechWizardStateReturn {
  state: WizardState
  currentStep: number
  completedSteps: Set<number>
  isStepComplete: (step: number) => boolean
  getNextIncompleteStep: () => number | null
  goToStep: (step: number) => void
  goToNextStep: () => void
  goToPreviousStep: () => void
  updateField: <K extends keyof WizardState>(field: K, value: WizardState[K]) => void
  reset: () => void
  // Individual setters for convenience
  setSelectedChassisId: (id: string | null) => void
  setSelectedSystemIds: (ids: string[]) => void
  setSelectedModuleIds: (ids: string[]) => void
  setSelectedPatternName: (name: string | null) => void
  setAppearance: (value: string) => void
  setQuirk: (value: string) => void
  setPatternName: (value: string) => void
}

const initialState: WizardState = {
  selectedChassisId: null,
  selectedSystemIds: [],
  selectedModuleIds: [],
  selectedPatternName: null,
  appearance: '',
  quirk: '',
  patternName: '',
}

export function useMechWizardState(): UseMechWizardStateReturn {
  const baseWizard = useBaseWizardState({
    initialState,
    validateStep: validateWizardStep,
    totalSteps: 3,
  })

  const { state, setState } = baseWizard

  const updateField = useCallback(
    <K extends keyof WizardState>(field: K, value: WizardState[K]) => {
      setState((prev) => ({ ...prev, [field]: value }))
    },
    [setState]
  )

  // Individual setters for convenience
  const setSelectedChassisId = useCallback(
    (id: string | null) => updateField('selectedChassisId', id),
    [updateField]
  )
  const setSelectedSystemIds = useCallback(
    (ids: string[]) => updateField('selectedSystemIds', ids),
    [updateField]
  )
  const setSelectedModuleIds = useCallback(
    (ids: string[]) => updateField('selectedModuleIds', ids),
    [updateField]
  )
  const setSelectedPatternName = useCallback(
    (name: string | null) => updateField('selectedPatternName', name),
    [updateField]
  )
  const setAppearance = useCallback(
    (value: string) => updateField('appearance', value),
    [updateField]
  )
  const setQuirk = useCallback((value: string) => updateField('quirk', value), [updateField])
  const setPatternName = useCallback(
    (value: string) => updateField('patternName', value),
    [updateField]
  )

  return {
    state,
    currentStep: baseWizard.currentStep,
    completedSteps: baseWizard.completedSteps,
    isStepComplete: baseWizard.isStepComplete,
    getNextIncompleteStep: baseWizard.getNextIncompleteStep,
    goToStep: baseWizard.goToStep,
    goToNextStep: baseWizard.goToNextStep,
    goToPreviousStep: baseWizard.goToPreviousStep,
    updateField,
    reset: baseWizard.reset,
    setSelectedChassisId,
    setSelectedSystemIds,
    setSelectedModuleIds,
    setSelectedPatternName,
    setAppearance,
    setQuirk,
    setPatternName,
  }
}
