import { Box, Button, Grid, VStack } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { Text } from '../base/Text'
import { Card } from '../shared/Card'
import { MechSmallDisplay } from '../Dashboard/MechSmallDisplay'
import { useUpdateMech } from '../../hooks/mech'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../types/database-generated.types'

type Mech = Tables<'mechs'>

interface InactiveMechsTabProps {
  pilotId: string
  isEditable: boolean
}

export function InactiveMechsTab({ pilotId, isEditable }: InactiveMechsTabProps) {
  const updateMech = useUpdateMech()

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
    enabled: !!pilotId,
  })

  // Filter out active mech
  const inactiveMechs = mechs.filter((m) => !m.active)

  const handleSetActive = async (mechId: string) => {
    // First, set all mechs to inactive
    const allMechIds = mechs.map((m) => m.id)
    for (const id of allMechIds) {
      await updateMech.mutateAsync({ id, updates: { active: false } })
    }

    // Then set the selected mech to active
    await updateMech.mutateAsync({ id: mechId, updates: { active: true } })
  }

  if (isLoading) {
    return (
      <Box p={4}>
        <Text>Loading mechs...</Text>
      </Box>
    )
  }

  if (inactiveMechs.length === 0) {
    return (
      <Card bg="su.grey">
        <Text variant="pseudoheader" textAlign="center">
          No inactive mechs
        </Text>
      </Card>
    )
  }

  return (
    <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap={4}>
      {inactiveMechs.map((mech) => (
        <VStack key={mech.id} gap={2} alignItems="stretch">
          <MechSmallDisplay id={mech.id} />
          {isEditable && (
            <Button
              onClick={() => handleSetActive(mech.id)}
              disabled={updateMech.isPending}
              bg="su.green"
              color="su.white"
              _hover={{ bg: 'su.darkGreen' }}
            >
              Set Active
            </Button>
          )}
        </VStack>
      ))}
    </Grid>
  )
}
