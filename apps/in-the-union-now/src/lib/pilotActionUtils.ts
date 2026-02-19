import type {
  SURefMetaAction,
  SURefEnumSchemaName,
  SURefEntity,
  SURefChassis,
  SURefObjectContentBlock,
} from 'salvageunion-reference'
import {
  SalvageUnionReference,
  getActionType,
  getChassisAbilities,
  extractVisibleActions,
  getRequiredTraits,
} from 'salvageunion-reference'
import { extractReferenceEntityDetails, getActivationCurrency } from 'suref-react'
import type { DataValue } from 'suref-react'
import type { EntityRefRow } from '../types/common'
import type { Json } from '../types/database-generated.types'
import { getActionActivationCost, getActionMaxUses, getRemainingUses } from './actionUsesUtils'
import type { ComradeEntry } from './comradeUtils'

export type ActionSource = 'pilot' | 'mech' | 'general'
export type ActionCostType = 'ap' | 'ep' | 'variable' | 'none'

export type ActionDisplayData = {
  key: string
  name: string
  actionName: string
  sourceEntity: SURefEntity
  sourceSchemaName: SURefEnumSchemaName
  borderColor: string
  dataValues: DataValue[]
  content?: SURefObjectContentBlock[]
  entityRefId: string | null
  activationCost: number | null
  maxUses: number | null
  usesRemaining: number | null
  requiredTraits: string[]
  actionType: string
  source: ActionSource
  costType: ActionCostType
  hasDamage: boolean
}

// ---------------------------------------------------------------------------
// Color maps
// ---------------------------------------------------------------------------

/** Uniform color = cost type (border, header, footer) */
const COST_BORDER_COLORS: Record<ActionCostType, string> = {
  ap: 'rgb(239, 137, 79)', // su-orange
  ep: 'rgb(122, 151, 138)', // su-green
  variable: 'rgb(239, 137, 79)', // fallback for non-gradient contexts (toasts)
  none: 'rgb(206, 88, 152)', // su-pink
}

/**
 * Derive the cost type for an action based on its currency and raw activation cost.
 * Variable-currency actions are resolved upstream; this only handles fixed currencies.
 */
function deriveCostType(action: SURefMetaAction, currency: 'AP' | 'EP'): ActionCostType {
  if ('activationCost' in action) {
    const cost = action.activationCost
    if (typeof cost === 'string') return 'variable' // "X" amount (player chooses)
    if (typeof cost === 'number' && cost > 0) return currency === 'EP' ? 'ep' : 'ap'
  }
  return 'none'
}

/**
 * Extract content blocks from an action or entity.
 */
function getContentBlocks(
  data: SURefMetaAction | SURefEntity
): SURefObjectContentBlock[] | undefined {
  if ('content' in data && Array.isArray(data.content) && data.content.length > 0) {
    const blocks = (data.content as SURefObjectContentBlock[]).filter((b) => b.type !== 'flavor')
    return blocks.length > 0 ? blocks : undefined
  }
  return undefined
}

/**
 * Derive the activation currency for a resolved action.
 * Checks the action's own activationCurrency first, then falls back to the source entity's.
 */
function deriveActionCurrency(
  action: SURefMetaAction,
  sourceEntity: SURefEntity,
  sourceSchemaName: SURefEnumSchemaName
): 'AP' | 'EP' | 'XP' {
  const actionHasVariable =
    'activationCurrency' in action && action.activationCurrency === 'Variable'
  if (actionHasVariable) return getActivationCurrency(sourceSchemaName, true)

  const entityHasVariable =
    'activationCurrency' in sourceEntity && sourceEntity.activationCurrency === 'Variable'
  if (entityHasVariable) return getActivationCurrency(sourceSchemaName, true)

  return getActivationCurrency(sourceSchemaName, false)
}

/**
 * Build ActionDisplayData items from an entity's resolved actions.
 * Resolves the entity's `actions` array via extractVisibleActions to get
 * full action objects from actions.json, then builds display data from each.
 *
 * When `isBoarded` is true, variable-currency actions resolve to EP (cost from mech).
 * When false, they resolve to AP (cost from pilot).
 */
