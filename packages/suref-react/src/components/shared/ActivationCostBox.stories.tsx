import type { Story } from '@ladle/react'
import { Flex } from '@chakra-ui/react'
import { ActivationCostBox } from './ActivationCostBox'
import { Text } from '../base/Text'

export default {
  title: 'Shared/ActivationCostBox',
}

export const ActionPoints: Story = () => (
  <Flex gap={4} alignItems="center">
    <ActivationCostBox cost={1} currency="AP" />
    <ActivationCostBox cost={2} currency="AP" />
    <ActivationCostBox cost={3} currency="AP" />
  </Flex>
)

export const EnergyPoints: Story = () => (
  <Flex gap={4} alignItems="center">
    <ActivationCostBox cost={1} currency="EP" />
    <ActivationCostBox cost={2} currency="EP" />
    <ActivationCostBox cost={3} currency="EP" />
  </Flex>
)

export const VariableCost: Story = () => (
  <Flex gap={4} alignItems="center">
    <ActivationCostBox cost="Variable" currency="AP" />
    <Text fontSize="sm">Variable costs display as X</Text>
  </Flex>
)

export const Compact: Story = () => (
  <Flex gap={3} alignItems="center">
    <ActivationCostBox cost={1} currency="AP" compact />
    <ActivationCostBox cost={2} currency="EP" compact />
    <ActivationCostBox cost="Variable" currency="AP" compact />
  </Flex>
)
