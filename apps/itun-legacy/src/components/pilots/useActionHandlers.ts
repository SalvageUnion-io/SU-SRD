import { useCallback } from 'react'
import { toast } from 'sonner'
import { getComradeMaxEp } from '../../lib/pilotActionUtils'
import type { ActionDisplayData } from '../../lib/pilotActionUtils'
import { decrementActionUses, refillActionUses } from '../../lib/actionUsesUtils'
import type { UseActionResult } from '../../hooks/useActivateAction'
import type {
  EntityRefRow,
  EntityRefUpdate,
  MechRow,
  MechUpdate,
  PilotRow,
  PilotUpdate,
} from '../../types/common'

export type ActivateActionFn = (
  action: ActionDisplayData,
  variableHeatOverride?: number
) => Promise<UseActionResult & { needsVariableHeatPrompt?: boolean }>

type UseActionHandlersInput = {
  pilot: PilotRow
  pilotRefs: EntityRefRow[]
  mech?: MechRow | null
  mechRefs?: EntityRefRow[]
  comradeNameMap: Map<string, string>
  getComradeCurrentEp: (entityId: string, maxEp: number) => number
  updateComradeEp: (entityId: string, nextEp: number, displayName: string) => void
  onUpdatePilot: (input: Partial<PilotUpdate>) => void
  onUpdateEntityRef: (refId: string, input: EntityRefUpdate) => void
  onUpdateMech?: (input: Partial<MechUpdate>) => void
  onUpdateMechEntityRef?: (refId: string, input: EntityRefUpdate) => void
  onUseAction?: ActivateActionFn
  onHeatCheckTriggered: (newHeat: number) => void
}

type UseActionHandlersResult = {
  handleUsePilotAction: (action: ActionDisplayData) => void
  handleUseMechAction: (action: ActionDisplayData) => void
  handleUseComradeAction: (action: ActionDisplayData) => void
  handleRefillAction: (action: ActionDisplayData) => void
}

/**
 * Collects the four action-invocation handlers (pilot / mech / comrade / refill)
 * used by the actions list. When `onUseAction` is provided, pilot and mech
 * handlers delegate to it (heat-aware); otherwise they fall back to direct
 * AP/EP and uses-counter updates.
 */
