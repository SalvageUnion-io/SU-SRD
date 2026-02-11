import { Box, Flex, Skeleton, SkeletonText } from '@chakra-ui/react'

interface EntityCardSkeletonProps {
  /** Whether to use compact styling */
  compact?: boolean
}

/**
 * Skeleton loading placeholder that matches the EntityDisplay card layout.
 * Shows a card with placeholder shapes for title, stats, and description.
 */
export function EntityCardSkeleton({ compact = false }: EntityCardSkeletonProps) {
  return (
    <Flex
      direction="column"
      bg="su.lightBlue"
      borderRadius="md"
      shadow="lg"
      overflow="hidden"
      minH="fit-content"
    >
      {/* Header skeleton */}
      <Flex
        w="full"
        p={compact ? 1 : 2}
        bg="su.lightBlue"
        minH={compact ? '70px' : '100px'}
        alignItems="center"
        justifyContent="space-between"
        gap={2}
      >
        <Flex direction="column" gap={compact ? 0.5 : 1} flex="1">
          {/* Title skeleton */}
          <Skeleton height={compact ? '20px' : '28px'} width="70%" />
          {/* Subtitle/stats skeleton */}
          <Flex gap={2} flexWrap="wrap">
            <Skeleton height="18px" width="50px" />
            <Skeleton height="18px" width="60px" />
            <Skeleton height="18px" width="40px" />
          </Flex>
        </Flex>
        {/* Right content (tech level badge) skeleton */}
        <Skeleton height="32px" width="40px" borderRadius="md" />
      </Flex>

      {/* Body content skeleton */}
      <Box p={4} w="full">
        <SkeletonText noOfLines={compact ? 2 : 4} gap="3" />
      </Box>
    </Flex>
  )
}
