import { Suspense } from 'react'
import { Box, Flex, Text, useBreakpointValue } from '@chakra-ui/react'
import { useSearch } from '@tanstack/react-router'
import { useSchemaData } from './schema/useSchemaData'
import { useSchemaParams } from '../hooks/useSchemaParams'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { findEntityBySlug } from '../utils/slug'
import { EntityDisplay } from './entity/EntityDisplay'

interface ItemShowPageProps {
  prefetchedItem?: SURefEntity | null
}

export default function ItemShowPage({ prefetchedItem }: ItemShowPageProps) {
  const { schemaId, itemId } = useSchemaParams()
  const { data, loading, error } = useSchemaData(schemaId)
  const search = useSearch({ strict: false })

  // Force compact mode on mobile/small screens (same breakpoint as condensed header)
  const isMobile = useBreakpointValue({ base: true, lg: false }) ?? false
  const searchCompact = (search as { compact?: string }).compact === 'true'
  const compact = isMobile ? true : searchCompact

  // Find item by slug first, then fallback to ID for backward compatibility
  const item =
    prefetchedItem ??
    (itemId
      ? (findEntityBySlug(schemaId as SURefEnumSchemaName, itemId) ??
        data.find((d) => d.id === itemId))
      : null)

  if (loading) {
    return (
      <Flex alignItems="center" justifyContent="center" h="full" bg="bg.landing">
        <Text fontSize="xl">Loading...</Text>
      </Flex>
    )
  }

  if (error || !item) {
    return (
      <Flex alignItems="center" justifyContent="center" h="full">
        <Text fontSize="xl" color="red.600">
          Error: {error || 'Item not found'}
        </Text>
      </Flex>
    )
  }

  return (
    <Flex minH="100%" flexDirection="column" bg="bg.landing">
      <Flex flex="1" p={4} alignItems="center" justifyContent="center" minH="0">
        <Box maxW="6xl" w="full">
          <Suspense
            fallback={
              <Flex alignItems="center" justifyContent="center" h="full" bg="bg.landing">
                <Text fontSize="xl">Loading component...</Text>
              </Flex>
            }
          >
            <EntityDisplay data={item} compact={compact} />
          </Suspense>
        </Box>
      </Flex>
    </Flex>
  )
}
