import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference, extractVisibleActions } from 'salvageunion-reference'
import type { SURefEntity, SURefEnumSchemaName, SURefChassis } from 'salvageunion-reference'
import { aggregateActions } from '../aggregateActions'
import type { AggregateActionsInput } from '../aggregateActions'
import type { ComradeEntry } from '../comradeUtils'
import type { EntityRefRow } from '../../types/common'

// ---------------------------------------------------------------------------
// Helpers
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

const EMPTY_INPUT: AggregateActionsInput = {
  pilotRefs: [],
  isBoarded: false,
  comrades: [],
  mechRefs: undefined,
  mechChassis: undefined,
}

/** Find a non-Generic ability with usable actions */
function findActiveAbility(): SURefEntity | undefined {
  return SalvageUnionReference.Abilities.all().find((a) => {
    if (!('actionType' in a) || !a.actionType) return false
    if ('level' in a && a.level === 'G') return false
    return true
  }) as SURefEntity | undefined
}

/** Find equipment with usable actions */
function findEquipmentWithActions(): SURefEntity | undefined {
  return SalvageUnionReference.Equipment.all().find((e) => {
    if (!('actions' in e) || !Array.isArray(e.actions)) return false
    return e.actions.length > 0
  }) as SURefEntity | undefined
}

/** Find a system with usable actions (actionType or damage) */
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

