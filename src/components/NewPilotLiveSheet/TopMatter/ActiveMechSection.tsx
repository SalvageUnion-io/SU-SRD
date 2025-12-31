import { Box, HStack, VStack } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { Text } from '../../base/Text'
import { AddStatButton } from '../../shared/AddStatButton'
import { SheetSelect } from '../../shared/SheetSelect'
import { ActiveMechDisplay } from '../../shared/ActiveMechDisplay'
import { useCreateMechForPilot, useAssignMechToPilot } from '../../../hooks/useMechAssignment'
import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/database-generated.types'

type Mech = Tables<'mechs'>

interface ActiveMechSectionProps {
  pilotId: string
  isEditable: boolean
  isLocal: boolean
}

export function ActiveMechSection({ pilotId, isEditable, isLocal }: ActiveMechSectionProps) {
  const { createMechForPilot, isPending: isCreatingMech } = useCreateMechForPilot(pilotId)
  const { assignMechToPilot } = useAssignMechToPilot(pilotId)

  const { data: activeMech, isLoading } = useQuery({
    queryKey: ['active-mech', pilotId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mechs')
        .select('*')
        .eq('pilot_id', pilotId)
        .eq('active', true)
        .maybeSingle()

      if (error) throw error
      return (data as Mech | null) ?? null
    },
    enabled: !!pilotId && !isLocal,
  })

  // Get only inactive mechs belonging to this pilot (for assignment dropdown)
  const { data: inactiveMechs = [], isLoading: mechsLoading } = useQuery({
    queryKey: ['pilot-inactive-mechs', pilotId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mechs')
        .select('id, pattern, pilot_id, active, user_id')
        .eq('pilot_id', pilotId)
        .eq('active', false)
        .order('pattern', { ascending: true })

      if (error) throw error
      return (data || []) as Pick<Mech, 'id' | 'pattern' | 'pilot_id' | 'active' | 'user_id'>[]
    },
    enabled: !!pilotId && !isLocal,
  })

  if (isLoading || mechsLoading) {
    return (
      <Box w="full" p={4} borderWidth="3px" borderColor="su.green" borderRadius="md" bg="su.grey">
        <Text>Loading active mech...</Text>
      </Box>
    )
  }

  if (!activeMech) {
    return (
      <Box w="full" p={4} borderWidth="3px" borderColor="su.grey" borderRadius="md" bg="su.grey">
        <VStack gap={4}>
          <Text variant="pseudoheader" textAlign="center">
            No active mech
          </Text>
          {!isLocal && isEditable && (
            <HStack gap={4} justify="center">
              <AddStatButton
                label="Create"
                bottomLabel="Mech"
                onClick={createMechForPilot}
                disabled={isCreatingMech}
                ariaLabel="Create new mech for this pilot"
              />
              {inactiveMechs.length > 0 && (
                <Box w="300px">
                  <SheetSelect
                    label="Or Assign Existing"
                    value={null}
                    options={inactiveMechs.map((m) => ({
                      id: m.id,
                      name: m.pattern || `Mech ${m.id.slice(0, 8)}`,
                    }))}
                    onChange={(mechId) => {
                      if (mechId) {
                        assignMechToPilot(mechId)
                      }
                    }}
                    placeholder="Select a mech..."
                    loading={mechsLoading}
                  />
                </Box>
              )}
            </HStack>
          )}
        </VStack>
      </Box>
    )
  }

  return <ActiveMechDisplay mechId={activeMech.id} isEditable={isEditable} />
}
