import { Suspense } from 'react'
import { Box, Flex, useBreakpointValue } from '@chakra-ui/react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { useSchemaData } from './schema/useSchemaData'
import { useSchemaParams } from '../hooks/useSchemaParams'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { getModel } from 'salvageunion-reference'
import { findEntityBySlug } from '../utils/slug'
import { EntityDisplay } from './entity/EntityDisplay'
import { NotFoundDisplay } from './entity/NotFoundDisplay'
import { EntityCardSkeleton } from './skeleton/EntityCardSkeleton'

interface ItemShowPageProps {
  prefetchedItem?: SURefEntity | null
}

export default function ItemShowPage({ prefetchedItem }: ItemShowPageProps) {
  const { schemaId, itemId } = useSchemaParams()
  const { data, loading, error } = useSchemaData(schemaId)
  const search = useSearch({ strict: false })
  const navigate = useNavigate()

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
      <Flex minH="100%" flexDirection="column" bg="bg.landing">
        <Flex flex="1" p={4} alignItems="center" justifyContent="center" minH="0">
          <Box maxW="6xl" w="full">
            <EntityCardSkeleton />
          </Box>
        </Flex>
      </Flex>
    )
  }

  if (error || !item) {
    const schemaDisplayName = schemaId ? getModel(schemaId)?.displayName : undefined
    return (
      <Flex alignItems="center" justifyContent="center" h="full" bg="bg.landing">
        <NotFoundDisplay
          entityType={schemaDisplayName}
          entityId={itemId || undefined}
          onClose={() => navigate({ to: '/schema/$schemaId', params: { schemaId } })}
        />
      </Flex>
    )
  }

  return (
    <Flex minH="100%" flexDirection="column" bg="bg.landing">
      <Flex flex="1" p={4} alignItems="center" justifyContent="center" minH="0">
        <Box maxW="6xl" w="full">
          <Suspense fallback={<EntityCardSkeleton compact={compact} />}>
            <EntityDisplay data={item} compact={compact} />
          </Suspense>
        </Box>
      </Flex>
    </Flex>
  )
}
