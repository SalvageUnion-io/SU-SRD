import type { Story } from '@ladle/react'
import { Flex, Box } from '@chakra-ui/react'
import { EntityDisplay } from './EntityDisplay/index'
import { SalvageUnionReference } from 'salvageunion-reference'

export default {
  title: 'Entity/EntityDisplay',
}

const system = SalvageUnionReference.Systems.all()[0]
const module = SalvageUnionReference.Modules.all()[0]
const chassis = SalvageUnionReference.Chassis.all()[0]
const ability = SalvageUnionReference.Abilities.all()[0]
const trait = SalvageUnionReference.Traits.all()[0]

export const DefaultSystem: Story = () => (
  <Box w="600px">
    <EntityDisplay data={system} />
  </Box>
)

export const CompactMode: Story = () => (
  <Box w="400px">
    <EntityDisplay data={system} compact />
  </Box>
)

export const Collapsible: Story = () => (
  <Box w="600px">
    <EntityDisplay data={system} collapsible defaultExpanded={false} />
  </Box>
)

export const CollapsibleExpanded: Story = () => (
  <Box w="600px">
    <EntityDisplay data={system} collapsible defaultExpanded />
  </Box>
)

export const Disabled: Story = () => (
  <Box w="600px">
    <EntityDisplay data={system} disabled />
  </Box>
)

export const Damaged: Story = () => (
  <Box w="600px">
    <EntityDisplay data={system} damaged />
  </Box>
)

export const CustomHeaderColor: Story = () => (
  <Box w="600px">
    <EntityDisplay data={system} headerColor="su.pink" />
  </Box>
)

export const HiddenActions: Story = () => (
  <Box w="600px">
    <EntityDisplay data={system} hideActions />
  </Box>
)

export const WithFooter: Story = () => (
  <Box w="600px">
    <EntityDisplay data={system} showFooter />
  </Box>
)

export const DifferentSchemas: Story = () => (
  <Flex direction="column" gap={4} w="600px">
    <EntityDisplay data={system} />
    <EntityDisplay data={module} />
    <EntityDisplay data={chassis} />
    <EntityDisplay data={ability} />
    <EntityDisplay data={trait} />
  </Flex>
)

export const DimHeader: Story = () => (
  <Box w="600px">
    <EntityDisplay data={ability} dimHeader />
  </Box>
)
