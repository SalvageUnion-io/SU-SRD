import { Box, Flex } from '@chakra-ui/react'
import { SheetDisplay } from '../shared/SheetDisplay'
import { Text } from '../base/Text'
import { calculateRemainingBudget, STARTING_BUDGET } from './utils'
import type { WizardState } from './utils'

interface BudgetDisplayProps {
  state: WizardState
}

export function BudgetDisplay({ state }: BudgetDisplayProps) {
  const remainingBudget = calculateRemainingBudget(state)
  const isNegative = remainingBudget < 0

  // When within budget, text is black. When over budget, text is red.
  const textColor = isNegative ? 'red.600' : 'su.black'
  const borderColor = isNegative ? 'red.600' : 'su.black'
  const label = isNegative ? 'NOT LEGAL STARTING MECH' : 'Budget'

  return (
    <Box
      bg="su.white"
      borderWidth="2px"
      borderColor={borderColor}
      borderRadius="md"
      p={3}
      boxShadow="lg"
      minW="200px"
      flexShrink={0}
    >
      <SheetDisplay label={label} labelColor={textColor}>
        <Flex direction="column" gap={1}>
          <Text fontSize="lg" fontWeight="bold" color={textColor}>
            {remainingBudget} / {STARTING_BUDGET} TL1 Scrap
          </Text>
        </Flex>
      </SheetDisplay>
    </Box>
  )
}
