import { Box, VStack, HStack } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Text } from '../base/Text'
import { Card } from '../shared/Card'
import { AddStatButton } from '../shared/AddStatButton'
import { MechSmallDisplay } from '../Dashboard/MechSmallDisplay'
import { useCreateMech } from '../../hooks/mech'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../types/database-generated.types'

type Mech = Tables<'mechs'>

interface MechsTabProps {
  pilotId: string
  isLocal: boolean
  isEditable: boolean
}

export function MechsTab({ pilotId, isLocal, isEditable }: MechsTabProps) {
  const navigate = useNavigate()
  const { userId } = useCurrentUser()
  const createMech = useCreateMech()

  const { data: mechs = [], isLoading } = useQuery({
    queryKey: ['pilot-mechs', pilotId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mechs')
        .select('*')
        .eq('pilot_id', pilotId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as Mech[]
    },
    enabled: !!pilotId && !isLocal,
  })

  const activeMechs = mechs.filter((m) => m.active)
  const inactiveMechs = mechs.filter((m) => !m.active)

  const handleCreateMech = async () => {
    if (!userId) return

    const newMech = await createMech.mutateAsync({
      pattern: 'New Mech',
      current_damage: 0,
      current_heat: 0,
      current_ep: 0,
      user_id: userId,
      pilot_id: pilotId,
    })

    navigate({ to: '/dashboard/mechs/$id', params: { id: newMech.id } })
  }

  if (isLocal) {
    return (
      <Box bg="su.lightBlue" p={8} borderRadius="md" borderWidth="2px" borderColor="black">
        <Text textAlign="center" color="brand.srd" fontWeight="bold">
          Mechs are not available for local pilots
        </Text>
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box p={4}>
        <Text>Loading mechs...</Text>
      </Box>
    )
  }

  return (
    <VStack gap={6} alignItems="stretch">
      {isEditable && (
        <HStack justify="flex-start">
          <AddStatButton
            label="Create"
            bottomLabel="Mech"
            onClick={handleCreateMech}
            disabled={createMech.isPending}
            ariaLabel="Create new mech for this pilot"
          />
        </HStack>
      )}

      {activeMechs.length > 0 && (
        <VStack gap={3} alignItems="stretch">
          <Text variant="pseudoheader" fontSize="lg">
            Active
          </Text>
          {activeMechs.map((mech) => (
            <MechSmallDisplay key={mech.id} id={mech.id} />
          ))}
        </VStack>
      )}

      {inactiveMechs.length > 0 && (
        <VStack gap={3} alignItems="stretch">
          <Text variant="pseudoheader" fontSize="lg">
            Inactive
          </Text>
          {inactiveMechs.map((mech) => (
            <MechSmallDisplay key={mech.id} id={mech.id} />
          ))}
        </VStack>
      )}

      {mechs.length === 0 && (
        <Card bg="su.grey">
          <Text variant="pseudoheader" textAlign="center">
            No mechs assigned to this pilot
          </Text>
        </Card>
      )}
    </VStack>
  )
}
