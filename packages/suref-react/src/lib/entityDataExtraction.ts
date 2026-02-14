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
  isEntityData,
} from 'salvageunion-reference'
import type { DataValue } from '../types/common'

/**
 * Local type that extends SURefEnumSchemaName to include meta schemas like 'actions'
 */
type SURefMetaSchemaName = SURefEnumSchemaName | 'actions'

/**
 * Get activation currency based on schema name
 */
export function getActivationCurrency(
  schemaName: SURefMetaSchemaName | undefined,
  variable: boolean = false
): 'AP' | 'EP' | 'XP' {
  if (variable) return 'XP'
  if (schemaName === 'systems' || schemaName === 'modules') {
    return 'EP'
  }
  return 'AP'
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
export function formatActionType(actionType: string): string {
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
export function extractEntityDetails(
  data: SURefMetaEntity | SURefMetaAction,
  schemaName?: SURefEnumSchemaName,
  currency?: 'AP' | 'EP' | 'XP'
): DataValue[] {
  const details: DataValue[] = []

  // Add recommended tag first for systems/modules
  if (isEntityData(data) && getRecommended(data)) {
    details.push({
      label: 'Recommended',
      type: 'meta',
    })
  }

  // Extract activation cost
  const activationCost = extractActivationCostDetail(data, schemaName, currency || 'AP')
  if (activationCost) details.push(activationCost)

  // Extract action types
  details.push(...extractActionTypes(data, schemaName))

  // Extract range
  const ranges = extractRangeDetail(data)
  if (ranges) {
    ranges.forEach((r) => details.push(r))
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
      label: isHybrid ? 'Hybrid Class' : 'Base Class',
      type: 'meta',
    })

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

  return details
}
