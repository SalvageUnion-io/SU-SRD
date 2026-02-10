import { BaseWizard } from '../shared/BaseWizard'
import { useMechWizardState } from './useMechWizardState'
import { ChassisSelectionStep } from './ChassisSelectionStep'
import { SystemsModulesStep } from './SystemsModulesStep'
import { DetailsStep } from './DetailsStep'
import { useCreateMechFromWizard } from './useCreateMechFromWizard'
import { BudgetDisplay } from './BudgetDisplay'
import { useWizardCreation } from '../../hooks/useWizardCreation'
import { useWizardStepHandler, useWizardCreateHandler } from '../../hooks/useWizardHandlers'
import { createWizardStepRenderer } from '../../utils/createWizardStepRenderer'

export function MechWizard() {
  const wizardState = useMechWizardState()
  const createMech = useCreateMechFromWizard()
  const { isCreating, handleCreate } = useWizardCreation(createMech)

  const handleStepComplete = useWizardStepHandler(wizardState)
  const handleCreateMech = useWizardCreateHandler(handleCreate, wizardState)

  const renderStep = createWizardStepRenderer((step: number) => {
    switch (step) {
      case 1:
        return <ChassisSelectionStep wizardState={wizardState} onComplete={handleStepComplete} />
      case 2:
        return <SystemsModulesStep wizardState={wizardState} onComplete={handleStepComplete} />
      case 3:
        return <DetailsStep wizardState={wizardState} onCreateMech={handleCreateMech} />
      default:
        return null
    }
  })

  const stepLabels = ['CHASSIS', 'SYSTEMS & MODULES', 'DETAILS'] as const

  return (
    <BaseWizard
      stepLabels={stepLabels}
      currentStep={wizardState.currentStep}
      completedSteps={wizardState.completedSteps}
      onStepChange={wizardState.goToStep}
      onPrevious={wizardState.goToPreviousStep}
      renderStep={renderStep}
      isCreating={isCreating}
      creatingMessage="Creating your mech..."
      headerContent={<BudgetDisplay state={wizardState.state} />}
    />
  )
}

export default MechWizard
