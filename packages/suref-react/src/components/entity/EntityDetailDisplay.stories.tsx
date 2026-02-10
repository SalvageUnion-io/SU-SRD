import type { Story } from '@ladle/react'
import { Box, Flex } from '@chakra-ui/react'
import { EntityDetailDisplay } from './EntityDetailDisplay'
import { EntityDisplay } from './EntityDisplay/index'
import { SalvageUnionReference } from 'salvageunion-reference'

export default {
  title: 'Entity/EntityDetailDisplay',
}

// EntityDetailDisplay uses useEntityDisplayContext, so it must be rendered within an EntityDisplay
const system = SalvageUnionReference.Systems.all()[0]

export const WithinEntityDisplay: Story = () => (
  <Box w="500px">
    <EntityDisplay data={system}>
      <Flex gap={2} flexWrap="wrap" p={2}>
        <EntityDetailDisplay label="Blast" schemaName="traits" />
        <EntityDetailDisplay label="Range" value={2} schemaName="traits" />
        <EntityDetailDisplay label="Salvage" schemaName="keywords" />
      </Flex>
    </EntityDisplay>
  </Box>
)

export const Compact: Story = () => (
  <Box w="400px">
    <EntityDisplay data={system} compact>
      <Flex gap={1} flexWrap="wrap" p={1}>
        <EntityDetailDisplay label="Blast" schemaName="traits" compact />
        <EntityDetailDisplay label="Range" value={2} schemaName="traits" compact />
      </Flex>
    </EntityDisplay>
  </Box>
)
