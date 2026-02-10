import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCreateMech } from '../../hooks/mech'
import { useCreateEntity } from '../../hooks/suentity'
import { useCreateCargo } from '../../hooks/cargo'
import { getUser } from '../../lib/api'
import { SalvageUnionReference, getEnergyPoints } from 'salvageunion-reference'
import type { WizardState } from './utils'
import { calculateRemainingBudget } from './utils'

export function useCreateMechFromWizard() {
  const navigate = useNavigate()
  const createMech = useCreateMech()
  const createEntity = useCreateEntity()
  const createCargo = useCreateCargo()

  return useCallback(
    async (state: WizardState) => {
      try {
        const user = await getUser()
        if (!user) throw new Error('Not authenticated')

        if (!state.selectedChassisId) {
          throw new Error('Chassis must be selected')
        }

        const chassis = SalvageUnionReference.Chassis.find((c) => c.id === state.selectedChassisId)
        if (!chassis) {
          throw new Error('Selected chassis not found')
        }

        // Create mech with base stats
        const newMech = await createMech.mutateAsync({
          user_id: user.id,
          pattern: state.patternName.trim(),
          appearance: state.appearance.trim(),
          quirk: state.quirk.trim(),
          current_damage: 0,
          current_ep: getEnergyPoints(chassis) ?? 0,
          current_heat: 0,
          active: false,
          private: true,
        })

        // Create chassis entity
        await createEntity.mutateAsync({
          mech_id: newMech.id,
          schema_name: 'chassis',
          schema_ref_id: state.selectedChassisId,
        })

        // Create system entities
        for (const systemId of state.selectedSystemIds) {
          await createEntity.mutateAsync({
            mech_id: newMech.id,
            schema_name: 'systems',
            schema_ref_id: systemId,
            metadata: {
              damaged: false,
            },
          })
        }

        // Create module entities
        for (const moduleId of state.selectedModuleIds) {
          await createEntity.mutateAsync({
            mech_id: newMech.id,
            schema_name: 'modules',
            schema_ref_id: moduleId,
            metadata: {
              damaged: false,
            },
          })
        }

        // Add unspent scrap as cargo
        const remainingBudget = calculateRemainingBudget(state)
        if (remainingBudget > 0) {
          await createCargo.mutateAsync({
            mech_id: newMech.id,
            name: 'TL1 Scrap',
            amount: remainingBudget,
          })
        }

        // Navigate to mech live sheet
        navigate({ to: `/dashboard/mechs/${newMech.id}` })
      } catch (error) {
        console.error('Failed to create mech from wizard:', error)
        throw error
      }
    },
    [createMech, createEntity, createCargo, navigate]
  )
}
