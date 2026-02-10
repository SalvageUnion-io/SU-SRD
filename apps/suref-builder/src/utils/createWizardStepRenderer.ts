import type { ReactNode } from 'react'

/**
 * Utility to create a wizard step renderer function
 * Extracts the common switch statement pattern from wizard components
 *
 * @param stepRenderer - Function that takes a step number (1-based) and returns the ReactNode for that step
 * @returns A renderStep function that takes a step number and returns the appropriate step component
 *
 * @example
 * const renderStep = createWizardStepRenderer((step) => {
 *   switch (step) {
 *     case 1: return <Step1 wizardState={wizardState} onComplete={handleStepComplete} />
 *     case 2: return <Step2 wizardState={wizardState} onComplete={handleStepComplete} />
 *     case 3: return <Step3 wizardState={wizardState} onCreate={handleCreate} />
 *     default: return null
 *   }
 * })
 */
export function createWizardStepRenderer(
  stepRenderer: (step: number) => ReactNode
): (step: number) => ReactNode {
  return stepRenderer
}
