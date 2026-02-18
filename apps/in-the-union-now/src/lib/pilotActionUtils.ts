import type {
  SURefMetaAction,
  SURefEnumSchemaName,
  SURefEntity,
  SURefObjectContentBlock,
} from 'salvageunion-reference'
import {
  SalvageUnionReference,
  getActionType,
  getTechLevelNumber,
  extractVisibleActions,
  getRequiredTraits,
} from 'salvageunion-reference'
import {
  calculateBackgroundColor,
  borderColorFromHeaderBg,
  extractReferenceEntityDetails,
  getActivationCurrency,
  techLevelColors,
} from 'suref-react'
import type { DataValue } from 'suref-react'
import type { EntityRefRow } from '../types/common'
import type { Json } from '../types/database-generated.types'
import { getActionActivationCost, getActionMaxUses, getRemainingUses } from './actionUsesUtils'

export type ActionDisplayData = {
  key: string
  name: string
  actionName: string
  sourceEntity: SURefEntity
  sourceSchemaName: SURefEnumSchemaName
  paleBackgroundColor: string
  borderColor: string
  dataValues: DataValue[]
  content?: SURefObjectContentBlock[]
  entityRefId: string | null
  activationCost: number | null
  maxUses: number | null
  usesRemaining: number | null
  requiredTraits: string[]
}

export type PassiveDisplayData = {
  entity: SURefEntity
  schemaName: SURefEnumSchemaName
}

/**
 * Compute the CSS variable color string from an entity's background class.
 */
function computeBorderColor(entity: SURefEntity, schemaName: SURefEnumSchemaName): string {
  const techLevel = getTechLevelNumber(entity)
  const bgClass = calculateBackgroundColor(schemaName, '', techLevel, entity, techLevelColors)
  return borderColorFromHeaderBg(bgClass) ?? 'var(--color-su-orange)'
}

/**
 * Compute a pale (35% mix with white) background color for an entity.
 * Chains: entity -> calculateBackgroundColor() -> borderColorFromHeaderBg() -> color-mix
 */
function computePaleColor(entity: SURefEntity, schemaName: SURefEnumSchemaName): string {
  const cssVar = computeBorderColor(entity, schemaName)
  return `color-mix(in srgb, ${cssVar} 35%, white)`
}

/**
 * Extract content blocks from an action or entity.
 */
function getContentBlocks(
  data: SURefMetaAction | SURefEntity
): SURefObjectContentBlock[] | undefined {
  if ('content' in data && Array.isArray(data.content) && data.content.length > 0) {
    return data.content as SURefObjectContentBlock[]
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
 */
function buildActionItems(
  entity: SURefEntity,
  schemaName: SURefEnumSchemaName,
  keyPrefix: string,
  paleColor: string,
  border: string,
  entityRefId: string | null,
  refMetadata: Json | null
): ActionDisplayData[] {
  const resolved = extractVisibleActions(entity)
  if (!resolved) return []

  const usableActions = resolved.filter((a) => 'actionType' in a && a.actionType)

  return usableActions.map((action) => {
    const currency = deriveActionCurrency(action, entity, schemaName)
    const dataValues = extractReferenceEntityDetails(
      action,
      'actions' as SURefEnumSchemaName,
      currency
    )
    const activationCost = getActionActivationCost(action)
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
      paleBackgroundColor: paleColor,
      borderColor: border,
      dataValues,
      content: getContentBlocks(action),
      entityRefId,
      activationCost,
      maxUses,
      usesRemaining,
      requiredTraits,
    }
  })
}

/**
 * Extract mech actions from entity refs (systems + modules only).
 * These actions cost EP instead of AP — currency is derived automatically
 * by buildActionItems → deriveActionCurrency.
 */
export function extractMechActions(refs: EntityRefRow[]): ActionDisplayData[] {
  const actions: ActionDisplayData[] = []

  for (const ref of refs) {
    const schemaName = ref.schema_name as SURefEnumSchemaName
    if (schemaName !== 'systems' && schemaName !== 'modules') continue

    const entity = SalvageUnionReference.get(schemaName, ref.schema_ref_id) as
      | SURefEntity
      | undefined
    if (!entity) continue

    const paleColor = computePaleColor(entity, schemaName)
    const border = computeBorderColor(entity, schemaName)

    actions.push(
      ...buildActionItems(
        entity,
        schemaName,
        `mech-${schemaName}-${ref.schema_ref_id}`,
        paleColor,
        border,
        ref.id,
        ref.metadata
      )
    )
  }

  return actions
}

/**
 * Extract pilot actions and passives from entity refs.
 * - Abilities with actionType -> resolve actions from actions.json -> ActionDisplayData[]
 * - Abilities without actionType -> passives (rendered as compact ReferenceEntityDisplay)
 * - Equipment -> resolve actions from actions.json -> ActionDisplayData[]
 */
export function extractPilotActions(refs: EntityRefRow[]): {
  actions: ActionDisplayData[]
  passives: PassiveDisplayData[]
} {
  const actions: ActionDisplayData[] = []
  const passives: PassiveDisplayData[] = []

  for (const ref of refs) {
    const schemaName = ref.schema_name as SURefEnumSchemaName
    const entity = SalvageUnionReference.get(schemaName, ref.schema_ref_id) as
      | SURefEntity
      | undefined
    if (!entity) continue

    const paleColor = computePaleColor(entity, schemaName)
    const border = computeBorderColor(entity, schemaName)

    if (schemaName === 'abilities') {
      const actionType = getActionType(entity)
      if (actionType) {
        actions.push(
          ...buildActionItems(
            entity,
            schemaName,
            `ability-${ref.schema_ref_id}`,
            paleColor,
            border,
            ref.id,
            ref.metadata
          )
        )
      } else {
        passives.push({ entity, schemaName })
      }
    } else if (schemaName === 'equipment') {
      actions.push(
        ...buildActionItems(
          entity,
          schemaName,
          `equip-${ref.schema_ref_id}`,
          paleColor,
          border,
          ref.id,
          ref.metadata
        )
      )
    }
  }

  return { actions, passives }
}

/**
 * Get general (generic) actions available to all pilots.
 * Resolves each generic ability's actions from actions.json.
 */
export function getGeneralActions(): ActionDisplayData[] {
  const allAbilities = SalvageUnionReference.Abilities.all()
  const generic = allAbilities.filter(
    (a) => 'level' in a && a.level === 'G' && 'tree' in a && a.tree === 'Generic'
  )

  const results: ActionDisplayData[] = []
  for (const ability of generic) {
    const entity = ability as SURefEntity
    const paleColor = computePaleColor(entity, 'abilities')
    const border = computeBorderColor(entity, 'abilities')
    results.push(
      ...buildActionItems(
        entity,
        'abilities',
        `general-${ability.id}`,
        paleColor,
        border,
        null,
        null
      )
    )
  }
  return results
}
