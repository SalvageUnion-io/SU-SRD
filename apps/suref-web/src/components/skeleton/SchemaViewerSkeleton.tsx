import { Box, Flex, Skeleton } from '@chakra-ui/react'
import { EntityCardSkeleton } from './EntityCardSkeleton'

/**
 * Skeleton loading placeholder for the SchemaViewer component.
 * Shows a header area with search input skeleton and a grid of entity card skeletons.
 */
export function SchemaViewerSkeleton() {
  return (
    <Flex flexDirection="column" minH="100%">
      {/* Header skeleton */}
      <Box py={6} px={6} bg="su.mediumGrey">
        {/* Title skeleton */}
        <Skeleton height="36px" width="200px" mx="auto" mb={3} />
        {/* Description skeleton */}
        <Skeleton height="20px" width="80%" maxW="600px" mx="auto" mb={3} />
        {/* Search input skeleton */}
        <Skeleton height="40px" width="100%" maxW="600px" mx="auto" borderRadius="md" />
      </Box>

      {/* Grid skeleton */}
      <Box flex="1" p={6} bg="bg.landing">
        <Box
          maxW="1400px"
          mx="auto"
          css={{
            columnCount: { base: 1, md: 2, lg: 3 },
            columnGap: '1rem',
            '& > *': {
              breakInside: 'avoid',
              marginBottom: '1rem',
            },
          }}
        >
          {/* Show 9 skeleton cards (3 per column in a 3-column layout) */}
          {Array.from({ length: 9 }).map((_, i) => (
            <EntityCardSkeleton key={i} />
          ))}
        </Box>
      </Box>
    </Flex>
  )
}
