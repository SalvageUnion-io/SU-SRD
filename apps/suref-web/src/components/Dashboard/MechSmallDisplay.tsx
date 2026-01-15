import { VStack, Box } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { UserEntitySmallDisplay } from './UserEntitySmallDisplay'
import { useHydratedMech, useDeleteMech } from '../../hooks/mech'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { fetchUserDisplayName } from '../../lib/api/users'
import { mechsKeys } from '../../hooks/mech/useMechs'
import { fetchEntity } from '../../lib/api/entities'
import type { Tables } from '../../types/database-generated.types'
import { DeleteButton } from '../shared/DeleteButton'
import { logger } from '../../lib/logger'

interface MechSmallDisplayProps {
  id?: string
  reverse?: boolean
}

export function MechSmallDisplay({ id, reverse = false }: MechSmallDisplayProps) {
  const queryClient = useQueryClient()
  const { userId: currentUserId } = useCurrentUser()
  const { mech, selectedChassis, loading: mechLoading } = useHydratedMech(id)
  const deleteMech = useDeleteMech()

  const chassisName = selectedChassis?.ref.name || 'No Chassis'

  const handleMouseEnter = () => {
    if (!id) return
    queryClient.prefetchQuery({
      queryKey: mechsKeys.byId(id),
      queryFn: () => fetchEntity<Tables<'mechs'>>('mechs', id),
    })
  }

  const { data: pilotData, isLoading: pilotLoading } = useQuery({
    queryKey: ['pilot-data', mech?.pilot_id],
    queryFn: async () => {
      if (!mech?.pilot_id) return null

      const { data, error } = await supabase
        .from('pilots')
        .select('callsign, crawler_id')
        .eq('id', mech.pilot_id)
        .single()

      if (error) {
        logger.error('Error fetching pilot:', error)
        return null
      }
      return data
    },
    enabled: !!mech?.pilot_id,
  })

  const { data: crawlerName, isLoading: crawlerLoading } = useQuery({
    queryKey: ['crawler-name', pilotData?.crawler_id],
    queryFn: async () => {
      if (!pilotData?.crawler_id) return null

      const { data, error } = await supabase
        .from('crawlers')
        .select('name')
        .eq('id', pilotData.crawler_id)
        .single()

      if (error) {
        logger.error('Error fetching crawler:', error)
        return null
      }
      return data.name
    },
    enabled: !!pilotData?.crawler_id,
  })

  const { data: ownerData } = useQuery({
    queryKey: ['user-display-name', mech?.user_id],
    queryFn: () => fetchUserDisplayName(mech!.user_id),
    enabled: !!mech?.user_id && currentUserId !== mech?.user_id,
  })

  const isOwner = currentUserId === mech?.user_id
  const ownerName = isOwner ? 'You' : ownerData || 'Owner'

  const isLoading = !id || mechLoading || pilotLoading || crawlerLoading

  if (isLoading || !mech || !id) {
    return (
      <UserEntitySmallDisplay
        reverse={reverse}
        to={id ? '/dashboard/mechs/$id' : undefined}
        params={id ? { id } : undefined}
        bgColor="su.green"
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

      {pilotData?.callsign && (
        <Box bg="su.orange" px={2} py={1} borderRadius="sm" borderWidth="2px" borderColor="black">
          <Text fontSize="xs" color="su.white" fontWeight="bold" textTransform="uppercase">
            {pilotData.callsign}
          </Text>
        </Box>
      )}
    </VStack>
  )

  const handleDelete = async () => {
    if (!id) return
    await deleteMech.mutateAsync(id)
  }

  const deleteButton =
    isOwner && id ? (
      <DeleteButton
        entityName="Mech"
        onConfirmDelete={handleDelete}
        disabled={deleteMech.isPending}
      />
    ) : undefined

  return (
    <UserEntitySmallDisplay
      reverse={reverse}
      to="/dashboard/mechs/$id"
      params={{ id }}
      onMouseEnter={handleMouseEnter}
      bgColor="su.green"
      detailLabel="Player"
      detailValue={ownerName}
      leftHeader={`"${mech.pattern ?? chassisName}"`}
      rightHeader={chassisName.toUpperCase()}
      detailContent={crawlerName || pilotData?.callsign ? detailContent : undefined}
      isInactive={mech.active === false}
      deleteButton={deleteButton}
    />
  )
}
