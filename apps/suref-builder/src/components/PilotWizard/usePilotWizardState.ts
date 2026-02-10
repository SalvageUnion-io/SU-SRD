import { useCallback } from 'react'
import type { WizardState } from './utils'
import { validateWizardStep } from './utils'
import { useBaseWizardState } from '../../hooks/useBaseWizardState'

export interface UsePilotWizardStateReturn {
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
}

const initialState: WizardState = {
  selectedClassId: null,
  selectedAbilityId: null,
  selectedEquipmentIds: [],
  callsign: '',
  background: '',
  motto: '',
  keepsake: '',
  appearance: '',
}

export function usePilotWizardState(): UsePilotWizardStateReturn {
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
  }
}
