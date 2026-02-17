import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference, getActionType, extractVisibleActions } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { extractPilotActions, getGeneralActions } from './pilotActionUtils'
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
  test('returns empty arrays for empty refs', () => {
    const result = extractPilotActions([])
    expect(result.actions).toEqual([])
    expect(result.passives).toEqual([])
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
    const result = extractPilotActions(refs)
    expect(result.actions.length).toBeGreaterThan(0)

    // Action names should come from the resolved actions, not the ability
    const resolvedActions = extractVisibleActions(activeAbility)
    if (resolvedActions && resolvedActions.length > 0) {
      const resolvedNames = resolvedActions.map((a) => a.displayName || a.name)
      for (const action of result.actions) {
        expect(resolvedNames).toContain(action.name)
      }
    }

    // Source entity should be the ability
    for (const action of result.actions) {
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
    const result = extractPilotActions(refs)
    expect(result.actions.length).toBeGreaterThan(0)
    // The resolved action should have content from actions.json
    expect(result.actions[0]!.content).toBeDefined()
    expect(result.actions[0]!.content!.length).toBeGreaterThan(0)
  })

  test('classifies abilities without actionType as passives', () => {
    // Find an ability that getActionType() returns falsy for (truly passive)
    const passiveAbility = SalvageUnionReference.Abilities.all().find((a) => {
      if ('level' in a && a.level === 'G') return false
      return !getActionType(a)
    }) as SURefEntity | undefined

    if (!passiveAbility) return

    const refs = [makeRef('abilities', passiveAbility.id)]
    const result = extractPilotActions(refs)
    expect(result.passives.length).toBeGreaterThan(0)
    expect(result.passives[0]!.entity).toEqual(passiveAbility)
    expect(result.passives[0]!.schemaName).toBe('abilities')
  })

  test('extracts equipment sub-actions into actions', () => {
    // Find equipment with visible actions
    const equipment = SalvageUnionReference.Equipment.all().find((e) => {
      if (!('actions' in e) || !Array.isArray(e.actions)) return false
      return e.actions.length > 0
    }) as SURefEntity | undefined

    if (!equipment) return

    const refs = [makeRef('equipment', equipment.id)]
    const result = extractPilotActions(refs)
    expect(result.actions.length).toBeGreaterThan(0)
    // Sub-actions should reference the equipment as source
    for (const action of result.actions) {
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
    const result = extractPilotActions(refs)
    expect(result.actions.length).toBeGreaterThanOrEqual(2)
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

    const result = extractPilotActions(refs)
    const allKeys = result.actions.map((a) => a.key)
    const uniqueKeys = new Set(allKeys)
    expect(uniqueKeys.size).toBe(allKeys.length)
  })
})

// ---------------------------------------------------------------------------
// getGeneralActions
// ---------------------------------------------------------------------------
describe('getGeneralActions', () => {
  test('returns resolved actions for all 8 generic abilities', () => {
    const result = getGeneralActions()
    // Each generic ability resolves to at least one action
    expect(result.length).toBeGreaterThanOrEqual(8)
  })

  test('each item has valid ActionDisplayData fields', () => {
    const result = getGeneralActions()
    for (const item of result) {
      expect(item.key).toMatch(/^general-/)
      expect(item.name).toBeTruthy()
      expect(item.sourceEntity).toBeDefined()
      expect(item.sourceSchemaName).toBe('abilities')
      expect(item.paleBackgroundColor).toContain('color-mix')
      expect(Array.isArray(item.dataValues)).toBe(true)
    }
  })

  test('includes expected action names from generic abilities', () => {
    const result = getGeneralActions()
    const names = result.map((a) => a.name)
    expect(names).toContain('Area Salvage')
    expect(names).toContain('Mech Salvage')
    expect(names).toContain('Scrap')
    expect(names).toContain('Repair')
    expect(names).toContain('Mount')
  })

  test('all keys are unique', () => {
    const result = getGeneralActions()
    const keys = result.map((a) => a.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('resolved actions have content from actions.json', () => {
    const result = getGeneralActions()
    // Most general actions should have content
    const withContent = result.filter((a) => a.content && a.content.length > 0)
    expect(withContent.length).toBeGreaterThan(0)
  })

  test('Area Salvage shows XP currency from variable activationCurrency', () => {
    const result = getGeneralActions()
    const areaSalvage = result.find((a) => a.name === 'Area Salvage')
    expect(areaSalvage).toBeDefined()
    // The ability has activationCurrency: "Variable" which resolves to XP
    const costDv = areaSalvage!.dataValues.find((dv) => dv.type === 'cost')
    expect(costDv).toBeDefined()
    expect(costDv!.label).toContain('XP')
  })
})