function buildActionItems(
  entity: SURefEntity,
  schemaName: SURefEnumSchemaName,
  keyPrefix: string,
  entityRefId: string | null,
  refMetadata: Json | null,
  source: ActionSource,
  isBoarded: boolean
): ActionDisplayData[] {
  const resolved = extractVisibleActions(entity)
  if (!resolved) return []

  const usableActions = resolved.filter(
    (a) => ('actionType' in a && a.actionType) || ('damage' in a && a.damage != null)
  )

  return usableActions.map((action) => {
    const rawCurrency = deriveActionCurrency(action, entity, schemaName)
    const isVariableCurrency = rawCurrency === 'XP'

    // Resolve variable currency based on boarded state
    const displayCurrency: 'AP' | 'EP' = isVariableCurrency
      ? isBoarded
        ? 'EP'
        : 'AP'
      : (rawCurrency as 'AP' | 'EP')

    // Variable-currency actions always resolve to ap/ep; non-variable use original logic
    const costType = isVariableCurrency
      ? isBoarded
        ? 'ep'
        : 'ap'
      : deriveCostType(action, displayCurrency)

    const dataValues = extractReferenceEntityDetails(
      action,
      'actions' as SURefEnumSchemaName,
      displayCurrency
    )

    // For variable currency with no numeric cost, default to 1
    let activationCost = getActionActivationCost(action)
    if (isVariableCurrency && activationCost === null) {
      activationCost = 1
      // Add cost DataValue if extractReferenceEntityDetails didn't produce one
      const hasCostDv = dataValues.some((dv) => dv.type === 'cost')
      if (!hasCostDv) {
        dataValues.unshift({ label: `1 ${displayCurrency}`, type: 'cost' })
      }
    }

    const maxUses = getActionMaxUses(action)
    const usesRemaining = entityRefId ? getRemainingUses(action.name, refMetadata) : null
    const requiredTraits = getRequiredTraits(action)

    // Transform Uses DataValue to show "N/M" when tracking
    if (maxUses !== null && entityRefId) {
      const effective = usesRemaining ?? maxUses
      const usesIdx = dataValues.findIndex(
        (dv) =>
          dv.label === 'Uses' || (dv.type === 'trait' && String(dv.label).toLowerCase() === 'uses')
      )
      const existing = usesIdx !== -1 ? dataValues[usesIdx] : undefined
      if (existing) {
        dataValues[usesIdx] = {
          label: existing.label,
          type: existing.type,
          value: `${effective}/${maxUses}`,
        }
      }
    }

    return {
      key: `${keyPrefix}-${action.name}`,
      name: action.displayName || action.name,
      actionName: action.name,
      sourceEntity: entity,
      sourceSchemaName: schemaName,
      borderColor: COST_BORDER_COLORS[costType],
      dataValues,
      content: getContentBlocks(action),
      entityRefId,
      activationCost,
      maxUses,
      usesRemaining,
      requiredTraits,
      actionType:
        'actionType' in action && typeof action.actionType === 'string' ? action.actionType : '',
      source,
      costType,
      hasDamage: 'damage' in action && action.damage != null,
    }
  })
}

/**
 * Extract mech actions from entity refs (systems + modules only).
 * These actions cost EP instead of AP — currency is derived automatically
 * by buildActionItems → deriveActionCurrency.
 */
export function extractMechActions(refs: EntityRefRow[], isBoarded: boolean): ActionDisplayData[] {
  const actions: ActionDisplayData[] = []

  for (const ref of refs) {
    const schemaName = ref.schema_name as SURefEnumSchemaName
    if (schemaName !== 'systems' && schemaName !== 'modules') continue

    const entity = SalvageUnionReference.get(schemaName, ref.schema_ref_id) as
      | SURefEntity
      | undefined
    if (!entity) continue

    actions.push(
      ...buildActionItems(
        entity,
        schemaName,
        `mech-${schemaName}-${ref.schema_ref_id}`,
        ref.id,
        ref.metadata,
        'mech',
        isBoarded
      )
    )
  }

  return actions
}

/**
 * Extract pilot actions from entity refs.
 * - Abilities -> resolve all visible actions with explicit actionType or damage
 * - Abilities with no extractable actions -> passive card only if explicitly Passive
 * - Equipment -> resolve actions from actions.json -> ActionDisplayData[]
 */
export function extractPilotActions(refs: EntityRefRow[], isBoarded: boolean): ActionDisplayData[] {
  const actions: ActionDisplayData[] = []

  for (const ref of refs) {
    const schemaName = ref.schema_name as SURefEnumSchemaName
    const entity = SalvageUnionReference.get(schemaName, ref.schema_ref_id) as
      | SURefEntity
      | undefined
    if (!entity) continue

    if (schemaName === 'abilities') {
      // Always try to extract resolved actions first (captures all actions
      // with an explicit actionType or damage, including Passive ones)
      const extracted = buildActionItems(
        entity,
        schemaName,
        `ability-${ref.schema_ref_id}`,
        ref.id,
        ref.metadata,
        'pilot',
        isBoarded
      )
      if (extracted.length > 0) {
        actions.push(...extracted)
      } else {
        // Only create a passive card if explicitly typed as Passive
        const actionType = getActionType(entity)
        if (actionType === 'Passive') {
          const name = 'name' in entity ? String(entity.name) : 'Passive'
          actions.push({
            key: `passive-${ref.schema_ref_id}`,
            name,
            actionName: name,
            sourceEntity: entity,
            sourceSchemaName: schemaName,
            borderColor: COST_BORDER_COLORS.none,
            dataValues: extractReferenceEntityDetails(entity, schemaName),
            content: getContentBlocks(entity),
            entityRefId: ref.id,
            activationCost: null,
            maxUses: null,
            usesRemaining: null,
            requiredTraits: [],
            actionType: 'Passive',
            source: 'pilot',
            costType: 'none' as ActionCostType,
            hasDamage: false,
          })
        }
      }
    } else if (schemaName === 'equipment') {
      actions.push(
        ...buildActionItems(
          entity,
          schemaName,
          `equip-${ref.schema_ref_id}`,
          ref.id,
          ref.metadata,
          'pilot',
          isBoarded
        )
      )
    }
  }

  return actions
}

