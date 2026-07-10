import type {
  SURefMetaEntity,
  SURefMetaAction,
  SURefEnumSchemaName,
  SURefObjectTrait,
} from 'salvageunion-reference'
import {
  SalvageUnionReference,
  getActivationCost,
  getActionType,
  getRange,
  getDamage,
  getTraits,
  getRecommended,
  getBlackMarket,
  isEntityData,
  resolveActivationCurrency,
} from 'salvageunion-reference'
import type { DataValue } from '../types/common'

/**
 * Re-export resolveActivationCurrency as getActivationCurrency for consumers
 */
export const getActivationCurrency = resolveActivationCurrency

/**
 * Label strings for the "meta" data values that the entity card relocates from
 * the data row into the header label callout ("Recommended", class type). These
 * literals must agree across three sites — the producer (this file), the callout
 * re-derivation (ReferenceEntityDisplayContent), and the data-row de-dup filter
 * (ReferenceEntitySubTitleContent) — so they are defined here once.
 */
export const CALLOUT_META_LABELS = {
  recommended: 'Recommended',
  baseClass: 'Base Class',
  hybridClass: 'Hybrid Class',
} as const

// Const tuple of the callout-owned labels — preserves the literal union (vs the
// old `Object.values`, which widened to `string[]` and discarded the literals).
const CALLOUT_META_LABEL_TUPLE = [
  CALLOUT_META_LABELS.recommended,
  CALLOUT_META_LABELS.baseClass,
  CALLOUT_META_LABELS.hybridClass,
] as const

/**
 * Set of labels the header label-callout owns; the data row filters these out.
 * Typed `readonly string[]` (not the literal tuple) so the data-row de-dup's
 * `.includes(v.label)` — where `v.label` is a plain `string` — still type-checks;
 * the literals live in CALLOUT_META_LABELS for consumers that need them.
 */
export const CALLOUT_META_LABEL_VALUES: readonly string[] = CALLOUT_META_LABEL_TUPLE

/** Class-type label ("Base Class" / "Hybrid Class"), derived from entity shape. */
export function getClassTypeLabel(data: SURefMetaEntity): string {
  return 'hybrid' in data && data.hybrid
    ? CALLOUT_META_LABELS.hybridClass
    : CALLOUT_META_LABELS.baseClass
}

/**
 * Type alias for action properties accessed directly on SURefMetaAction
 * Used for type-safe property access in the else branches
 */
type ActionWithProperties = {
  activationCost?: number | string
  actionType?: string
  range?: string[] | string
  damage?: {
    damageType: string
    amount: number | string
  }
  traits?: SURefObjectTrait[]
}

/**
 * Format action type for display by appending " Action" where needed
 * - "Turn" → "Turn Action"
 * - "Long" → "Long Action"
 * - "Short" → "Short Action"
 * - "Free" → "Free Action"
 * - "Passive" → "Passive" (no change)
 * - "Reaction" → "Reaction" (no change)
 * - Already includes "action" → unchanged
 */
function formatActionType(actionType: string): string {
  const actionTypeLower = actionType.toLowerCase()

  // Don't append "Action" if it already includes "action" or is Passive/Reaction
  if (
    actionTypeLower.includes('action') ||
    actionTypeLower === 'passive' ||
    actionTypeLower === 'reaction'
  ) {
    return actionType
  }

  return `${actionType} Action`
}

/**
 * Extract activation cost detail
 */
function extractActivationCostDetail(
  data: SURefMetaEntity | SURefMetaAction,
  schemaName: SURefEnumSchemaName | undefined,
  currency: 'AP' | 'EP' | 'XP'
): DataValue | null {
  let activationCost: number | string | undefined

  // For SURefMetaEntity, use utility function
  if (isEntityData(data)) {
    activationCost = getActivationCost(data)
  } else {
    // For SURefMetaAction, access directly
    activationCost = (data as ActionWithProperties).activationCost
  }

  if (activationCost === undefined) return null

  // Determine currency - use provided currency, or calculate from schema if not provided
  let finalCurrency = currency
  if (!finalCurrency && schemaName) {
    const variableCost = 'activationCurrency' in data && schemaName === 'abilities'
    finalCurrency = getActivationCurrency(schemaName, variableCost)
  }

  const isVariable = String(activationCost).toLowerCase() === 'variable'
  const costValue = isVariable ? `X ${finalCurrency}` : `${activationCost} ${finalCurrency}`

  return { label: costValue, type: 'cost' }
}

/**
 * Extract action type details
 */
function extractActionTypes(
  data: SURefMetaEntity | SURefMetaAction,
  schemaName: SURefEnumSchemaName | undefined
): DataValue[] {
  const details: DataValue[] = []
  let actionType: string | undefined

  // For SURefMetaEntity, use utility function
  if (isEntityData(data)) {
    actionType = getActionType(data)
    const isGeneric = schemaName === 'abilities' && 'level' in data && data.level === 'G'

    if (actionType) {
      details.push({
        label: formatActionType(actionType),
        value: isGeneric ? 'Pilot' : undefined,
        type: 'keyword',
      })
    }

    // Check for mechActionType in entities
    if ('mechActionType' in data && data.mechActionType) {
      const mechActionType = formatActionType(data.mechActionType)
      details.push({ label: mechActionType, value: 'Mech', type: 'keyword' })
    }
  } else {
    // For SURefMetaAction, access directly
    actionType = (data as ActionWithProperties).actionType
    if (actionType) {
      details.push({ label: formatActionType(actionType), type: 'keyword' })
    }
  }

  return details
}

