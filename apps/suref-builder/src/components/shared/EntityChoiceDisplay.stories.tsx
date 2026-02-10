import type { Story } from '@ladle/react'
import { EntityChoiceDisplay } from './EntityChoiceDisplay'
import { Box, VStack } from '@chakra-ui/react'
import { Text } from 'suref-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SURefObjectChoice } from 'salvageunion-reference'

const queryClient = new QueryClient()

// Wrapper to provide QueryClient
function QueryWrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export default {
  title: 'Shared/EntityChoiceDisplay',
}

// Mock choice for a system selection
const systemChoice: SURefObjectChoice = {
  id: 'system-choice-1',
  name: 'Weapon System',
  schema: ['systems'],
}

// Mock choice with choiceOptions
const optionChoice: SURefObjectChoice = {
  id: 'option-choice-1',
  name: 'Modification',
  choiceOptions: [
    { label: 'Extended Range', value: 'extended-range', description: 'Increases range by 1 zone' },
    { label: 'High Caliber', value: 'high-caliber', description: 'Adds +2 damage' },
    { label: 'Rapid Fire', value: 'rapid-fire', description: 'Can fire twice per turn' },
  ],
}

export const WizardModeNoSelection: Story = () => (
  <QueryWrapper>
    <Box w="400px" p={4}>
      <Text fontWeight="bold" mb={2}>
        Wizard Mode - No Selection
      </Text>
      <EntityChoiceDisplay choice={systemChoice} mode="wizard" onUpdateChoice={() => {}} />
    </Box>
  </QueryWrapper>
)

export const WizardModeWithOptions: Story = () => (
  <QueryWrapper>
    <Box w="400px" p={4}>
      <Text fontWeight="bold" mb={2}>
        Wizard Mode - With Choice Options
      </Text>
      <EntityChoiceDisplay choice={optionChoice} mode="wizard" onUpdateChoice={() => {}} />
    </Box>
  </QueryWrapper>
)

export const WizardModeSelectedOption: Story = () => (
  <QueryWrapper>
    <Box w="400px" p={4}>
      <Text fontWeight="bold" mb={2}>
        Wizard Mode - Option Selected
      </Text>
      <EntityChoiceDisplay
        choice={optionChoice}
        mode="wizard"
        selectedValue="extended-range"
        onUpdateChoice={() => {}}
      />
    </Box>
  </QueryWrapper>
)

export const EntityModeNoSelection: Story = () => (
  <QueryWrapper>
    <Box w="400px" p={4}>
      <Text fontWeight="bold" mb={2}>
        Entity Mode - No Selection
      </Text>
      <EntityChoiceDisplay
        choice={systemChoice}
        mode="entity"
        entityId={undefined}
        onUpdateChoice={() => {}}
      />
    </Box>
  </QueryWrapper>
)

export const ReadOnlyMode: Story = () => (
  <QueryWrapper>
    <Box w="400px" p={4}>
      <Text fontWeight="bold" mb={2}>
        Read Only Mode (no onUpdateChoice)
      </Text>
      <EntityChoiceDisplay choice={systemChoice} mode="wizard" />
    </Box>
  </QueryWrapper>
)

export const MultipleChoices: Story = () => (
  <QueryWrapper>
    <VStack w="400px" p={4} gap={4} alignItems="stretch">
      <Box>
        <Text fontWeight="bold" mb={2}>
          Choice 1: Weapon
        </Text>
        <EntityChoiceDisplay
          choice={{ ...systemChoice, id: 'choice-1', name: 'Primary Weapon' }}
          mode="wizard"
          onUpdateChoice={() => {}}
        />
      </Box>
      <Box>
        <Text fontWeight="bold" mb={2}>
          Choice 2: Module
        </Text>
        <EntityChoiceDisplay
          choice={{ id: 'choice-2', name: 'Module', schema: ['modules'] }}
          mode="wizard"
          onUpdateChoice={() => {}}
        />
      </Box>
    </VStack>
  </QueryWrapper>
)
