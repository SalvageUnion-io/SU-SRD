import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference, extractVisibleActions } from 'salvageunion-reference'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { extractPilotActions, extractComradeActions, getGeneralActions } from './pilotActionUtils'
import type { ComradeEntry } from './comradeUtils'
import type { EntityRefRow } from '../types/common'

// ---------------------------------------------------------------------------
// Helper: create a minimal EntityRefRow for testing
// ---------------------------------------------------------------------------
function makeRef(
  schemaName: string,
  schemaRefId: string,
  overrides: Partial<EntityRefRow> = {}
): EntityRefRow {
  return {
    id: `ref-${schemaName}-${schemaRefId}`,
    parent_id: 'test-pilot',
    parent_type: 'pilot',
    schema_name: schemaName,
    schema_ref_id: schemaRefId,
    sort_order: 0,
    item_condition: 'intact',
    created_at: new Date().toISOString(),
    ...overrides,
  } as EntityRefRow
}

// ---------------------------------------------------------------------------
// extractPilotActions
// ---------------------------------------------------------------------------
describe('extractPilotActions', () => {
  test('returns empty array for empty refs', () => {
    const result = extractPilotActions([], false)
    expect(result).toEqual([])
  })

  test('resolves active abilities to actions from actions.json', () => {
    // Find an ability that has an actionType (active ability)
    const activeAbility = SalvageUnionReference.Abilities.all().find((a) => {
      if (!('actionType' in a) || !a.actionType) return false
      if ('level' in a && a.level === 'G') return false
      return true
    }) as SURefEntity | undefined

    if (!activeAbility) return

    const refs = [makeRef('abilities', activeAbility.id)]
    const result = extractPilotActions(refs, false)
    const actions = result.filter((a) => a.actionType !== 'Passive')
    expect(actions.length).toBeGreaterThan(0)

    // Action names should come from the resolved actions, not the ability
    const resolvedActions = extractVisibleActions(activeAbility)
    if (resolvedActions && resolvedActions.length > 0) {
      const resolvedNames = resolvedActions.map((a) => a.displayName || a.name)
      for (const action of actions) {
        expect(resolvedNames).toContain(action.name)
      }
    }

    // Source entity should be the ability
    for (const action of actions) {
      expect(action.sourceEntity).toEqual(activeAbility)
      expect(action.sourceSchemaName).toBe('abilities')
    }
  })

  test('resolved actions have content from actions.json', () => {
    // "Read a Person" ability has actions with content
    const readAPerson = SalvageUnionReference.Abilities.all().find(
      (a) => 'name' in a && a.name === 'Read a Person'
    ) as SURefEntity | undefined

    if (!readAPerson) return

    const refs = [makeRef('abilities', readAPerson.id)]
    const result = extractPilotActions(refs, false)
    const actions = result.filter((a) => a.actionType !== 'Passive')
    expect(actions.length).toBeGreaterThan(0)
    // The resolved action should have content from actions.json
    expect(actions[0]!.content).toBeDefined()
    expect(actions[0]!.content!.length).toBeGreaterThan(0)
  })

  test('extracts explicitly Passive actions from abilities', () => {
    // Union Engineer has Mender (Passive) + Quick Fix (Free) — both should be extracted
    const unionEngineer = SalvageUnionReference.Abilities.all().find(
      (a) => 'name' in a && a.name === 'Union Engineer'
    ) as SURefEntity | undefined

    if (!unionEngineer) return

    const refs = [makeRef('abilities', unionEngineer.id)]
    const result = extractPilotActions(refs, false)
    const passives = result.filter((a) => a.actionType === 'Passive')
    const nonPassives = result.filter((a) => a.actionType !== 'Passive')
    // Should have both Passive and non-Passive actions
    expect(passives.length).toBeGreaterThan(0)
    expect(nonPassives.length).toBeGreaterThan(0)
    expect(passives[0]!.sourceSchemaName).toBe('abilities')
    expect(passives[0]!.source).toBe('pilot')
  })

  test('does not classify abilities as Passive when actionType is absent', () => {
    // Abilities whose resolved actions have no explicit actionType should not be Passive
    const abilityWithNoType = SalvageUnionReference.Abilities.all().find((a) => {
      if ('level' in a && a.level === 'G') return false
      const vis = extractVisibleActions(a as SURefEntity)
      if (!vis || vis.length === 0) return false
      // All visible actions have no actionType and no damage
      return vis.every(
        (v) => (!('actionType' in v) || !v.actionType) && (!('damage' in v) || v.damage == null)
      )
    }) as SURefEntity | undefined

    if (!abilityWithNoType) return

    const refs = [makeRef('abilities', abilityWithNoType.id)]
    const result = extractPilotActions(refs, false)
    // Should produce no action cards at all (not even Passive)
    expect(result.length).toBe(0)
  })

  test('extracts equipment sub-actions into actions', () => {
    // Find equipment with visible actions
    const equipment = SalvageUnionReference.Equipment.all().find((e) => {
      if (!('actions' in e) || !Array.isArray(e.actions)) return false
      return e.actions.length > 0
    }) as SURefEntity | undefined

    if (!equipment) return

    const refs = [makeRef('equipment', equipment.id)]
    const result = extractPilotActions(refs, false)
    const actions = result.filter((a) => a.actionType !== 'Passive')
    expect(actions.length).toBeGreaterThan(0)
    // Sub-actions should reference the equipment as source
    for (const action of actions) {
      expect(action.sourceEntity).toEqual(equipment)
      expect(action.sourceSchemaName).toBe('equipment')
    }
  })

  test('handles mixed abilities and equipment', () => {
    const activeAbility = SalvageUnionReference.Abilities.all().find(
      (a) => 'actionType' in a && a.actionType && a.level !== 'G'
    ) as SURefEntity | undefined
    const equipment = SalvageUnionReference.Equipment.all().find(
      (e) => 'actions' in e && Array.isArray(e.actions) && e.actions.length > 0
    ) as SURefEntity | undefined

    if (!activeAbility || !equipment) return

    const refs = [makeRef('abilities', activeAbility.id), makeRef('equipment', equipment.id)]
    const result = extractPilotActions(refs, false)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  test('generates unique keys for all action items', () => {
    const allAbilities = SalvageUnionReference.Abilities.all()
    const active1 = allAbilities.find(
      (a) => 'actionType' in a && a.actionType && a.level !== 'G'
    ) as SURefEntity | undefined
    const equipment = SalvageUnionReference.Equipment.all().find(
      (e) => 'actions' in e && Array.isArray(e.actions) && e.actions.length > 0
    ) as SURefEntity | undefined

    const refs: EntityRefRow[] = []
    if (active1) refs.push(makeRef('abilities', active1.id))
    if (equipment) refs.push(makeRef('equipment', equipment.id))

    const result = extractPilotActions(refs, false)
    const allKeys = result.map((a) => a.key)
    const uniqueKeys = new Set(allKeys)
    expect(uniqueKeys.size).toBe(allKeys.length)
  })

  test('actions have actionType, source, and hasDamage fields', () => {
    const activeAbility = SalvageUnionReference.Abilities.all().find(
      (a) => 'actionType' in a && a.actionType && a.level !== 'G'
    ) as SURefEntity | undefined

    if (!activeAbility) return

    const refs = [makeRef('abilities', activeAbility.id)]
    const result = extractPilotActions(refs, false)
    for (const action of result) {
      expect(typeof action.actionType).toBe('string')
      expect(action.source).toBe('pilot')
      expect(typeof action.hasDamage).toBe('boolean')
    }
  })
})

// ---------------------------------------------------------------------------
// getGeneralActions
// ---------------------------------------------------------------------------
describe('getGeneralActions', () => {
  test('returns resolved actions for all 8 generic abilities', () => {
    const result = getGeneralActions(false)
    // Each generic ability resolves to at least one action
    expect(result.length).toBeGreaterThanOrEqual(8)
  })

  test('each item has valid ActionDisplayData fields', () => {
    const result = getGeneralActions(false)
    for (const item of result) {
      expect(item.key).toMatch(/^general-/)
      expect(item.name).toBeTruthy()
      expect(item.sourceEntity).toBeDefined()
      expect(item.sourceSchemaName).toBe('abilities')
      expect(item.borderColor).toBeTruthy()
      expect(Array.isArray(item.dataValues)).toBe(true)
      expect(item.source).toBe('general')
    }
  })

  test('includes expected action names from generic abilities', () => {
    const result = getGeneralActions(false)
    const names = result.map((a) => a.name)
    expect(names).toContain('Area Salvage')
    expect(names).toContain('Mech Salvage')
    expect(names).toContain('Scrap')
    expect(names).toContain('Repair')
    expect(names).toContain('Mount')
  })

  test('all keys are unique', () => {
    const result = getGeneralActions(false)
    const keys = result.map((a) => a.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('resolved actions have content from actions.json', () => {
    const result = getGeneralActions(false)
    // Most general actions should have content
    const withContent = result.filter((a) => a.content && a.content.length > 0)
    expect(withContent.length).toBeGreaterThan(0)
  })

  test('Area Salvage shows AP when not boarded (variable currency resolved)', () => {
    const result = getGeneralActions(false)
    const areaSalvage = result.find((a) => a.name === 'Area Salvage')
    expect(areaSalvage).toBeDefined()
    expect(areaSalvage!.costType).toBe('ap')
    expect(areaSalvage!.activationCost).toBe(1)
    const costDv = areaSalvage!.dataValues.find((dv) => dv.type === 'cost')
    expect(costDv).toBeDefined()
    expect(costDv!.label).toContain('AP')
  })

  test('Area Salvage shows EP when boarded (variable currency resolved)', () => {
    const result = getGeneralActions(true)
    const areaSalvage = result.find((a) => a.name === 'Area Salvage')
    expect(areaSalvage).toBeDefined()
    expect(areaSalvage!.costType).toBe('ep')
    expect(areaSalvage!.activationCost).toBe(1)
    const costDv = areaSalvage!.dataValues.find((dv) => dv.type === 'cost')
    expect(costDv).toBeDefined()
    expect(costDv!.label).toContain('EP')
  })
})

// ---------------------------------------------------------------------------
// extractComradeActions
// ---------------------------------------------------------------------------

/** Find a system with usable actions (actionType or damage) to use as a test comrade. */
function findSystemWithActions(): (SURefEntity & { schemaName: SURefEnumSchemaName }) | null {
  for (const entity of SalvageUnionReference.Systems.all()) {
    const visible = extractVisibleActions(entity as SURefEntity)
    if (!visible) continue
    const usable = visible.filter(
      (a) => ('actionType' in a && a.actionType) || ('damage' in a && a.damage != null)
    )
    if (usable.length > 0) return entity as SURefEntity & { schemaName: SURefEnumSchemaName }
  }
  return null
}

/** Find a module with usable actions (actionType or damage) to use as a test comrade. */
function findModuleWithActions(): (SURefEntity & { schemaName: SURefEnumSchemaName }) | null {
  for (const entity of SalvageUnionReference.Modules.all()) {
    const visible = extractVisibleActions(entity as SURefEntity)
    if (!visible) continue
    const usable = visible.filter(
      (a) => ('actionType' in a && a.actionType) || ('damage' in a && a.damage != null)
    )
    if (usable.length > 0) return entity as SURefEntity & { schemaName: SURefEnumSchemaName }
  }
  return null
}

describe('extractComradeActions', () => {
  test('returns empty array for no comrades', () => {
    expect(extractComradeActions([], false)).toEqual([])
  })

  test('returns empty for comrades without usable actions', () => {
    // Auto-Turret has config-only actions (no actionType/damage)
    const entity = SalvageUnionReference.get(
      'equipment',
      'f5f04072-9e81-4c9d-a835-b71f45120d66'
    ) as (SURefEntity & { schemaName: SURefEnumSchemaName }) | undefined
    if (!entity) return

    const comrade: ComradeEntry = { entity, sourceName: entity.name, sourceParent: 'pilot' }
    const actions = extractComradeActions([comrade], false)
    expect(actions).toEqual([])
  })

  test('pilot-sourced comrade actions have source "pilot"', () => {
    // Use a systems entity with usable actions as a synthetic comrade
    const entity = findSystemWithActions()
    if (!entity) return

    const comrade: ComradeEntry = { entity, sourceName: entity.name, sourceParent: 'pilot' }
    const actions = extractComradeActions([comrade], false)
    expect(actions.length).toBeGreaterThan(0)
    for (const action of actions) {
      expect(action.source).toBe('pilot')
      expect(action.key).toMatch(/^comrade-/)
    }
  })

  test('mech-sourced comrade actions have source "mech"', () => {
    const entity = findSystemWithActions()
    if (!entity) return

    const comrade: ComradeEntry = { entity, sourceName: entity.name, sourceParent: 'mech' }
    const actions = extractComradeActions([comrade], false)
    expect(actions.length).toBeGreaterThan(0)
    for (const action of actions) {
      expect(action.source).toBe('mech')
      expect(action.key).toMatch(/^comrade-/)
    }
  })

  test('comrade actions have correct sourceEntity and sourceSchemaName', () => {
    const entity = findSystemWithActions()
    if (!entity) return

    const comrade: ComradeEntry = { entity, sourceName: entity.name, sourceParent: 'pilot' }
    const actions = extractComradeActions([comrade], false)
    expect(actions.length).toBeGreaterThan(0)
    for (const action of actions) {
      expect(action.sourceEntity).toEqual(entity)
      expect(action.sourceSchemaName).toBe('systems')
    }
  })

  test('comrade actions have null entityRefId (no entity_ref tracking)', () => {
    const entity = findSystemWithActions()
    if (!entity) return

    const comrade: ComradeEntry = { entity, sourceName: entity.name, sourceParent: 'pilot' }
    const actions = extractComradeActions([comrade], false)
    for (const action of actions) {
      expect(action.entityRefId).toBeNull()
    }
  })

  test('all keys are unique across multiple comrades', () => {
    const entity1 = findSystemWithActions()
    const entity2 = findModuleWithActions()
    if (!entity1 || !entity2) return

    const comrades: ComradeEntry[] = [
      { entity: entity1, sourceName: entity1.name, sourceParent: 'pilot' },
      { entity: entity2, sourceName: entity2.name, sourceParent: 'mech' },
    ]
    const actions = extractComradeActions(comrades, false)
    const keys = actions.map((a) => a.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
