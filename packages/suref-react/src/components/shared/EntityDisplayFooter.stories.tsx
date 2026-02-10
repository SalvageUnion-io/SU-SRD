import type { Story } from '@ladle/react'
import { Box } from '@chakra-ui/react'
import { EntityDisplay } from '../entity/EntityDisplay/index'
import { SalvageUnionReference } from 'salvageunion-reference'

export default {
  title: 'Shared/EntityDisplayFooter',
}

// Use a real entity with page data
const systemEntity = SalvageUnionReference.Systems.all()[0]

export const WithinEntityDisplay: Story = () => (
  <Box w="500px">
    <EntityDisplay data={systemEntity} showFooter>
      <Box p={2} fontSize="sm">
        Footer is shown at the bottom of this entity display.
      </Box>
    </EntityDisplay>
  </Box>
)

export const Compact: Story = () => (
  <Box w="400px">
    <EntityDisplay data={systemEntity} showFooter compact>
      <Box p={2} fontSize="sm">
        Compact entity with footer.
      </Box>
    </EntityDisplay>
  </Box>
)
