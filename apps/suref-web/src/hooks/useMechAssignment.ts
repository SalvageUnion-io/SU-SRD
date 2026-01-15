import { useCallback } from 'react'
import { useCreateMech, useUpdateMech } from './mech'
import { useCurrentUser } from './useCurrentUser'
import { supabase } from '../lib/supabase'

/**
 * Hook to create a mech and assign it to a pilot
 * Sets all other mechs for this pilot to inactive before creating the new one
 *
 * @param pilotId - ID of the pilot to assign the mech to
 * @returns Object with createMechForPilot function and isPending state
 */
export function useCreateMechForPilot(pilotId: string) {
  const { userId } = useCurrentUser()
  const createMech = useCreateMech()
  const updateMech = useUpdateMech()

  const createMechForPilot = useCallback(async () => {
    if (!userId) return

    // Set all other mechs for this pilot to inactive first
    const { data: pilotMechs } = await supabase.from('mechs').select('id').eq('pilot_id', pilotId)

    if (pilotMechs) {
      for (const mech of pilotMechs) {
        await updateMech.mutateAsync({ id: mech.id, updates: { active: false } })
      }
    }

    // Create new mech and assign to pilot
    await createMech.mutateAsync({
      pattern: 'New Mech',
      current_damage: 0,
      current_heat: 0,
      current_ep: 0,
      user_id: userId,
      pilot_id: pilotId,
      active: true, // Set as active when created
    })
  }, [userId, pilotId, createMech, updateMech])

  return {
    createMechForPilot,
    isPending: createMech.isPending || updateMech.isPending,
  }
}

/**
 * Hook to assign an existing mech to a pilot
 * Sets all other mechs for this pilot to inactive before activating the selected one
 *
 * @param pilotId - ID of the pilot to assign the mech to
 * @param options - Optional configuration
 * @param options.setPilotId - Whether to also set the mech's pilot_id (default: false)
 * @returns Object with assignMechToPilot function and isPending state
 */
export function useAssignMechToPilot(pilotId: string, options?: { setPilotId?: boolean }) {
  const updateMech = useUpdateMech()
  const { setPilotId = false } = options || {}

  const assignMechToPilot = useCallback(
    async (mechId: string) => {
      // Set all mechs for this pilot to inactive first
      const { data: pilotMechs } = await supabase.from('mechs').select('id').eq('pilot_id', pilotId)

      if (pilotMechs) {
        for (const mech of pilotMechs) {
          await updateMech.mutateAsync({ id: mech.id, updates: { active: false } })
        }
      }

      // Set selected mech to active (and optionally set pilot_id)
      await updateMech.mutateAsync({
        id: mechId,
        updates: { active: true, ...(setPilotId ? { pilot_id: pilotId } : {}) },
      })
    },
    [pilotId, updateMech, setPilotId]
  )

  return {
    assignMechToPilot,
    isPending: updateMech.isPending,
  }
}
