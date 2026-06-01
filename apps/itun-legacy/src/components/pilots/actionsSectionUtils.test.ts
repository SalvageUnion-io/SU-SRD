import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  computeDisabledReason,
  actionSortTier,
  sortActions,
  findTraitEntity,
} from './actionsSectionUtils'
import type { ActionDisplayData } from '../../lib/pilotActionUtils'
import type { PilotRow } from '../../types/common'

function makePilot(overrides: Partial<PilotRow> = {}): PilotRow {
  return {
    id: 'p',
    user_id: 'u',
    callsign: 'T',
    class_ref: 'c',
    hp: 6,
    max_hp: 6,
    ap: 4,
    max_ap: 4,
    tp: 0,
    is_boarded: false,
    in_downtime: false,
    visible: true,
    mech_id: null,
    crawler_id: null,
    created_at: '',
    background: null,
    motto: null,
    keepsake: null,
    appearance: null,
    image_path: null,
    ...overrides,
  } as PilotRow
}
function makeAction(o: Partial<ActionDisplayData> = {}): ActionDisplayData {
  return {
    key: 'k',
    name: 'N',
    actionType: 'Turn',
    activationCost: 1,
    costType: 'ap',
    source: 'pilot',
    borderColor: 'o',
    entityRefId: null,
    condition: 'intact',
    hasDamage: false,
    isComrade: false,
    requiredTraits: [],
    maxUses: null,
    usesRemaining: null,
    destroyOnUse: false,
    actionName: 'N',
    ...o,
  } as ActionDisplayData
}

describe('computeDisabledReason', () => {
  test('destroyed', () => {
    expect(
      computeDisabledReason(
        makeAction({ condition: 'destroyed' }),
        makePilot(),
        null,
        new Set(),
        new Set()
      )
    ).toBe('System Destroyed')
  })
  test('enough AP', () => {
    expect(
      computeDisabledReason(makeAction(), makePilot({ ap: 4 }), null, new Set(), new Set())
    ).toBeNull()
  })
  test('no mech', () => {
    expect(
      computeDisabledReason(
        makeAction({ source: 'mech', isComrade: false }),
        makePilot(),
        null,
        new Set(),
        new Set()
      )
    ).toBe('No mech')
  })
})
describe('actionSortTier', () => {
  test('active=0', () => {
    expect(
      actionSortTier(
        makeAction(),
        () => true,
        false,
        makePilot({ ap: 4 }),
        null,
        new Set(),
        new Set()
      )
    ).toBe(0)
  })
  test('disabled=1', () => {
    expect(
      actionSortTier(
        makeAction({ condition: 'destroyed' }),
        () => true,
        false,
        makePilot(),
        null,
        new Set(),
        new Set()
      )
    ).toBe(1)
  })
  test('unmatched=2', () => {
    expect(
      actionSortTier(makeAction(), () => false, true, makePilot(), null, new Set(), new Set())
    ).toBe(2)
  })
})
describe('sortActions', () => {
  test('tier then alpha', () => {
    const s = sortActions(
      [
        makeAction({ key: 'z', name: 'Z' }),
        makeAction({ key: 'b', name: 'B', condition: 'destroyed' }),
        makeAction({ key: 'a', name: 'A' }),
      ],
      () => true,
      false,
      makePilot({ ap: 4 }),
      null,
      new Set(),
      new Set()
    )
    expect(s[0]!.name).toBe('A')
    expect(s[1]!.name).toBe('Z')
    expect(s[2]!.name).toBe('B')
  })
})
describe('findTraitEntity', () => {
  test('finds trait', () => {
    const t = SalvageUnionReference.Traits.all()
    if (t.length) {
      const r = findTraitEntity(t[0]!.name.toLowerCase())
      expect(r).not.toBeNull()
    }
  })
  test('returns null for missing', () => {
    expect(findTraitEntity('XYZXYZ')).toBeNull()
  })
})
