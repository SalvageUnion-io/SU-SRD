import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCreatePilot, useUpdatePilot } from '../../hooks/pilot'
import { useCreateEntity } from '../../hooks/suentity'
import { getUser } from '../../lib/api'
import type { WizardState } from './utils'

export function useCreatePilotFromWizard() {
  const navigate = useNavigate()
  const createPilot = useCreatePilot()
  const updatePilot = useUpdatePilot()
  const createEntity = useCreateEntity()

  return useCallback(
    async (state: WizardState) => {
      try {
        const user = await getUser()
        if (!user) throw new Error('Not authenticated')

        // Create pilot with base stats
        const newPilot = await createPilot.mutateAsync({
          user_id: user.id,
          callsign: state.callsign.trim(),
          max_hp: 10,
          max_ap: 5,
          current_damage: 0,
          current_ap: 0,
          abilities: [],
          equipment: [],
          active: false,
          private: true,
        })

        // Create class entity
        if (state.selectedClassId) {
          await createEntity.mutateAsync({
            pilot_id: newPilot.id,
            schema_name: 'classes',
            schema_ref_id: state.selectedClassId,
          })
        }

        // Create ability entity
        if (state.selectedAbilityId) {
          await createEntity.mutateAsync({
            pilot_id: newPilot.id,
            schema_name: 'abilities',
            schema_ref_id: state.selectedAbilityId,
          })
        }

        // Create equipment entities
        for (const equipmentId of state.selectedEquipmentIds) {
          await createEntity.mutateAsync({
            pilot_id: newPilot.id,
            schema_name: 'equipment',
            schema_ref_id: equipmentId,
          })
        }

        // Update pilot with details
        await updatePilot.mutateAsync({
          id: newPilot.id,
          updates: {
            callsign: state.callsign.trim(),
            background: state.background.trim(),
            motto: state.motto.trim(),
            keepsake: state.keepsake.trim(),
            appearance: state.appearance.trim(),
            background_used: false,
            motto_used: false,
            keepsake_used: false,
          },
        })

        // Navigate to pilot sheet
        navigate({ to: `/dashboard/pilots/${newPilot.id}` })
      } catch (error) {
        console.error('Failed to create pilot from wizard:', error)
        throw error
      }
    },
    [createPilot, updatePilot, createEntity, navigate]
  )
}
