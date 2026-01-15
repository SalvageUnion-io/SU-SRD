import { useCallback } from 'react'

/**
 * Hook to provide common wizard handler functions
 * Extracts the repeated handleStepComplete and handleCreate patterns
 */

interface WizardStateWithNavigation {
  goToNextStep: () => void
}

/**
 * Hook to create a step completion handler
 * @param wizardState - Wizard state object with goToNextStep method
 * @returns Handler function that advances to the next step
 */
export function useWizardStepHandler(wizardState: WizardStateWithNavigation): () => void {
  return useCallback(() => {
    wizardState.goToNextStep()
  }, [wizardState])
}

/**
 * Hook to create a wizard creation handler
 * @param handleCreate - Function from useWizardCreation hook
 * @param wizardState - Wizard state object with state property
 * @returns Handler function that triggers creation with current state
 */
export function useWizardCreateHandler<TState>(
  handleCreate: (state: TState) => Promise<void>,
  wizardState: { state: TState }
): () => void {
  return useCallback(() => {
    handleCreate(wizardState.state)
  }, [handleCreate, wizardState])
}