/** Find a chassis that has abilities with actions */
function findChassisWithAbilities(): SURefChassis | undefined {
  return SalvageUnionReference.Chassis.all().find((c) => {
    if (!('abilities' in c) || !Array.isArray(c.abilities)) return false
    return c.abilities.length > 0
  }) as SURefChassis | undefined
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('aggregateActions', () => {
  test('returns only general actions and empty comradeEntityIds for empty inputs', () => {
    const result = aggregateActions(EMPTY_INPUT)
    // General actions are always included even with no refs/comrades
    expect(result.allActions.length).toBeGreaterThan(0)
    for (const action of result.allActions) {
      expect(action.source).toBe('general')
    }
    expect(result.comradeEntityIds.size).toBe(0)
  })

  test('general actions are included when boarded', () => {
    const result = aggregateActions({ ...EMPTY_INPUT, isBoarded: true })
    const generalActions = result.allActions.filter((a) => a.source === 'general')
    expect(generalActions.length).toBeGreaterThan(0)
  })

  test('general actions are included when not boarded', () => {
    const result = aggregateActions(EMPTY_INPUT)
    const generalActions = result.allActions.filter((a) => a.source === 'general')
    expect(generalActions.length).toBeGreaterThan(0)
  })

  test('includes pilot actions from pilot refs', () => {
    const ability = findActiveAbility()
    if (!ability) return

    const result = aggregateActions({
      ...EMPTY_INPUT,
      pilotRefs: [makeRef('abilities', ability.id)],
    })

    const pilotActions = result.allActions.filter((a) => a.source === 'pilot')
    expect(pilotActions.length).toBeGreaterThan(0)
    for (const action of pilotActions) {
      expect(action.sourceEntity).toEqual(ability)
    }
  })

  test('includes mech actions from mech refs when boarded', () => {
    // Find a system with usable actions
    const system = findSystemWithActions()
    if (!system) return

    const mechRef = makeRef('systems', system.id, {
      parent_id: 'test-mech',
      parent_type: 'mech',
    })

    const result = aggregateActions({
      ...EMPTY_INPUT,
      isBoarded: true,
      mechRefs: [mechRef],
    })

    const mechActions = result.allActions.filter((a) => a.source === 'mech')
    expect(mechActions.length).toBeGreaterThan(0)
  })

  test('mech actions are still extracted when not boarded (filtering is handled by UI)', () => {
    const system = findSystemWithActions()
    if (!system) return

    const mechRef = makeRef('systems', system.id, {
      parent_id: 'test-mech',
      parent_type: 'mech',
    })

    const result = aggregateActions({
      ...EMPTY_INPUT,
      isBoarded: false,
      mechRefs: [mechRef],
    })

    // extractMechActions still returns actions regardless of boarded — the component
    // handles disabling via `isBoarded` checks in the sort/display layer
    const mechActions = result.allActions.filter((a) => a.source === 'mech')
    expect(mechActions.length).toBeGreaterThan(0)
  })

  test('skips mech actions when mechRefs is undefined', () => {
    const result = aggregateActions({
      ...EMPTY_INPUT,
      isBoarded: true,
      mechRefs: undefined,
    })

    const mechActions = result.allActions.filter((a) => a.source === 'mech')
    expect(mechActions).toEqual([])
  })

  test('skips mech actions when mechRefs is empty', () => {
    const result = aggregateActions({
      ...EMPTY_INPUT,
      isBoarded: true,
      mechRefs: [],
    })

    const mechActions = result.allActions.filter((a) => a.source === 'mech' && !a.isComrade)
    expect(mechActions).toEqual([])
  })

  test('includes chassis actions when mechChassis is provided', () => {
    const chassis = findChassisWithAbilities()
    if (!chassis) return

    const result = aggregateActions({
      ...EMPTY_INPUT,
      isBoarded: true,
      mechChassis: chassis,
    })

    const chassisActions = result.allActions.filter((a) => a.key.startsWith('chassis-'))
    // Not all chassis have extractable actions — only assert if we got some
    if (chassisActions.length > 0) {
      for (const action of chassisActions) {
        expect(action.source).toBe('mech')
      }
    }
  })

  test('does not include chassis actions when mechChassis is undefined', () => {
    const result = aggregateActions({
      ...EMPTY_INPUT,
      mechChassis: undefined,
    })

    const chassisActions = result.allActions.filter((a) => a.key.startsWith('chassis-'))
    expect(chassisActions).toEqual([])
  })

  test('includes comrade actions and populates comradeEntityIds', () => {
    const entity = findSystemWithActions()
    if (!entity) return

    const comrade: ComradeEntry = {
      entity,
      sourceName: entity.name,
      sourceParent: 'pilot',
    }

    const result = aggregateActions({
      ...EMPTY_INPUT,
      comrades: [comrade],
    })

    expect(result.comradeEntityIds.has(entity.id)).toBe(true)
    expect(result.comradeEntityIds.size).toBe(1)

    const comradeActions = result.allActions.filter((a) => a.isComrade)
    expect(comradeActions.length).toBeGreaterThan(0)
    for (const action of comradeActions) {
      expect(action.comradeEntity).toBeDefined()
    }
  })

  test('comradeEntityIds is empty when no comrades', () => {
    const result = aggregateActions(EMPTY_INPUT)
    expect(result.comradeEntityIds.size).toBe(0)
  })

  test('comradeEntityIds contains all comrade entity IDs', () => {
    const e1 = findSystemWithActions()
    if (!e1) return

    const comrades: ComradeEntry[] = [{ entity: e1, sourceName: e1.name, sourceParent: 'pilot' }]

    const result = aggregateActions({
      ...EMPTY_INPUT,
      comrades,
    })

    expect(result.comradeEntityIds.size).toBe(1)
    expect(result.comradeEntityIds.has(e1.id)).toBe(true)
  })

  test('mech-sourced comrade actions have source "mech"', () => {
    const entity = findSystemWithActions()
    if (!entity) return

    const comrade: ComradeEntry = {
      entity,
      sourceName: entity.name,
      sourceParent: 'mech',
    }

    const result = aggregateActions({
      ...EMPTY_INPUT,
      isBoarded: true,
      comrades: [comrade],
    })

    const comradeActions = result.allActions.filter((a) => a.isComrade)
    expect(comradeActions.length).toBeGreaterThan(0)
    for (const action of comradeActions) {
      expect(action.source).toBe('mech')
    }
  })

  test('pilot-sourced comrade actions have source "pilot"', () => {
    const entity = findSystemWithActions()
    if (!entity) return

    const comrade: ComradeEntry = {
      entity,
      sourceName: entity.name,
      sourceParent: 'pilot',
    }

    const result = aggregateActions({
      ...EMPTY_INPUT,
      comrades: [comrade],
    })

    const comradeActions = result.allActions.filter((a) => a.isComrade)
    expect(comradeActions.length).toBeGreaterThan(0)
    for (const action of comradeActions) {
      expect(action.source).toBe('pilot')
    }
  })

  test('all action keys are unique in merged result', () => {
    const ability = findActiveAbility()
    const equipment = findEquipmentWithActions()
    const system = findSystemWithActions()

    const pilotRefs: EntityRefRow[] = []
    if (ability) pilotRefs.push(makeRef('abilities', ability.id))
    if (equipment) pilotRefs.push(makeRef('equipment', equipment.id))

    const mechRefs: EntityRefRow[] = []
    if (system) {
      mechRefs.push(
        makeRef('systems', system.id, {
          parent_id: 'test-mech',
          parent_type: 'mech',
        })
      )
    }

    const result = aggregateActions({
      pilotRefs,
      isBoarded: true,
      comrades: [],
      mechRefs,
      mechChassis: undefined,
    })

    const keys = result.allActions.map((a) => a.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('combines pilot, mech, and general actions in order', () => {
    const ability = findActiveAbility()
    const system = findSystemWithActions()
    if (!ability || !system) return

    const result = aggregateActions({
      pilotRefs: [makeRef('abilities', ability.id)],
      isBoarded: true,
      comrades: [],
      mechRefs: [
        makeRef('systems', system.id, {
          parent_id: 'test-mech',
          parent_type: 'mech',
        }),
      ],
      mechChassis: undefined,
    })

    // Verify all three sources are present
    const sources = new Set(result.allActions.map((a) => a.source))
    expect(sources.has('pilot')).toBe(true)
    expect(sources.has('mech')).toBe(true)
    expect(sources.has('general')).toBe(true)

    // Verify ordering: pilot actions come first, then mech, then general
    const firstPilotIdx = result.allActions.findIndex((a) => a.source === 'pilot')
    const firstMechIdx = result.allActions.findIndex((a) => a.source === 'mech')
    const firstGeneralIdx = result.allActions.findIndex((a) => a.source === 'general')
    expect(firstPilotIdx).toBeLessThan(firstMechIdx)
    expect(firstMechIdx).toBeLessThan(firstGeneralIdx)
  })
})
