import type { Story } from '@ladle/react'
import { Flex } from '@chakra-ui/react'
import { ValueDisplay } from './ValueDisplay'

export default {
  title: 'Shared/ValueDisplay',
}

export const Default: Story = () => (
  <Flex gap={3} flexWrap="wrap">
    <ValueDisplay label="SP" value={8} />
    <ValueDisplay label="EP" value={3} />
    <ValueDisplay label="AP" value={2} />
    <ValueDisplay label="HEAT" value={4} />
  </Flex>
)

export const LabelOnly: Story = () => (
  <Flex gap={3}>
    <ValueDisplay label="RANGE 2" />
    <ValueDisplay label="MELEE" />
    <ValueDisplay label="PASSIVE" />
  </Flex>
)

export const Compact: Story = () => (
  <Flex gap={2}>
    <ValueDisplay label="SP" value={8} compact />
    <ValueDisplay label="EP" value={3} compact />
    <ValueDisplay label="TL" value={2} compact />
  </Flex>
)

export const Inverse: Story = () => (
  <Flex gap={3}>
    <ValueDisplay label="SP" value={8} inverse />
    <ValueDisplay label="EP" value={3} inverse />
  </Flex>
)

export const Damaged: Story = () => (
  <Flex gap={3}>
    <ValueDisplay label="SP" value={8} damaged rotation={-3} />
    <ValueDisplay label="EP" value={3} damaged rotation={5} />
    <ValueDisplay label="HEAT" value={4} damaged rotation={-7} />
  </Flex>
)

export const Inline: Story = () => (
  <div>
    This system has <ValueDisplay label="SP" value={8} /> salvage points and costs{' '}
    <ValueDisplay label="EP" value={2} /> to activate.
  </div>
)