/**
 * Get general (generic) actions available to all pilots.
 * Resolves each generic ability's actions from actions.json.
 */
export function getGeneralActions(isBoarded: boolean): ActionDisplayData[] {
  const allAbilities = SalvageUnionReference.Abilities.all()
  const generic = allAbilities.filter(
    (a) => 'level' in a && a.level === 'G' && 'tree' in a && a.tree === 'Generic'
  )

  const results: ActionDisplayData[] = []
  for (const ability of generic) {
    const entity = ability as SURefEntity
    results.push(
      ...buildActionItems(
        entity,
        'abilities',
        `general-${ability.id}`,
        null,
        null,
        'general',
        isBoarded
      )
    )
  }
  return results
}

/**
 * Extract chassis ability actions from a mech's chassis.
 * These are intrinsic abilities defined on the chassis itself (not entity refs).
 */
export function extractChassisActions(
  chassis: SURefChassis,
  isBoarded: boolean
): ActionDisplayData[] {
  const resolved = getChassisAbilities(chassis)
  if (!resolved || resolved.length === 0) return []

  const entity = chassis as SURefEntity
  const schemaName = 'chassis' as SURefEnumSchemaName

  return resolved
    .filter((a) => ('actionType' in a && a.actionType) || ('damage' in a && a.damage != null))
    .map((action) => {
      const rawCurrency = deriveActionCurrency(action, entity, schemaName)
      const isVariableCurrency = rawCurrency === 'XP'
      const displayCurrency: 'AP' | 'EP' = isVariableCurrency
        ? isBoarded
          ? 'EP'
          : 'AP'
        : (rawCurrency as 'AP' | 'EP')
      const costType = isVariableCurrency
        ? isBoarded
          ? 'ep'
          : 'ap'
        : deriveCostType(action, displayCurrency)
      const dataValues = extractReferenceEntityDetails(
        action,
        'actions' as SURefEnumSchemaName,
        displayCurrency
      )

      let activationCost = getActionActivationCost(action)
      if (isVariableCurrency && activationCost === null) {
        activationCost = 1
        const hasCostDv = dataValues.some((dv) => dv.type === 'cost')
        if (!hasCostDv) {
          dataValues.unshift({ label: `1 ${displayCurrency}`, type: 'cost' })
        }
      }

      const maxUses = getActionMaxUses(action)
      const requiredTraits = getRequiredTraits(action)

      return {
        key: `chassis-${chassis.id}-${action.name}`,
        name: action.displayName || action.name,
        actionName: action.name,
        sourceEntity: entity,
        sourceSchemaName: schemaName,
        borderColor: COST_BORDER_COLORS[costType],
        dataValues,
        content: getContentBlocks(action),
        entityRefId: null,
        activationCost,
        maxUses,
        usesRemaining: null,
        requiredTraits,
        actionType:
          'actionType' in action && typeof action.actionType === 'string' ? action.actionType : '',
        source: 'mech' as ActionSource,
        costType,
        hasDamage: 'damage' in action && action.damage != null,
      }
    })
}

/**
 * Extract actions from comrades (drones/companions).
 * Pilot-sourced comrades get source 'pilot' (always usable).
 * Mech-sourced comrades get source 'mech' (gated by boarded state).
 */
export function extractComradeActions(
  comrades: ComradeEntry[],
  isBoarded: boolean
): ActionDisplayData[] {
  const actions: ActionDisplayData[] = []

  for (const comrade of comrades) {
    const source: ActionSource = comrade.sourceParent === 'pilot' ? 'pilot' : 'mech'
    actions.push(
      ...buildActionItems(
        comrade.entity,
        comrade.entity.schemaName,
        `comrade-${comrade.entity.id}`,
        null,
        null,
        source,
        isBoarded
      )
    )
  }

  return actions
}
