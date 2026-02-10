import type { Story } from '@ladle/react'
import { Flex, Box } from '@chakra-ui/react'
import { EntityDisplayTooltip } from './EntityDisplayTooltip'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { ValueDisplay } from '../shared/ValueDisplay'

export default {
  title: 'Entity/EntityDisplayTooltip',
}

const system = SalvageUnionReference.Systems.all()[0]
const trait = SalvageUnionReference.Traits.all()[0]

export const Default: Story = () => (
  <Box p={8}>
    <EntityDisplayTooltip schemaName="systems" entityId={system?.id ?? ''}>
      <Text variant="pseudoheader" cursor="help">
        Hover to see {system?.name}
      </Text>
    </EntityDisplayTooltip>
  </Box>
)

export const WithValueDisplay: Story = () => (
  <Box p={8}>
    <EntityDisplayTooltip schemaName="systems" entityId={system?.id ?? ''}>
      <ValueDisplay label={system?.name ?? 'System'} value="TL 2" />
    </EntityDisplayTooltip>
  </Box>
)

export const TraitTooltip: Story = () => (
  <Flex gap={4} p={8}>
    <EntityDisplayTooltip schemaName="traits" entityId={trait?.id ?? ''}>
      <ValueDisplay label={trait?.name ?? 'Trait'} />
    </EntityDisplayTooltip>
  </Flex>
)
