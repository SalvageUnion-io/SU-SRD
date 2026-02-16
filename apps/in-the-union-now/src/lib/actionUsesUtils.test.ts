import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefMetaAction } from 'salvageunion-reference'
import type { Json } from '../types/database-generated.types'
import type { EntityRefRow, PilotRow } from '../types/common'
import {
  getActionActivationCost,
  getActionMaxUses,
  getRemainingUses,
  decrementActionUses,
  getActionDisabledReason,
  getPilotTraits,
} from './actionUsesUtils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findAction(name: string): SURefMetaAction {
  const action = SalvageUnionReference.Actions.find((a) => a.name === name)
  if (!action) throw new Error(`Action "${name}" not found`)
  return action
}

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
    metadata: null,
    created_at: new Date().toISOString(),
    ...overrides,
  } as EntityRefRow
}

function makePilot(overrides: Partial<PilotRow> = {}): PilotRow {
  return {
    id: 'test-pilot',
    user_id: 'test-user',
    callsign: 'Test',
    class_ref: 'hauler',
    hp: 4,
    max_hp: 4,
    ap: 6,
    max_ap: 6,
    tp: 0,
    mech_id: null,
    background: null,
    motto: null,
    keepsake: null,
    appearance: null,
    visible: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as PilotRow
}

// ---------------------------------------------------------------------------
// getActionActivationCost
// ---------------------------------------------------------------------------
describe('getActionActivationCost', () => {
  test('returns numeric cost for actions with AP cost', () => {
    const action = findAction('Area Salvage')
    expect(getActionActivationCost(action)).toBe(1)
  })

  test('returns null for actions without activationCost', () => {
    // Find an action without activationCost
    const action = findAction('Load')
    expect(getActionActivationCost(action)).toBeNull()
  })

  test('returns null for variable cost (X)', () => {
    const action = findAction('Persona')
    expect(getActionActivationCost(action)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getActionMaxUses
// ---------------------------------------------------------------------------
describe('getActionMaxUses', () => {
  test('returns null for actions without uses trait', () => {
    const action = findAction('Area Salvage')
    expect(getActionMaxUses(action)).toBeNull()
  })

  test('returns use count for actions with uses trait', () => {
    // Find an action that has a uses trait
    const allActions = SalvageUnionReference.Actions.all()
    const withUses = allActions.find(
      (a) =>
        Array.isArray(a.traits) &&
        a.traits.some((t) => t.type === 'uses' && typeof t.amount === 'number')
    )
    if (!withUses) return // skip if no actions have uses trait
    const result = getActionMaxUses(withUses)
    expect(result).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// getRemainingUses
// ---------------------------------------------------------------------------
describe('getRemainingUses', () => {
  test('returns null when metadata is null', () => {
    expect(getRemainingUses('Area Salvage', null)).toBeNull()
  })

  test('returns null when action is not tracked', () => {
    const metadata = { actionUses: { 'Other Action': 2 } } as unknown as Json
    expect(getRemainingUses('Area Salvage', metadata)).toBeNull()
  })

  test('returns remaining count when tracked', () => {
    const metadata = { actionUses: { 'Area Salvage': 3 } } as unknown as Json
    expect(getRemainingUses('Area Salvage', metadata)).toBe(3)
  })

  test('returns 0 when all uses spent', () => {
    const metadata = { actionUses: { 'Area Salvage': 0 } } as unknown as Json
    expect(getRemainingUses('Area Salvage', metadata)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// decrementActionUses
// ---------------------------------------------------------------------------
describe('decrementActionUses', () => {
  test('lazy inits from maxUses on first use', () => {
    const result = decrementActionUses('Area Salvage', 5, null)
    expect(result).toEqual({ actionUses: { 'Area Salvage': 4 } })
  })

  test('decrements existing count', () => {
    const metadata = { actionUses: { 'Area Salvage': 3 } } as unknown as Json
    const result = decrementActionUses('Area Salvage', 5, metadata)
    expect(result).toEqual({ actionUses: { 'Area Salvage': 2 } })
  })

  test('does not go below 0', () => {
    const metadata = { actionUses: { 'Area Salvage': 0 } } as unknown as Json
    const result = decrementActionUses('Area Salvage', 5, metadata)
    expect(result).toEqual({ actionUses: { 'Area Salvage': 0 } })
  })

  test('preserves other metadata keys', () => {
    const metadata = {
      someOtherKey: 'value',
      actionUses: { 'Other Action': 2 },
    } as unknown as Json
    const result = decrementActionUses('Area Salvage', 5, metadata) as Record<string, unknown>
    expect(result.someOtherKey).toBe('value')
    const actionUses = result.actionUses as Record<string, number>
    expect(actionUses['Other Action']).toBe(2)
    expect(actionUses['Area Salvage']).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// getActionDisabledReason
// ---------------------------------------------------------------------------
describe('getActionDisabledReason', () => {
  test('returns null when action can be used', () => {
    const action = findAction('Area Salvage')
    const pilot = makePilot({ ap: 6 })
    const pilotTraits = new Set(['salvaging'])
    const result = getActionDisabledReason({
      action,
      pilot,
      pilotTraits,
      usesRemaining: null,
      maxUses: null,
    })
    expect(result).toBeNull()
  })

  test('returns missing trait reason', () => {
    const action = findAction('Area Salvage')
    const pilot = makePilot({ ap: 6 })
    const pilotTraits = new Set<string>()
    const result = getActionDisabledReason({
      action,
      pilot,
      pilotTraits,
      usesRemaining: null,
      maxUses: null,
    })
    expect(result).toBe('Requires trait: Salvaging')
  })

  test('returns not enough AP when cost exceeds current AP', () => {
    const action = findAction('Area Salvage')
    const pilot = makePilot({ ap: 0 })
    const pilotTraits = new Set(['salvaging'])
    const result = getActionDisabledReason({
      action,
      pilot,
      pilotTraits,
      usesRemaining: null,
      maxUses: null,
    })
    expect(result).toBe('Not enough AP')
  })

  test('returns out of uses when remaining is 0', () => {
    const action = findAction('Area Salvage')
    const pilot = makePilot({ ap: 6 })
    const pilotTraits = new Set(['salvaging'])
    const result = getActionDisabledReason({
      action,
      pilot,
      pilotTraits,
      usesRemaining: 0,
      maxUses: 5,
    })
    expect(result).toBe('Out of uses')
  })

  test('checks traits before AP', () => {
    const action = findAction('Area Salvage')
    const pilot = makePilot({ ap: 0 })
    const pilotTraits = new Set<string>()
    const result = getActionDisabledReason({
      action,
      pilot,
      pilotTraits,
      usesRemaining: null,
      maxUses: null,
    })
    expect(result).toBe('Requires trait: Salvaging')
  })

  test('returns null for action with no requirements', () => {
    // Find an action without requiredTraits and without activationCost
    const action = findAction('.50 Cal Machine Gun')
    const pilot = makePilot()
    const result = getActionDisabledReason({
      action,
      pilot,
      pilotTraits: new Set(),
      usesRemaining: null,
      maxUses: null,
    })
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getPilotTraits
// ---------------------------------------------------------------------------
describe('getPilotTraits', () => {
  test('returns empty set for no refs', () => {
    const result = getPilotTraits([])
    expect(result.size).toBe(0)
  })

  test('collects traits from equipment refs', () => {
    // Find equipment with traits
    const allEquipment = SalvageUnionReference.Equipment.all()
    const withTraits = allEquipment.find(
      (e) => 'traits' in e && Array.isArray(e.traits) && e.traits.length > 0
    )
    if (!withTraits) return
    const refs = [makeRef('equipment', withTraits.id)]
    const result = getPilotTraits(refs)
    expect(result.size).toBeGreaterThan(0)
  })

  test('collects traits from ability action traits', () => {
    // Find ability whose actions have traits
    const allAbilities = SalvageUnionReference.Abilities.all()
    const withActionTraits = allAbilities.find((a) => {
      if (!('actions' in a) || !Array.isArray(a.actions)) return false
      for (const actionName of a.actions) {
        const action = SalvageUnionReference.Actions.find((act) => act.name === actionName)
        if (action?.traits && action.traits.length > 0) return true
      }
      return false
    })
    if (!withActionTraits) return
    const refs = [makeRef('abilities', withActionTraits.id)]
    const result = getPilotTraits(refs)
    expect(result.size).toBeGreaterThan(0)
  })

  test('trait names are lowercase', () => {
    const allEquipment = SalvageUnionReference.Equipment.all()
    const withTraits = allEquipment.find(
      (e) => 'traits' in e && Array.isArray(e.traits) && e.traits.length > 0
    )
    if (!withTraits) return
    const refs = [makeRef('equipment', withTraits.id)]
    const result = getPilotTraits(refs)
    for (const trait of result) {
      expect(trait).toBe(trait.toLowerCase())
    }
  })
})
