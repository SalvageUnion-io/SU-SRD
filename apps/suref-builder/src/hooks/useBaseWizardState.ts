import { useState, useCallback, useMemo } from 'react'

export interface UseBaseWizardStateReturn<TState> {
  state: TState
  currentStep: number
  completedSteps: Set<number>
  isStepComplete: (step: number) => boolean
  getNextIncompleteStep: () => number | null
  goToStep: (step: number) => void
  goToNextStep: () => void
  goToPreviousStep: () => void
  setState: React.Dispatch<React.SetStateAction<TState>>
  reset: () => void
}

export interface UseBaseWizardStateOptions<TState> {
  initialState: TState
  validateStep: (step: number, state: TState) => boolean
  totalSteps: number
}

/**
 * Generic wizard state hook that manages step navigation and completion tracking.
 * Each wizard can use this internally while maintaining their own specific state shape.
 */
export function useBaseWizardState<TState>({
  initialState,
  validateStep,
  totalSteps,
}: UseBaseWizardStateOptions<TState>): UseBaseWizardStateReturn<TState> {
  const [state, setState] = useState<TState>(initialState)
  const [currentStep, setCurrentStep] = useState(1)

  const completedSteps = useMemo(() => {
    const completed = new Set<number>()
    for (let step = 1; step <= totalSteps; step++) {
      if (validateStep(step, state)) {
        completed.add(step)
      }
    }
    return completed
  }, [state, validateStep, totalSteps])

  const isStepComplete = useCallback(
    (step: number): boolean => {
      return validateStep(step, state)
    },
    [state, validateStep]
  )

  const getNextIncompleteStep = useCallback((): number | null => {
    for (let step = 1; step <= totalSteps; step++) {
      if (!validateStep(step, state)) {
        return step
      }
    }
    return null
  }, [state, validateStep, totalSteps])

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 1 && step <= totalSteps) {
        setCurrentStep(step)
      }
    },
    [totalSteps]
  )

  const goToNextStep = useCallback(() => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }, [currentStep, totalSteps])

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

  const reset = useCallback(() => {
    setState(initialState)
    setCurrentStep(1)
  }, [initialState])

  return {
    state,
    currentStep,
    completedSteps,
    isStepComplete,
    getNextIncompleteStep,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    setState,
    reset,
  }
}