/**
 * Extract range detail
 */
function extractRangeDetail(data: SURefMetaEntity | SURefMetaAction): DataValue[] | null {
  let range: string[] | string | undefined

  // For SURefMetaEntity, use utility function
  if (isEntityData(data)) {
    range = getRange(data)
  } else {
    // For SURefMetaAction, access directly
    range = (data as ActionWithProperties).range
  }

  if (!range) return null

  const ranges = Array.isArray(range) ? range : [range]
  return ranges.map((r) => ({ label: 'Range', value: r, type: 'range' }))
}

/**
 * Extract damage detail
 */
function extractDamageDetail(data: SURefMetaEntity | SURefMetaAction): DataValue | null {
  let damage:
    | {
        damageType: string
        amount: number | string
      }
    | undefined

  // For SURefMetaEntity, use utility function
  if (isEntityData(data)) {
    damage = getDamage(data)
  } else {
    // For SURefMetaAction, access directly
    damage = (data as ActionWithProperties).damage
  }

  if (!damage) return null
  return {
    label: 'Damage',
    value: `${damage.amount}${damage.damageType ?? 'HP'}`,
  }
}

/**
 * Extract trait details
 */
function extractTraitDetails(data: SURefMetaEntity | SURefMetaAction): DataValue[] {
  let traits: SURefObjectTrait[] | undefined

  // For SURefMetaEntity, use utility function
  if (isEntityData(data)) {
    traits = getTraits(data)
  } else {
    // For SURefMetaAction, access directly
    traits = (data as ActionWithProperties).traits
  }

  if (!traits || traits.length === 0) return []
  return traits.map((t: SURefObjectTrait) => {
    const label = t.type.charAt(0).toUpperCase() + t.type.slice(1)
    const value = 'amount' in t && t.amount !== undefined ? t.amount : undefined
    return { label, value, type: 'trait' }
  })
}

/**
 * Extract entity details for display (activation cost, action type, range, damage, traits)
 *
 * @param data - Entity or action data
 * @param schemaName - Optional schema name (used for currency determination and generic ability detection)
 * @param currency - Currency to use ('AP' | 'EP' | 'XP'). If not provided, will be determined from schema name
 * @returns Array of DataValue items
 */
export function extractReferenceEntityDetails(
  data: SURefMetaEntity | SURefMetaAction,
  schemaName?: SURefEnumSchemaName,
  currency?: 'AP' | 'EP' | 'XP'
): DataValue[] {
  const details: DataValue[] = []

  // Add recommended tag first for systems/modules
  if (isEntityData(data) && getRecommended(data)) {
    details.push({
      label: CALLOUT_META_LABELS.recommended,
      type: 'meta',
    })
  }

  // Add black market tag
  if (isEntityData(data) && getBlackMarket(data) === true) {
    details.push({ label: 'Black Market', type: 'meta' })
  }

  // Extract activation cost
  const activationCost = extractActivationCostDetail(data, schemaName, currency || 'AP')
  if (activationCost) details.push(activationCost)

  // Extract action types
  details.push(...extractActionTypes(data, schemaName))

  // Extract range
  const ranges = extractRangeDetail(data)
  if (ranges) {
    details.push(...ranges)
  }

  // Extract damage
  const damage = extractDamageDetail(data)
  if (damage) details.push(damage)

  // Extract traits
  details.push(...extractTraitDetails(data))

  // Add class type label and prerequisite trees for classes
  if (schemaName === 'classes') {
    const isHybrid = 'hybrid' in data && data.hybrid

    details.push({
      label: getClassTypeLabel(data),
      type: 'meta',
    })

    if ('maxAbilities' in data && typeof data.maxAbilities === 'number') {
      details.push({ label: 'Max Abilities', value: data.maxAbilities })
    }

    if (!isHybrid && 'advanceable' in data) {
      details.push({
        label: data.advanceable ? 'Advanceable' : 'Non-Advanceable',
        type: 'meta',
      })
    }

    if (isHybrid && 'advancedTree' in data) {
      const treeName = String(data.advancedTree)
      const req = SalvageUnionReference.AbilityTreeRequirements.find((r) => r.name === treeName)
      if (req && 'requirement' in req && Array.isArray(req.requirement)) {
        details.push({
          label: 'Requires',
          value: (req.requirement as string[]).join('||'),
          type: 'requirement',
        })
      }
    }
  }

  // Add squad damage type
  if (schemaName === 'squads' && 'damageType' in data) {
    const dt = String(data.damageType)
    details.push({ label: `${dt} Damage`, type: 'meta' })
  }

  // Add crawler tech level details: population range, upkeep, upgrade cost
  if (schemaName === 'crawler-tech-levels') {
    if (
      'populationMin' in data &&
      typeof data.populationMin === 'number' &&
      'populationMax' in data &&
      typeof data.populationMax === 'number'
    ) {
      const rangeText =
        data.populationMax === 0
          ? `${data.populationMin.toLocaleString()}+`
          : `${data.populationMin.toLocaleString()} - ${data.populationMax.toLocaleString()}`
      details.push({ label: 'Population', value: rangeText })
    }
    if ('upkeepCost' in data && typeof data.upkeepCost === 'number') {
      details.push({ label: 'Upkeep', value: `${data.upkeepCost} Scrap` })
    }
    if ('upgradeCost' in data && typeof data.upgradeCost === 'number') {
      details.push({ label: 'Upgrade', value: `${data.upgradeCost} Scrap` })
    }
  }

  return details
}
