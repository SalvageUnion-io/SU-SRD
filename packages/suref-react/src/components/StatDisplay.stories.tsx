import type { Story } from '@ladle/react'
import { Flex } from '@chakra-ui/react'
import { StatDisplay } from './StatDisplay'

export default {
  title: 'Shared/StatDisplay',
}

export const Default: Story = () => (
  <Flex gap={3}>
    <StatDisplay label="SP" value={8} />
    <StatDisplay label="EP" value={6} />
    <StatDisplay label="HEAT" value={0} />
  </Flex>
)

export const WithOutOfMax: Story = () => (
  <Flex gap={3}>
    <StatDisplay label="SP" value={5} outOfMax={8} />
    <StatDisplay label="EP" value={3} outOfMax={6} />
    <StatDisplay label="HEAT" value={2} outOfMax={6} />
  </Flex>
)

export const Compact: Story = () => (
  <Flex gap={2}>
    <StatDisplay label="SP" value={8} compact />
    <StatDisplay label="EP" value={6} compact />
    <StatDisplay label="HEAT" value={0} compact />
  </Flex>
)

export const Disabled: Story = () => (
  <Flex gap={3}>
    <StatDisplay label="SP" value={8} disabled />
    <StatDisplay label="EP" value={6} disabled />
  </Flex>
)

export const Inverse: Story = () => (
  <Flex gap={3}>
    <StatDisplay label="SP" value={8} inverse />
    <StatDisplay label="EP" value={6} inverse />
  </Flex>
)

export const Clickable: Story = () => (
  <Flex gap={3}>
    <StatDisplay label="SP" value={8} onClick={() => alert('Clicked SP!')} bottomLabel="MAX" />
    <StatDisplay label="EP" value={6} onClick={() => alert('Clicked EP!')} bottomLabel="MAX" />
  </Flex>
)

export const CustomColors: Story = () => (
  <Flex gap={3}>
    <StatDisplay label="SP" value={8} bg="su.green" valueColor="su.white" borderColor="su.green" />
    <StatDisplay
      label="EP"
      value={6}
      bg="su.orange"
      valueColor="su.white"
      borderColor="su.orange"
    />
    <StatDisplay label="HEAT" value={4} bg="su.pink" valueColor="su.white" borderColor="su.pink" />
  </Flex>
)

export const IsOverMax: Story = () => (
  <Flex gap={3}>
    <StatDisplay label="SP" value={10} outOfMax={8} isOverMax />
    <StatDisplay label="EP" value={8} outOfMax={6} isOverMax />
  </Flex>
)

export const WithHoverText: Story = () => (
  <Flex gap={3}>
    <StatDisplay label="SP" value={8} hoverText="Structure Points: The mech's health" />
    <StatDisplay label="EP" value={6} hoverText="Energy Points: Used to activate systems" />
  </Flex>
)