export function useActionHandlers(input: UseActionHandlersInput): UseActionHandlersResult {
  const {
    pilot,
    pilotRefs,
    mech,
    mechRefs,
    comradeNameMap,
    getComradeCurrentEp,
    updateComradeEp,
    onUpdatePilot,
    onUpdateEntityRef,
    onUpdateMech,
    onUpdateMechEntityRef,
    onUseAction,
    onHeatCheckTriggered,
  } = input

  const handleActionResult = useCallback(
    (result: { heatCheckTriggered: boolean; newHeat: number }) => {
      if (result.heatCheckTriggered) {
        onHeatCheckTriggered(result.newHeat)
      }
    },
    [onHeatCheckTriggered]
  )

  const handleUsePilotAction = useCallback(
    (action: ActionDisplayData) => {
      if (onUseAction) {
        onUseAction(action)
          .then((result) => {
            if (result.success) handleActionResult(result)
          })
          .catch(() => {})
        return
      }
      toast(`${pilot.callsign} used ${action.name}`, {
        style: { borderColor: action.borderColor, borderWidth: '2px' },
      })
      if (action.activationCost !== null) {
        if (action.costType === 'ep' && mech && onUpdateMech) {
          onUpdateMech({ current_ep: mech.current_ep - action.activationCost })
        } else {
          onUpdatePilot({ ap: pilot.ap - action.activationCost })
        }
      }
      if (action.destroyOnUse && action.entityRefId) {
        onUpdateEntityRef(action.entityRefId, { condition: 'destroyed' })
      } else if (action.maxUses !== null && action.entityRefId) {
        const ref = pilotRefs.find((r) => r.id === action.entityRefId)
        if (ref) {
          const newMetadata = decrementActionUses(action.actionName, action.maxUses, ref.metadata)
          onUpdateEntityRef(action.entityRefId, { metadata: newMetadata })
        }
      }
    },
    [
      pilot,
      pilotRefs,
      mech,
      onUseAction,
      onUpdateMech,
      onUpdatePilot,
      onUpdateEntityRef,
      handleActionResult,
    ]
  )

  const handleUseMechAction = useCallback(
    (action: ActionDisplayData) => {
      if (onUseAction) {
        onUseAction(action)
          .then((result) => {
            if (result.success) handleActionResult(result)
          })
          .catch(() => {})
        return
      }
      if (!mech || !onUpdateMech) return
      toast(`${mech.pattern_name ?? 'Mech'} used ${action.name}`, {
        style: { borderColor: action.borderColor, borderWidth: '2px' },
      })
      if (action.activationCost !== null) {
        onUpdateMech({ current_ep: mech.current_ep - action.activationCost })
      }
      if (action.destroyOnUse && action.entityRefId) {
        if (onUpdateMechEntityRef) {
          onUpdateMechEntityRef(action.entityRefId, { condition: 'destroyed' })
        }
      } else if (action.maxUses !== null && action.entityRefId) {
        if (!mechRefs || !onUpdateMechEntityRef) return
        const ref = mechRefs.find((r) => r.id === action.entityRefId)
        if (ref) {
          const newMetadata = decrementActionUses(action.actionName, action.maxUses, ref.metadata)
          onUpdateMechEntityRef(action.entityRefId, { metadata: newMetadata })
        }
      }
    },
    [mech, mechRefs, onUseAction, onUpdateMech, onUpdateMechEntityRef, handleActionResult]
  )

  const handleUseComradeAction = useCallback(
    (action: ActionDisplayData) => {
      if (!action.comradeEntity) return
      const comrade = action.comradeEntity
      const maxEp = getComradeMaxEp(comrade)
      const currentEp = getComradeCurrentEp(comrade.id, maxEp)
      const comradeDisplayName = comradeNameMap.get(comrade.id) || comrade.name
      toast(`${comradeDisplayName} used ${action.name}`, {
        style: { borderColor: action.borderColor, borderWidth: '2px' },
      })
      if (action.activationCost !== null) {
        updateComradeEp(
          comrade.id,
          Math.max(0, currentEp - action.activationCost),
          comradeDisplayName
        )
      }
      if (action.destroyOnUse && action.entityRefId) {
        if (mechRefs && onUpdateMechEntityRef) {
          onUpdateMechEntityRef(action.entityRefId, { condition: 'destroyed' })
        }
      } else if (action.maxUses !== null && action.entityRefId) {
        if (mechRefs && onUpdateMechEntityRef) {
          const ref = mechRefs.find((r) => r.id === action.entityRefId)
          if (ref) {
            const newMetadata = decrementActionUses(action.actionName, action.maxUses, ref.metadata)
            onUpdateMechEntityRef(action.entityRefId, { metadata: newMetadata })
          }
        }
      }
    },
    [comradeNameMap, getComradeCurrentEp, mechRefs, onUpdateMechEntityRef, updateComradeEp]
  )

  const handleRefillAction = useCallback(
    (action: ActionDisplayData) => {
      if (action.maxUses === null || !action.entityRefId) return

      if (action.source === 'mech') {
        if (!mechRefs || !onUpdateMechEntityRef) return
        const ref = mechRefs.find((r) => r.id === action.entityRefId)
        if (!ref) return
        const newMetadata = refillActionUses(action.actionName, action.maxUses, ref.metadata)
        onUpdateMechEntityRef(action.entityRefId, { metadata: newMetadata })
      } else {
        const ref = pilotRefs.find((r) => r.id === action.entityRefId)
        if (!ref) return
        const newMetadata = refillActionUses(action.actionName, action.maxUses, ref.metadata)
        onUpdateEntityRef(action.entityRefId, { metadata: newMetadata })
      }
      toast(`Refilled ${action.name}`, {
        style: { borderColor: action.borderColor, borderWidth: '2px' },
      })
    },
    [mechRefs, pilotRefs, onUpdateEntityRef, onUpdateMechEntityRef]
  )

  return {
    handleUsePilotAction,
    handleUseMechAction,
    handleUseComradeAction,
    handleRefillAction,
  }
}
