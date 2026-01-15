import { VStack, Box } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { UserEntitySmallDisplay } from './UserEntitySmallDisplay'
import { useHydratedPilot, useDeletePilot } from '../../hooks/pilot'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { fetchUserDisplayName } from '../../lib/api/users'
import { pilotsKeys } from '../../hooks/pilot/usePilots'
import { fetchEntity } from '../../lib/api/entities'
import type { Tables } from '../../types/database-generated.types'
import { DeleteButton } from '../shared/DeleteButton'
import { logger } from '../../lib/logger'

interface PilotSmallDisplayProps {
  id?: string
  waitForId?: boolean
  label?: string
}

export function PilotSmallDisplay({ id, label, waitForId = false }: PilotSmallDisplayProps) {
  const queryClient = useQueryClient()
  const { userId: currentUserId } = useCurrentUser()
  const {
    pilot,
    selectedClass,
    selectedAdvancedClass,
    loading: pilotLoading,
  } = useHydratedPilot(id)
  const deletePilot = useDeletePilot()
  const className = selectedClass?.ref.name
  const advancedClassName = selectedAdvancedClass?.ref.name

  const handleMouseEnter = () => {
    if (!id) return
    queryClient.prefetchQuery({
      queryKey: pilotsKeys.byId(id),
      queryFn: () => fetchEntity<Tables<'pilots'>>('pilots', id),
    })
  }

  const { data: crawlerName, isLoading: crawlerLoading } = useQuery({
    queryKey: ['crawler-name', pilot?.crawler_id],
    queryFn: async () => {
      if (!pilot?.crawler_id) return null

      const { data, error } = await supabase
        .from('crawlers')
        .select('name')
        .eq('id', pilot.crawler_id)
        .single()

      if (error) {
        logger.error('Error fetching crawler:', error)
        return null
      }
      return data.name
    },
    enabled: !!pilot?.crawler_id,
  })

  const { data: mechChassisPattern, isLoading: mechLoading } = useQuery({
    queryKey: ['mech-pattern', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mechs')
        .select('pattern')
        .eq('pilot_id', id!)
        .eq('active', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        logger.error('Error fetching mech:', error)
        return null
      }
      return data.pattern
    },
    enabled: !!id,
  })

  const { data: ownerData } = useQuery({
    queryKey: ['user-display-name', pilot?.user_id],
    queryFn: () => fetchUserDisplayName(pilot!.user_id),
    enabled: !!pilot?.user_id && currentUserId !== pilot?.user_id,
  })
  if (!id && !waitForId) {
    return null
  }

  const isOwner = currentUserId === pilot?.user_id
  const ownerName = isOwner ? 'You' : ownerData || 'Owner'

  const isLoading = (!id && waitForId) || pilotLoading || crawlerLoading || mechLoading

  if (isLoading || !pilot || !id) {
    return (
      <UserEntitySmallDisplay
        to={id ? '/dashboard/pilots/$id' : undefined}
        params={id ? { id } : undefined}
        label={label}
        bgColor="su.orange"
        leftHeader="Loading..."
        rightHeader="..."
      />
    )
  }
  const detailContent = (
    <VStack gap={1} alignItems="stretch">
      {crawlerName && (
        <Box bg="su.pink" px={2} py={1} borderRadius="sm" borderWidth="2px" borderColor="black">
          <Text fontSize="xs" color="su.white" fontWeight="bold" textTransform="uppercase">
            {crawlerName}
          </Text>
        </Box>
      )}

      {mechChassisPattern && (
        <Box bg="su.green" px={2} py={1} borderRadius="sm" borderWidth="2px" borderColor="black">
          <Text fontSize="xs" color="su.white" fontWeight="bold" textTransform="uppercase">
            {mechChassisPattern}
          </Text>
        </Box>
      )}
    </VStack>
  )

  const rightHeader = advancedClassName?.toUpperCase()
    ? advancedClassName.toUpperCase()
    : className?.toUpperCase()

  const handleDelete = async () => {
    if (!id) return
    await deletePilot.mutateAsync(id)
  }

  const deleteButton =
    isOwner && id ? (
      <DeleteButton
        entityName="Pilot"
        onConfirmDelete={handleDelete}
        disabled={deletePilot.isPending}
      />
    ) : undefined

  return (
    <UserEntitySmallDisplay
      to="/dashboard/pilots/$id"
      params={{ id }}
      onMouseEnter={handleMouseEnter}
      label={label}
      bgColor="su.orange"
      detailLabel="Player"
      detailValue={ownerName}
      leftHeader={pilot.callsign}
      rightHeader={rightHeader}
      detailContent={crawlerName || mechChassisPattern ? detailContent : undefined}
      isInactive={pilot.active === false}
      deleteButton={deleteButton}
    />
  )
}
