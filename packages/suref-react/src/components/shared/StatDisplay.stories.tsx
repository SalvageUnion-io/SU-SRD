import type { Story } from '@ladle/react'
import { StatDisplay } from './StatDisplay'

export default {
  title: 'Shared/StatDisplay',
}

export const Default: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={8} />
    <StatDisplay label="EP" value={6} />
    <StatDisplay label="HEAT" value={0} />
  </div>
)

export const WithOutOfMax: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={5} outOfMax={8} />
    <StatDisplay label="EP" value={3} outOfMax={6} />
    <StatDisplay label="HEAT" value={2} outOfMax={6} />
  </div>
)

export const Compact: Story = () => (
  <div className="flex gap-2">
    <StatDisplay label="SP" value={8} compact />
    <StatDisplay label="EP" value={6} compact />
    <StatDisplay label="HEAT" value={0} compact />
  </div>
)

export const Disabled: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={8} disabled />
    <StatDisplay label="EP" value={6} disabled />
  </div>
)

export const Inverse: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={8} inverse />
    <StatDisplay label="EP" value={6} inverse />
  </div>
)

export const Clickable: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={8} onClick={() => alert('Clicked SP!')} bottomLabel="MAX" />
    <StatDisplay label="EP" value={6} onClick={() => alert('Clicked EP!')} bottomLabel="MAX" />
  </div>
)

export const CustomColors: Story = () => (
  <div className="flex gap-3">
    <StatDisplay
      label="SP"
      value={8}
      bg="bg-su-green"
      valueColor="text-su-white"
      borderColor="border-su-green"
    />
    <StatDisplay
      label="EP"
      value={6}
      bg="bg-su-orange"
      valueColor="text-su-white"
      borderColor="border-su-orange"
    />
    <StatDisplay
      label="HEAT"
      value={4}
      bg="bg-su-pink"
      valueColor="text-su-white"
      borderColor="border-su-pink"
    />
  </div>
)

export const IsOverMax: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={10} outOfMax={8} isOverMax />
    <StatDisplay label="EP" value={8} outOfMax={6} isOverMax />
  </div>
)

export const WithHoverText: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={8} hoverText="Structure Points: The mech's health" />
    <StatDisplay label="EP" value={6} hoverText="Energy Points: Used to activate systems" />
  </div>
)
