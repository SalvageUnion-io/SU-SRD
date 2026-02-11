import type { Story } from '@ladle/react'
import { ActivationCostBox } from './ActivationCostBox'
import { Text } from '../base/Text'

export default {
  title: 'Shared/ActivationCostBox',
}

export const ActionPoints: Story = () => (
  <div className="flex items-center gap-4">
    <ActivationCostBox cost={1} currency="AP" />
    <ActivationCostBox cost={2} currency="AP" />
    <ActivationCostBox cost={3} currency="AP" />
  </div>
)

export const EnergyPoints: Story = () => (
  <div className="flex items-center gap-4">
    <ActivationCostBox cost={1} currency="EP" />
    <ActivationCostBox cost={2} currency="EP" />
    <ActivationCostBox cost={3} currency="EP" />
  </div>
)

export const VariableCost: Story = () => (
  <div className="flex items-center gap-4">
    <ActivationCostBox cost="Variable" currency="AP" />
    <Text className="text-sm">Variable costs display as X</Text>
  </div>
)

export const Compact: Story = () => (
  <div className="flex items-center gap-3">
    <ActivationCostBox cost={1} currency="AP" compact />
    <ActivationCostBox cost={2} currency="EP" compact />
    <ActivationCostBox cost="Variable" currency="AP" compact />
  </div>
)
