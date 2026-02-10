import type { Story } from '@ladle/react'
import { Box } from '@chakra-ui/react'
import { NestedActionDisplay } from './NestedActionDisplay'
import { SalvageUnionReference, extractVisibleActions } from 'salvageunion-reference'
import type { SURefMetaAction } from 'salvageunion-reference'

export default {
  title: 'Entity/NestedActionDisplay',
}

// Find a system with visible actions to use as demo data
const systems = SalvageUnionReference.Systems.all()
let sampleAction: SURefMetaAction | undefined
for (const sys of systems) {
  const actions = extractVisibleActions(sys)
  if (actions && actions.length > 0) {
    sampleAction = actions[0]
    break
  }
}

// Fallback mock action
const mockAction: SURefMetaAction = sampleAction ?? {
  id: 'fire-weapon',
  name: 'Fire Weapon',
  activationCost: 1,
  content: [
    { type: 'paragraph', value: 'Make an attack against a target within range.' },
    { type: 'paragraph', value: 'On a hit, deal 3 damage to the target.' },
  ],
}

export const Default: Story = () => (
  <Box w="500px" bg="su.white" p={2}>
    <NestedActionDisplay data={mockAction} />
  </Box>
)

export const Compact: Story = () => (
  <Box w="400px" bg="su.white" p={2}>
    <NestedActionDisplay data={mockAction} compact />
  </Box>
)

export const HiddenContent: Story = () => (
  <Box w="500px" bg="su.white" p={2}>
    <NestedActionDisplay data={mockAction} hideContent />
  </Box>
)
