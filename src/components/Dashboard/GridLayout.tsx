import { type ReactNode } from 'react'
import { Box, Flex, Spinner, VStack, Text } from '@chakra-ui/react'
import { Button } from '@chakra-ui/react'
import { Heading } from '../base/Heading'

interface CreateButtonConfig {
  onClick: () => void
  label: string
  color: string
  bgColor: string
  isLoading?: boolean
}

interface GridLayoutProps<T> {
  title: string
  loading: boolean
  error: string | null
  items: T[]
  renderItem: (item: T, isInactive?: boolean) => ReactNode
  createButton: CreateButtonConfig
  onRetry: () => void
  emptyStateMessage?: string
  emptyStateIcon?: string
  primarySectionLabel?: string
  secondarySectionLabel?: string
  getSectionType?: (item: T) => 'primary' | 'secondary'
}

export function GridLayout<T extends object>({
  title,
  loading,
  error,
  items,
  renderItem,
  createButton,
  onRetry,
  emptyStateMessage,
  primarySectionLabel = 'Active',
  secondarySectionLabel = 'Inactive',
  getSectionType,
}: GridLayoutProps<T>) {
  let primaryItems: T[]
  let secondaryItems: T[]

  if (getSectionType) {
    primaryItems = items.filter((item) => getSectionType(item) === 'primary')
    secondaryItems = items.filter((item) => getSectionType(item) === 'secondary')
  } else {
    const hasActiveProperty = items.length > 0 && items[0] && 'active' in items[0]
    primaryItems = hasActiveProperty
      ? items.filter((item) => (item as { active?: boolean }).active !== false)
      : items
    secondaryItems = hasActiveProperty
      ? items.filter((item) => (item as { active?: boolean }).active === false)
      : []
  }
  return (
    <Box p={8}>
      <Flex mb={8} align="center" justify="space-between" gap={4}>
        <Heading level="h1">{title}</Heading>
        <Button
          onClick={createButton.onClick}
          bg={createButton.bgColor}
          color={createButton.color}
          fontWeight="bold"
          border="3px solid black"
          py={2}
          px={6}
          _hover={{ opacity: 0.9 }}
          disabled={createButton.isLoading}
          opacity={createButton.isLoading ? 0.6 : 1}
        >
          {createButton.isLoading ? (
            <Flex align="center" gap={2}>
              <Spinner size="sm" />
              <>{createButton.label}</>
            </Flex>
          ) : (
            <>+ {createButton.label}</>
          )}
        </Button>
      </Flex>

      {error && (
        <Flex align="center" justify="center" minH="60vh">
          <Button
            onClick={onRetry}
            bg="brand.srd"
            color="su.white"
            fontWeight="bold"
            py={2}
            px={6}
            _hover={{ opacity: 0.9 }}
          >
            Retry
          </Button>
        </Flex>
      )}
      {loading && (
        <Flex align="center" justify="center" minH="60vh">
          <Spinner />
        </Flex>
      )}
      {!loading && !error && items.length === 0 && (
        <Flex align="center" justify="center" minH="60vh">
          <VStack gap={4}>
            <Text fontSize="xl" fontWeight="bold" color="su.white">
              {emptyStateMessage || 'No items yet'}
            </Text>
            <Text fontSize="md" color="su.lightGrey">
              Click the button above to create your first one!
            </Text>
          </VStack>
        </Flex>
      )}
      {!loading && !error && items.length > 0 && (
        <VStack gap={8} alignItems="stretch" w="full">
          {primaryItems.length > 0 && (
            <VStack gap={4} alignItems="stretch">
              <Heading level="h2">{primarySectionLabel}</Heading>
              <VStack gap={4} alignItems="stretch">
                {primaryItems.map((item) => renderItem(item, false))}
              </VStack>
            </VStack>
          )}

          {secondaryItems.length > 0 && (
            <VStack gap={4} alignItems="stretch">
              <Heading level="h2">{secondarySectionLabel}</Heading>
              <VStack gap={4} alignItems="stretch">
                {secondaryItems.map((item) => renderItem(item, true))}
              </VStack>
            </VStack>
          )}
        </VStack>
      )}
    </Box>
  )
}
