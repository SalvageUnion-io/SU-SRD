/**
 * useApplyDamage — hook for the Take Damage flow.
 *
 * Applies SP damage to a mech and optionally HP damage to the pilot,
 * and optionally applies a condition change to a target entity ref.
 *
 * TODO: Replace sequential mutations with `apply_mech_damage` Supabase RPC
 * for true atomicity (ADR-007). The RPC migration needs to be written and
 * deployed before this can be swapped in. The signature:
 *   apply_mech_damage(
 *     p_mech_id uuid,
 *     p_pilot_id uuid | null,
 *     p_sp_damage integer,
 *     p_target_entity_ref_id uuid | null
 *   )
 */

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { nextCondition } from 'salvageunion-reference'
import { showSaveToast } from '../lib/toastUtils'
import { getErrorMessage } from '../lib/errors'
import { changeLogApi } from '../lib/api/changeLogApi'
import { useUpdateMech, useUpdateMechEntityRef } from './useMechs'
import { useUpdatePilot } from './usePilots'
import type { DamageCascade } from '../lib/damageUtils'
import type { EntityRefRow, MechRow, PilotRow } from '../types/common'

type ApplyDamageParams = {
  mech: MechRow
  pilot: PilotRow
  userId: string
  spDamage: number
  cascade: DamageCascade
  /** Only passed when SP reaches 0 and player has selected or randomized a target */
  targetRef?: EntityRefRow
  onSuccess?: () => void
}

type UseApplyDamageReturn = {
  applyDamage: (params: ApplyDamageParams) => void
  isPending: boolean
}

export function useApplyDamage(): UseApplyDamageReturn {
  const updateMech = useUpdateMech()
  const updatePilot = useUpdatePilot()
  const updateMechEntityRef = useUpdateMechEntityRef()

  const [isPending, setIsPending] = useState(false)

  const applyDamage = useCallback(
    ({ mech, pilot, userId, spDamage, cascade, targetRef, onSuccess }: ApplyDamageParams) => {
      setIsPending(true)

      const mechLabel = mech.pattern_name || 'Mech'
      const oldSp = mech.current_sp

      const handleConditionChange = () => {
        if (!targetRef) {
          setIsPending(false)
          showSaveToast(`${mechLabel} took ${spDamage} SP damage`)
          onSuccess?.()
          return
        }

        const oldCondition = targetRef.condition ?? 'intact'
        const newCondition = nextCondition(oldCondition as 'intact' | 'damaged' | 'destroyed')

        updateMechEntityRef.mutate(
          { refId: targetRef.id, input: { condition: newCondition }, mechId: mech.id },
          {
            onSuccess: () => {
              // Condition changes are reversible: false per ADR-004
              changeLogApi
                .log(userId, {
                  targetId: targetRef.id,
                  targetType: 'entity_ref',
                  action: 'update',
                  field: 'condition',
                  oldValue: oldCondition,
                  newValue: newCondition,
                  description: `${mechLabel} Critical Damage: item ${oldCondition} → ${newCondition}`,
                  reversible: false,
                })
                .catch(() => {})

              setIsPending(false)
              showSaveToast(`${mechLabel}: Critical Damage — item ${newCondition}`)
              onSuccess?.()
            },
            onError: (err) => {
              setIsPending(false)
              toast.error(getErrorMessage(err))
            },
          }
        )
      }

      const handleHpDamage = () => {
        if (cascade.hpDamage <= 0 || !pilot.is_boarded) {
          handleConditionChange()
          return
        }

        const oldHp = pilot.hp ?? 0
        const newHp = Math.max(0, oldHp - cascade.hpDamage)

        updatePilot.mutate(
          { pilotId: pilot.id, userId, input: { hp: newHp } },
          {
            onSuccess: () => {
              // HP damage is reversible: true per ADR-004
              changeLogApi
                .log(userId, {
                  targetId: pilot.id,
                  targetType: 'pilot',
                  action: 'update',
                  field: 'hp',
                  oldValue: oldHp,
                  newValue: newHp,
                  description: `${pilot.callsign} HP ${oldHp} → ${newHp} (${cascade.hpDamage} HP damage)`,
                  reversible: true,
                })
                .catch(() => {})

              handleConditionChange()
            },
            onError: (err) => {
              setIsPending(false)
              toast.error(getErrorMessage(err))
            },
          }
        )
      }

      // Step 1: Update mech SP
      updateMech.mutate(
        { mechId: mech.id, input: { current_sp: cascade.newSp } },
        {
          onSuccess: () => {
            // SP damage is reversible: true per ADR-004
            changeLogApi
              .log(userId, {
                targetId: mech.id,
                targetType: 'mech',
                action: 'update',
                field: 'current_sp',
                oldValue: oldSp,
                newValue: cascade.newSp,
                description: `${mechLabel} SP ${oldSp} → ${cascade.newSp} (${spDamage} damage)`,
                reversible: true,
              })
              .catch(() => {})

            // Step 2: Apply HP damage if boarded
            handleHpDamage()
          },
          onError: (err) => {
            setIsPending(false)
            toast.error(getErrorMessage(err))
          },
        }
      )
    },
    [updateMech, updatePilot, updateMechEntityRef]
  )

  return { applyDamage, isPending }
}
