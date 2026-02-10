import type { Story } from '@ladle/react'
import { Flex } from '@chakra-ui/react'
import { TraitKeywordDisplayView } from './TraitKeywordDisplayView'

export default {
  title: 'Entity/TraitKeywordDisplayView',
}

export const Trait: Story = () => (
  <Flex gap={3}>
    <TraitKeywordDisplayView label="Blast" schemaName="traits" />
    <TraitKeywordDisplayView label="Melee" schemaName="traits" />
    <TraitKeywordDisplayView label="Range" value={2} schemaName="traits" />
  </Flex>
)

export const Keyword: Story = () => (
  <Flex gap={3}>
    <TraitKeywordDisplayView label="Salvage" schemaName="keywords" />
    <TraitKeywordDisplayView label="Heavy" schemaName="keywords" />
  </Flex>
)

export const Compact: Story = () => (
  <Flex gap={2}>
    <TraitKeywordDisplayView label="Blast" schemaName="traits" compact />
    <TraitKeywordDisplayView label="Range" value={2} schemaName="traits" compact />
  </Flex>
)

export const Inline: Story = () => (
  <div>
    This weapon has <TraitKeywordDisplayView label="Blast" schemaName="traits" inline /> and{' '}
    <TraitKeywordDisplayView label="Range" value={3} schemaName="traits" inline /> properties.
  </div>
)

export const Damaged: Story = () => (
  <Flex gap={3}>
    <TraitKeywordDisplayView label="Blast" schemaName="traits" damaged />
    <TraitKeywordDisplayView label="Range" value={2} schemaName="traits" damaged />
  </Flex>
)
