import { Flex } from '@chakra-ui/react'
import { Text } from '../base/Text'

export interface WizardBreadcrumbsProps {
  labels: readonly string[]
  currentStep: number
  completedSteps: Set<number>
  onStepClick: (step: number) => void
}

/**
 * Reusable breadcrumb navigation component for multi-step wizards.
 * Shows step labels separated by >>>>>, with styling based on completion status.
 * Complete steps have white text and are clickable.
 * Incomplete steps have grey text.
 * The least-concluded (first incomplete) step is clickable to allow navigation forward.
 */
export function WizardBreadcrumbs({
  labels,
  currentStep,
  completedSteps,
  onStepClick,
}: WizardBreadcrumbsProps) {
  const getNextIncompleteStep = (): number | null => {
    for (let step = 1; step <= labels.length; step++) {
      if (!completedSteps.has(step)) {
        return step
      }
    }
    return null
  }

  const nextIncompleteStep = getNextIncompleteStep()

  return (
    <Flex gap={2} alignItems="center" flex="1" justifyContent="center">
      {labels.map((label, index) => {
        const stepNumber = index + 1
        const isCompleted = completedSteps.has(stepNumber)
        const isCurrent = currentStep === stepNumber
        // Allow clicking if completed, current, or is the next incomplete step
        const isClickable =
          isCompleted ||
          isCurrent ||
          (nextIncompleteStep !== null && stepNumber === nextIncompleteStep)

        return (
          <Flex key={stepNumber} gap={2} alignItems="center" minH="1em">
            <Text
              variant="pseudoheader"
              fontSize="sm"
              textTransform="uppercase"
              fontWeight={isCurrent ? 'bold' : 'normal'}
              color={isCompleted ? 'su.white' : isCurrent ? 'su.orange' : 'whiteAlpha.800'}
              cursor={isClickable ? 'pointer' : 'default'}
              onClick={isClickable ? () => onStepClick(stepNumber) : undefined}
              _hover={isClickable ? { textDecoration: 'underline' } : {}}
              lineHeight="1"
            >
              {label}
            </Text>
            {index < labels.length - 1 && (
              <Text fontSize="sm" color="fg.muted" mx={1} lineHeight="1">
                {'>>>>>'}
              </Text>
            )}
          </Flex>
        )
      })}
    </Flex>
  )
}
