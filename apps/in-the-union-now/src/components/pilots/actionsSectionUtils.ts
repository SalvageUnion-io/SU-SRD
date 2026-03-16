import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { getComradeMaxEp } from '../../lib/pilotActionUtils'
import {
  getActionDisabledReason,
  getMechActionDisabledReason,
  getComradeActionDisabledReason,
} from '../../lib/actionUsesUtils'
import type { ActionDisplayData } from '../../lib/pilotActionUtils'
import type { PilotRow, MechRow } from '../../types/common'

type ComradeEpGetter = (entityId: string, maxEp: number) => number

export function computeDisabledReason(
  action: ActionDisplayData,
  pilot: PilotRow,
  mech: MechRow | null | undefined,
  pilotSourceTraits: Set<string>,
  mechSourceTraits: Set<string>,
  comradeEpGetter?: ComradeEpGetter
): string | null {
  if (action.condition === 'destroyed') return 'System Destroyed'
  if (action.costType === 'comrade-ep' && action.comradeEntity && comradeEpGetter) {
    const maxEp = getComradeMaxEp(action.comradeEntity)
    const currentEp = comradeEpGetter(action.comradeEntity.id, maxEp)
    return getComradeActionDisabledReason({
      activationCost: action.activationCost,
      comradeCurrentEp: currentEp,
      usesRemaining: action.usesRemaining,
      maxUses: action.maxUses,
    })
  }
  if (action.source === 'mech' && !action.isComrade) {
    if (!mech) return 'No mech'
    return getMechActionDisabledReason({
      action: { activationCost: action.activationCost },
      mech,
      usesRemaining: action.usesRemaining,
      maxUses: action.maxUses,
    })
  }
  const traits = action.costType === 'ep' ? mechSourceTraits : pilotSourceTraits
  return getActionDisabledReason({
    action: { activationCost: action.activationCost, requiredTraits: action.requiredTraits },
    pilot,
    pilotTraits: traits,
    usesRemaining: action.usesRemaining,
    maxUses: action.maxUses,
    costType: action.costType,
    mech,
  })
}

export function actionSortTier(
  action: ActionDisplayData,
  checkMatch: (a: ActionDisplayData) => boolean,
  hasActiveFilters: boolean,
  pilot: PilotRow,
  mech: MechRow | null | undefined,
  pilotSourceTraits: Set<string>,
  mechSourceTraits: Set<string>,
  comradeEpGetter?: ComradeEpGetter
): number {
  const matches = !hasActiveFilters || checkMatch(action)
  if (!matches) return 2
  const gameDisabled =
    (action.source === 'mech' && !action.isComrade && !pilot.is_boarded) ||
    computeDisabledReason(
      action,
      pilot,
      mech,
      pilotSourceTraits,
      mechSourceTraits,
      comradeEpGetter
    ) !== null
  return gameDisabled ? 1 : 0
}

export function sortActions(
  actions: ActionDisplayData[],
  checkMatch: (a: ActionDisplayData) => boolean,
  hasActiveFilters: boolean,
  pilot: PilotRow,
  mech: MechRow | null | undefined,
  pilotSourceTraits: Set<string>,
  mechSourceTraits: Set<string>,
  comradeEpGetter?: ComradeEpGetter
): ActionDisplayData[] {
  return [...actions].sort((a, b) => {
    const aTier = actionSortTier(
      a,
      checkMatch,
      hasActiveFilters,
      pilot,
      mech,
      pilotSourceTraits,
      mechSourceTraits,
      comradeEpGetter
    )
    const bTier = actionSortTier(
      b,
      checkMatch,
      hasActiveFilters,
      pilot,
      mech,
      pilotSourceTraits,
      mechSourceTraits,
      comradeEpGetter
    )
    if (aTier !== bTier) return aTier - bTier
    return a.name.localeCompare(b.name)
  })
}

export function findTraitEntity(
  traitName: string
): { id: string; schemaName: SURefEnumSchemaName } | null {
  const entity = SalvageUnionReference.findIn(
    'traits',
    (t) => t.name.toLowerCase() === traitName.toLowerCase()
  )
  return entity ? { id: entity.id, schemaName: 'traits' as SURefEnumSchemaName } : null
}
