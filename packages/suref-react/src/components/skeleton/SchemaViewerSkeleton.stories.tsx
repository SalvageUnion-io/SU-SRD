import type { Story } from '@ladle/react'
import { Box } from '@chakra-ui/react'
import { SchemaViewerSkeleton } from './SchemaViewerSkeleton'

export default {
  title: 'Skeleton/SchemaViewerSkeleton',
}

export const Default: Story = () => (
  <Box w="full">
    <SchemaViewerSkeleton />
  </Box>
)
