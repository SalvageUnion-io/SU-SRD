import type { Story } from '@ladle/react'
import { Flex, Box } from '@chakra-ui/react'
import { EntityCardSkeleton } from './EntityCardSkeleton'

export default {
  title: 'Skeleton/EntityCardSkeleton',
}

export const Default: Story = () => (
  <Box w="400px">
    <EntityCardSkeleton />
  </Box>
)

export const Compact: Story = () => (
  <Box w="300px">
    <EntityCardSkeleton compact />
  </Box>
)

export const Multiple: Story = () => (
  <Flex direction="column" gap={4} w="400px">
    <EntityCardSkeleton />
    <EntityCardSkeleton />
    <EntityCardSkeleton />
  </Flex>
)
