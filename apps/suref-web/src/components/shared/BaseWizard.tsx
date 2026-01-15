import { Box, VStack, Button, Flex } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { WizardBreadcrumbs } from './WizardBreadcrumbs'
import type { ReactNode } from 'react'

export interface BaseWizardProps {
  stepLabels: readonly string[]
  currentStep: number
  completedSteps: Set<number>
  onStepChange: (step: number) => void
  onPrevious: () => void
  renderStep: (step: number) => ReactNode
  isCreating: boolean
  creatingMessage: string
  headerContent?: ReactNode
}

/**
 * Base wizard component that provides common layout and navigation
 * for all wizard implementations.
 */
export function BaseWizard({
  stepLabels,
  currentStep,
  completedSteps,
  onStepChange,
  onPrevious,
  renderStep,
  isCreating,
  creatingMessage,
  headerContent,
}: BaseWizardProps) {
  return (
    <VStack gap={6} align="stretch" w="full" maxW="1200px" mx="auto" p={6}>
      {/* Breadcrumb Navigation */}
      <Flex justifyContent="space-between" alignItems="center" w="full" gap={4}>
        <Button
          variant="ghost"
          onClick={onPrevious}
          disabled={currentStep === 1}
          _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
        >
          ← BACK
        </Button>
        <WizardBreadcrumbs
          labels={stepLabels}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={onStepChange}
        />
        {headerContent || <Box w="80px" />}
      </Flex>

      {/* Step Content */}
      <Box w="full" opacity={isCreating ? 0.5 : 1} pointerEvents={isCreating ? 'none' : 'auto'}>
        {renderStep(currentStep)}
      </Box>
      {isCreating && (
        <Box textAlign="center" py={4}>
          <Text fontSize="lg" fontWeight="bold">
            {creatingMessage}
          </Text>
        </Box>
      )}
    </VStack>
  )
}
