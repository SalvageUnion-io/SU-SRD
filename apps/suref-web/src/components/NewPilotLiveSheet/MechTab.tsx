import { Box, VStack, HStack } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { Text } from '../base/Text'
import { Card } from '../shared/Card'
import { AddStatButton } from '../shared/AddStatButton'
import { SheetSelect } from '../shared/SheetSelect'
import { useCreateMechForPilot, useAssignMechToPilot } from '../../hooks/useMechAssignment'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../types/database-generated.types'
import MechLiveSheet from '../MechLiveSheet'

type Mech = Tables<'mechs'>

interface MechTabProps {
  pilotId: string
  isLocal: boolean
  isEditable: boolean
}

export function MechTab({ pilotId, isLocal, isEditable }: MechTabProps) {
  const { createMechForPilot, isPending: isCreatingMech } = useCreateMechForPilot(pilotId)
  const { assignMechToPilot } = useAssignMechToPilot(pilotId, {
    setPilotId: true,
  })

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

  // Get all mechs available to the user (for assignment dropdown)
  const { data: allMechs = [], isLoading: mechsLoading } = useQuery({
    queryKey: ['available-mechs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mechs')
        .select('id, pattern, pilot_id, active, user_id')
        .order('pattern', { ascending: true })

      if (error) throw error
      return (data || []) as Pick<Mech, 'id' | 'pattern' | 'pilot_id' | 'active' | 'user_id'>[]
    },
    enabled: !isLocal,
  })

  if (isLocal) {
    return (
      <Box bg="su.lightBlue" p={8} borderRadius="md" borderWidth="2px" borderColor="black" mt={6}>
        <Text textAlign="center" color="brand.srd" fontWeight="bold">
          Mechs are not available for local pilots
        </Text>
      </Box>
    )
  }

  if (isLoading || mechsLoading) {
    return (
      <Box p={4} mt={6}>
        <Text>Loading mech...</Text>
      </Box>
    )
  }

  if (!activeMech) {
    // Show all mechs that can be assigned
    // This includes mechs from other pilots that can be reassigned
    const unassignedMechs = allMechs

    return (
      <VStack gap={6} align="stretch" mt={6}>
        <Card bg="su.grey">
          <VStack gap={4}>
            <Text variant="pseudoheader" textAlign="center">
              No active mech assigned to this pilot
            </Text>
            {isEditable && (
              <HStack gap={4} justify="center">
                <AddStatButton
                  label="Create"
                  bottomLabel="Mech"
                  onClick={createMechForPilot}
                  disabled={isCreatingMech}
                  ariaLabel="Create new mech for this pilot"
                />
                {unassignedMechs.length > 0 && (
                  <Box w="300px">
                    <SheetSelect
                      label="Or Assign Existing"
                      value={null}
                      options={unassignedMechs.map((m) => ({
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
        </Card>
      </VStack>
    )
  }

  return <MechLiveSheet id={activeMech.id} flat />
}
