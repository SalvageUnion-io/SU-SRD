import { useCallback } from 'react'
import { useCreatePilot } from './pilot'
import { useUpdateMech } from './mech'
import { useCurrentUser } from './useCurrentUser'

/**
 * Hook to create a pilot and assign it to a mech
 *
 * @param mechId - ID of the mech to assign the pilot to
 * @returns Object with createPilotForMech function and isPending state
 */
export function useCreatePilotForMech(mechId: string) {
  const { userId } = useCurrentUser()
  const createPilot = useCreatePilot()
  const updateMech = useUpdateMech()

  const createPilotForMech = useCallback(async () => {
    if (!userId) return

    const newPilot = await createPilot.mutateAsync({
      callsign: 'New Pilot',
      max_hp: 10,
      max_ap: 5,
      current_damage: 0,
      current_ap: 0,
      user_id: userId,
    })

    updateMech.mutate({ id: mechId, updates: { pilot_id: newPilot.id } })
    return newPilot.id
  }, [userId, mechId, createPilot, updateMech])

  return {
    createPilotForMech,
    isPending: createPilot.isPending || updateMech.isPending,
  }
}
