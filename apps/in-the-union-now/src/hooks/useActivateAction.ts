import { useCallback } from 'react'
import { toast } from 'sonner'
import {
  getHeatGenerated,
  applyHeat,
  canActivateAction,
  shouldTriggerHeatCheck,
} from 'salvageunion-reference'
import { showSaveToast } from '../lib/toastUtils'
import { getErrorMessage } from '../lib/errors'
import { changeLogApi } from '../lib/api/changeLogApi'
import { decrementActionUses } from '../lib/actionUsesUtils'
import { useUpdateMech, useUpdateMechEntityRef } from './useMechs'
import { useUpdatePilot } from './usePilots'
import type { ActionDisplayData } from '../lib/pilotActionUtils'
import type { MechRow, PilotRow, EntityRefRow } from '../types/common'

// ---------------------------------------------------------------------------
// Pure types
// ---------------------------------------------------------------------------

export type UseActionResult = {
  success: boolean
  heatCheckTriggered: boolean
  newHeat: number
  error?: string
}

/** Minimal entity shape needed for heat trait inspection. */
type EntityWithTraits = {
  traits?: Array<{ type: string; amount?: number | string }>
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Exported pure helpers (testable without React context)
// ---------------------------------------------------------------------------

/**
 * Read the heat cost from an entity's traits.
 * Delegates to combatUtils.getHeatGenerated.
 */
export function resolveHeatCost(entity: EntityWithTraits): number | 'variable' {
  return getHeatGenerated(entity)
}

/**
 * Validate whether a mech can activate an action given current heat and EP.
 * Returns a human-readable reason string if blocked, or null if allowed.
 * Checks heat cap first, then EP.
 */
export function canActivateMechAction(
  mech: MechRow,
  epCost: number,
  heatCost: number
): string | null {
  if (mech.active === false) {
    return 'Mech is shut down'
  }
  if (!canActivateAction(mech.current_heat, heatCost, mech.heat_capacity)) {
    return `Action blocked: heat cost would exceed heat cap (${mech.current_heat} + ${heatCost} > ${mech.heat_capacity})`
  }
  if (epCost > 0 && mech.current_ep < epCost) {
    return 'Not enough EP'
  }
  return null
}

type BuildUseActionResultOptions = {
  mech?: MechRow
  pilot?: PilotRow
  action: ActionDisplayData
  heatCost: number
}

type UseActionComputedResult = {
  success: boolean
  newHeat: number
  newEp: number
  newAp: number
  heatCheckTriggered: boolean
}

/**
 * Pure computation of the resulting state after using an action.
 * Does not perform any mutations — only computes new values.
 */
export function buildUseActionResult({
  mech,
  pilot,
  action,
  heatCost,
}: BuildUseActionResultOptions): UseActionComputedResult {
  const epCost =
    action.costType === 'ep' && action.activationCost !== null ? action.activationCost : 0
  const apCost =
    action.costType === 'ap' && action.activationCost !== null ? action.activationCost : 0

  const currentHeat = mech?.current_heat ?? 0
  const heatCap = mech?.heat_capacity ?? 0
  const newHeat = heatCost > 0 ? applyHeat(currentHeat, heatCost, heatCap) : currentHeat

  const newEp = mech ? mech.current_ep - epCost : 0
  const newAp = pilot ? pilot.ap - apCost : 0

  return {
    success: true,
    newHeat,
    newEp,
    newAp,
    heatCheckTriggered: shouldTriggerHeatCheck(currentHeat, heatCost, heatCap),
  }
}

// ---------------------------------------------------------------------------
// Hook options type
// ---------------------------------------------------------------------------

type UseActivateActionOptions = {
  mech: MechRow | null | undefined
  pilot: PilotRow | null | undefined
  mechRefs: EntityRefRow[]
  pilotRefs: EntityRefRow[]
  userId: string | undefined
  mechLabel: string
}

// ---------------------------------------------------------------------------
// useActivateAction hook
// ---------------------------------------------------------------------------

/**
 * Focused hook for action execution with heat management.
 *
 * Execution sequence (per ADR-007 sequential mutations):
 * 1. Validate heat cap and resources
 * 2. Spend EP (mech) or AP (pilot)
 * 3. Apply heat (mech only)
 * 4. Decrement limited uses (if applicable)
 * 5. Log changes (fire-and-forget)
 * 6. Return heat check flag
 *
 * Variable heat actions return { needsVariableHeatPrompt: true } — the UI
 * prompt is handled by Story 2.
 */
export function useActivateAction({
  mech,
  pilot,
  mechRefs,
  pilotRefs,
  userId,
  mechLabel,
}: UseActivateActionOptions) {
  const updateMech = useUpdateMech()
  const updatePilot = useUpdatePilot()
  const updateMechEntityRef = useUpdateMechEntityRef()

  const handleUseAction = useCallback(
    (
      action: ActionDisplayData,
      variableHeatOverride?: number
    ): Promise<UseActionResult & { needsVariableHeatPrompt?: boolean }> => {
      return new Promise((resolve) => {
        if (!userId) {
          resolve({
            success: false,
            heatCheckTriggered: false,
            newHeat: 0,
            error: 'Not authenticated',
          })
          return
        }

        const isMechAction = action.source === 'mech' && !action.isComrade
        const sourceEntity = action.sourceEntity as EntityWithTraits

        // --- Step 1: Resolve heat cost ---
        let heatCost: number
        if (isMechAction) {
          const rawHeat = resolveHeatCost(sourceEntity)
          if (rawHeat === 'variable') {
            if (variableHeatOverride === undefined) {
              // Signal caller that we need a variable heat prompt (Story 2)
              resolve({
                success: false,
                heatCheckTriggered: false,
                newHeat: 0,
                needsVariableHeatPrompt: true,
              })
              return
            }
            heatCost = variableHeatOverride
          } else {
            heatCost = rawHeat
          }
        } else {
          heatCost = 0
        }

        // --- Step 2: Validate resources ---
        if (isMechAction && mech) {
          const epCost = action.activationCost ?? 0
          const blockReason = canActivateMechAction(mech, epCost, heatCost)
          if (blockReason) {
            toast.error(blockReason)
            resolve({
              success: false,
              heatCheckTriggered: false,
              newHeat: mech.current_heat,
              error: blockReason,
            })
            return
          }
        }

        if (action.costType === 'ap' && pilot && action.activationCost !== null) {
          if (pilot.ap < action.activationCost) {
            const reason = 'Not enough AP'
            toast.error(reason)
            resolve({
              success: false,
              heatCheckTriggered: false,
              newHeat: mech?.current_heat ?? 0,
              error: reason,
            })
            return
          }
        }

        // --- Compute result values ---
        const computed = buildUseActionResult({
          mech: mech ?? undefined,
          pilot: pilot ?? undefined,
          action,
          heatCost,
        })

        // Show action-used toast
        const actorLabel = isMechAction
          ? (mech?.pattern_name ?? mechLabel)
          : (pilot?.callsign ?? 'Pilot')
        toast(`${actorLabel} used ${action.name}`, {
          style: { borderColor: action.borderColor, borderWidth: '2px' },
        })

        let pendingMutations = 0
        let completedMutations = 0
        let mutationError: string | undefined

        function onMutationDone(err?: string) {
          if (err) mutationError = err
          completedMutations++
          if (completedMutations >= pendingMutations) {
            if (mutationError) {
              resolve({
                success: false,
                heatCheckTriggered: false,
                newHeat: mech?.current_heat ?? 0,
                error: mutationError,
              })
            } else {
              showSaveToast(`${actorLabel} used ${action.name}`)
              resolve({
                success: true,
                heatCheckTriggered: computed.heatCheckTriggered,
                newHeat: computed.newHeat,
              })
            }
          }
        }

        // --- Step 3: Spend EP (mech) ---
        if (isMechAction && mech && action.activationCost !== null && action.costType === 'ep') {
          pendingMutations++
          updateMech.mutate(
            { mechId: mech.id, input: { current_ep: computed.newEp } },
            {
              onSuccess: () => {
                changeLogApi
                  .log(userId, {
                    targetId: mech.id,
                    targetType: 'mech',
                    action: 'update',
                    field: 'current_ep',
                    oldValue: mech.current_ep,
                    newValue: computed.newEp,
                    description: `${actorLabel} used ${action.name}: EP ${mech.current_ep} → ${computed.newEp}`,
                    reversible: true,
                  })
                  .catch(() => {})
                onMutationDone()
              },
              onError: (err) => {
                toast.error(getErrorMessage(err))
                onMutationDone(getErrorMessage(err))
              },
            }
          )
        }

        // --- Spend AP (pilot) ---
        if (!isMechAction && action.costType === 'ap' && pilot && action.activationCost !== null) {
          pendingMutations++
          updatePilot.mutate(
            { pilotId: pilot.id, input: { ap: computed.newAp }, userId },
            {
              onSuccess: () => {
                changeLogApi
                  .log(userId, {
                    targetId: pilot.id,
                    targetType: 'pilot',
                    action: 'update',
                    field: 'ap',
                    oldValue: pilot.ap,
                    newValue: computed.newAp,
                    description: `${pilot.callsign} used ${action.name}: AP ${pilot.ap} → ${computed.newAp}`,
                    reversible: true,
                  })
                  .catch(() => {})
                onMutationDone()
              },
              onError: (err) => {
                toast.error(getErrorMessage(err))
                onMutationDone(getErrorMessage(err))
              },
            }
          )
        }

        // --- Step 4: Apply heat (mech only) ---
        if (isMechAction && mech && heatCost > 0) {
          pendingMutations++
          updateMech.mutate(
            { mechId: mech.id, input: { current_heat: computed.newHeat } },
            {
              onSuccess: () => {
                changeLogApi
                  .log(userId, {
                    targetId: mech.id,
                    targetType: 'mech',
                    action: 'update',
                    field: 'current_heat',
                    oldValue: mech.current_heat,
                    newValue: computed.newHeat,
                    description: `${actorLabel} used ${action.name}: Heat ${mech.current_heat} → ${computed.newHeat}`,
                    reversible: true,
                  })
                  .catch(() => {})
                onMutationDone()
              },
              onError: (err) => {
                toast.error(getErrorMessage(err))
                onMutationDone(getErrorMessage(err))
              },
            }
          )
        }

        // --- Step 5: Decrement limited uses ---
        if (action.maxUses !== null && action.entityRefId) {
          const isMechRef = action.source === 'mech'
          const refs = isMechRef ? mechRefs : pilotRefs
          const ref = refs.find((r) => r.id === action.entityRefId)
          if (ref && isMechRef && mech) {
            const newMetadata = decrementActionUses(action.actionName, action.maxUses, ref.metadata)
            pendingMutations++
            updateMechEntityRef.mutate(
              { refId: action.entityRefId, input: { metadata: newMetadata }, mechId: mech.id },
              {
                onSuccess: () => {
                  changeLogApi
                    .log(userId, {
                      targetId: action.entityRefId!,
                      targetType: 'entity_ref',
                      action: 'update',
                      field: 'metadata',
                      description: `${actorLabel} used ${action.name}: uses decremented`,
                      reversible: true,
                    })
                    .catch(() => {})
                  onMutationDone()
                },
                onError: (err) => {
                  toast.error(getErrorMessage(err))
                  onMutationDone(getErrorMessage(err))
                },
              }
            )
          }
        }

        // If no mutations were queued (e.g., free action with no heat, no uses), resolve immediately
        if (pendingMutations === 0) {
          showSaveToast(`${actorLabel} used ${action.name}`)
          resolve({
            success: true,
            heatCheckTriggered: computed.heatCheckTriggered,
            newHeat: computed.newHeat,
          })
        }
      })
    },
    [
      mech,
      pilot,
      mechRefs,
      pilotRefs,
      userId,
      mechLabel,
      updateMech,
      updatePilot,
      updateMechEntityRef,
    ]
  )

  return { handleUseAction }
}
