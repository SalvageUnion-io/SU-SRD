import type { Story } from '@ladle/react'
import { Box } from '@chakra-ui/react'
import { NotFoundDisplay } from './NotFoundDisplay'

export default {
  title: 'Entity/NotFoundDisplay',
}

export const WithTypeAndId: Story = () => (
  <Box w="500px">
    <NotFoundDisplay entityType="System" entityId="laser-cannon-mk5" />
  </Box>
)

export const WithIdOnly: Story = () => (
  <Box w="500px">
    <NotFoundDisplay entityId="unknown-entity-123" />
  </Box>
)

export const Generic: Story = () => (
  <Box w="500px">
    <NotFoundDisplay />
  </Box>
)

export const WithCloseButton: Story = () => (
  <Box w="500px">
    <NotFoundDisplay
      entityType="Module"
      entityId="missing-module"
      onClose={() => alert('Closed!')}
    />
  </Box>
)
