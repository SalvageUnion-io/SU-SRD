import { describe, it, expect } from 'bun:test'
import {
  isRestoreComplete,
  computeMechRestoreUpdate,
  computePilotRestoreUpdate,
  computePilotRestoreWithInjuries,
  findRepairableRefs,
} from './restoreUtils'
import type { RestoreReceipt } from './restoreUtils'
import type { MechRow, PilotRow, EntityRefRow } from '../types/common'
import type { PilotInjury } from './injuryUtils'

function makeMech(overrides: Partial<MechRow> = {}): MechRow {
  return {
    id: 'mech-1',
    user_id: 'user-1',
    chassis_ref: 'iron-mongrel',
    max_sp: 20,
    current_sp: 8,
    max_ep: 6,
    current_ep: 2,
    heat_capacity: 6,
    current_heat: 4,
    cargo_capacity: 4,
    pattern_name: null,
    source_pattern_id: null,
    source_ref_pattern_id: null,
    image_path: null,
    notes: null,
    active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as MechRow
}

function makePilot(overrides: Partial<PilotRow> = {}): PilotRow {
  return {
    id: 'pilot-1',
    user_id: 'user-1',
    callsign: 'Ace',
    class_ref: 'salvager',
    max_hp: 8,
    hp: 3,
    max_ap: 4,
    ap: 1,
    tp: 0,
    crawler_id: null,
    mech_id: null,
    in_downtime: true,
    is_boarded: false,
    active: true,
    visible: true,
    appearance: null,
    background: null,
    background_used: null,
    keepsake: null,
    keepsake_used: null,
    motto: null,
    motto_used: null,
    image_path: null,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as PilotRow
}

function makeEntityRef(overrides: Partial<EntityRefRow> = {}): EntityRefRow {
  return {
    id: 'ref-1',
    parent_id: 'mech-1',
    parent_type: 'mech',
    schema_name: 'systems',
    schema_ref_id: 'autocannon',
    condition: 'intact',
    sort_order: 0,
    metadata: null,
    user_id: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as EntityRefRow
}

describe('isRestoreComplete', () => {
  it('returns false for undefined receipt', () => {
    expect(isRestoreComplete(undefined)).toBe(false)
  })

  it('returns false when only mech is restored', () => {
    const receipt: RestoreReceipt = {
      mech_restored: true,
      pilot_restored: false,
      items_repaired: 0,
      comrades_healed: 0,
    }
    expect(isRestoreComplete(receipt)).toBe(false)
  })

  it('returns false when only pilot is restored', () => {
    const receipt: RestoreReceipt = {
      mech_restored: false,
      pilot_restored: true,
      items_repaired: 0,
      comrades_healed: 0,
    }
    expect(isRestoreComplete(receipt)).toBe(false)
  })

  it('returns true when both are restored', () => {
    const receipt: RestoreReceipt = {
      mech_restored: true,
      pilot_restored: true,
      items_repaired: 3,
      comrades_healed: 1,
    }
    expect(isRestoreComplete(receipt)).toBe(true)
  })
})

describe('computeMechRestoreUpdate', () => {
  it('restores SP to max, EP to max, heat to 0', () => {
    const mech = makeMech({ current_sp: 5, max_sp: 20, current_ep: 1, max_ep: 6, current_heat: 4 })
    const update = computeMechRestoreUpdate(mech)
    expect(update).toEqual({
      current_sp: 20,
      current_ep: 6,
      current_heat: 0,
    })
  })

  it('handles already-maxed mech', () => {
    const mech = makeMech({
      current_sp: 20,
      max_sp: 20,
      current_ep: 6,
      max_ep: 6,
      current_heat: 0,
    })
    const update = computeMechRestoreUpdate(mech)
    expect(update).toEqual({
      current_sp: 20,
      current_ep: 6,
      current_heat: 0,
    })
  })
})

describe('computePilotRestoreUpdate', () => {
  it('restores HP to max, AP to max', () => {
    const pilot = makePilot({ hp: 3, max_hp: 8, ap: 1, max_ap: 4 })
    const update = computePilotRestoreUpdate(pilot)
    expect(update).toEqual({
      hp: 8,
      ap: 4,
      keepsake_used: false,
      background_used: false,
      motto_used: false,
    })
  })

  it('resets keepsake_used, background_used, motto_used to false', () => {
    const pilot = makePilot({
      keepsake_used: true,
      background_used: true,
      motto_used: true,
    })
    const update = computePilotRestoreUpdate(pilot)
    expect(update.keepsake_used).toBe(false)
    expect(update.background_used).toBe(false)
    expect(update.motto_used).toBe(false)
  })

  it('resets used flags even when they were null', () => {
    const pilot = makePilot({
      keepsake_used: null,
      background_used: null,
      motto_used: null,
    })
    const update = computePilotRestoreUpdate(pilot)
    expect(update.keepsake_used).toBe(false)
    expect(update.background_used).toBe(false)
    expect(update.motto_used).toBe(false)
  })
})

describe('computePilotRestoreWithInjuries', () => {
  const minor: PilotInjury = { severity: 'minor', maxHpReduction: 1 }
  const major: PilotInjury = { severity: 'major', maxHpReduction: 2 }

  it('heals minor injury at TL 3, restores max_hp', () => {
    const pilot = makePilot({ max_hp: 7, hp: 7, max_ap: 4, ap: 4 })
    const result = computePilotRestoreWithInjuries(pilot, [minor], 3)
    expect(result.healedInjuryCount).toBe(1)
    expect(result.remainingInjuries).toEqual([])
    expect(result.update.max_hp).toBe(8)
    expect(result.update.hp).toBe(8)
  })

  it('does not heal minor injury below TL 3, no max_hp in update', () => {
    const pilot = makePilot({ max_hp: 7, hp: 7, max_ap: 4, ap: 4 })
    const result = computePilotRestoreWithInjuries(pilot, [minor], 2)
    expect(result.healedInjuryCount).toBe(0)
    expect(result.remainingInjuries).toEqual([minor])
    expect(result.update.max_hp).toBeUndefined()
    expect(result.update.hp).toBe(7)
  })

  it('heals major injury at TL 5', () => {
    const pilot = makePilot({ max_hp: 6, hp: 6, max_ap: 4, ap: 4 })
    const result = computePilotRestoreWithInjuries(pilot, [major], 5)
    expect(result.healedInjuryCount).toBe(1)
    expect(result.update.max_hp).toBe(8)
    expect(result.update.hp).toBe(8)
  })

  it('with no injuries, max_hp is absent from update', () => {
    const pilot = makePilot({ max_hp: 8, hp: 3, max_ap: 4, ap: 1 })
    const result = computePilotRestoreWithInjuries(pilot, [], 5)
    expect(result.healedInjuryCount).toBe(0)
    expect(result.update.max_hp).toBeUndefined()
    expect(result.update.hp).toBe(8)
  })

  it('resets one-time re-roll flags', () => {
    const pilot = makePilot({
      keepsake_used: true,
      background_used: true,
      motto_used: true,
    })
    const result = computePilotRestoreWithInjuries(pilot, [], 3)
    expect(result.update.keepsake_used).toBe(false)
    expect(result.update.background_used).toBe(false)
    expect(result.update.motto_used).toBe(false)
  })
})

describe('findRepairableRefs', () => {
  it('returns empty for no damaged refs', () => {
    const refs = [makeEntityRef({ condition: 'intact' })]
    expect(findRepairableRefs(refs, 3)).toEqual([])
  })

  it('skips destroyed refs', () => {
    const refs = [makeEntityRef({ condition: 'destroyed', id: 'ref-destroyed' })]
    expect(findRepairableRefs(refs, 3)).toEqual([])
  })

  it('returns empty for empty refs array', () => {
    expect(findRepairableRefs([], 3)).toEqual([])
  })

  it('repairs damaged refs whose resolved entity has numeric TL <= crawlerTL', () => {
    // .50 Cal Machine Gun is TL1
    const refs = [
      makeEntityRef({
        id: 'ref-damaged',
        condition: 'damaged',
        schema_name: 'systems',
        schema_ref_id: '418deda4-ab48-4bc4-a527-d56f4d77746e',
      }),
    ]
    const result = findRepairableRefs(refs, 1)
    expect(result).toEqual(['ref-damaged'])
  })

  it('skips damaged refs whose TL exceeds crawlerTL', () => {
    // 120mm Cannon is TL3
    const refs = [
      makeEntityRef({
        id: 'ref-high-tl',
        condition: 'damaged',
        schema_name: 'systems',
        schema_ref_id: '104ef3b1-64b7-4617-85bd-b2960a3e7142',
      }),
    ]
    const result = findRepairableRefs(refs, 2)
    expect(result).toEqual([])
  })

  it('skips refs that cannot be resolved', () => {
    const refs = [
      makeEntityRef({
        id: 'ref-unknown',
        condition: 'damaged',
        schema_name: 'systems',
        schema_ref_id: 'does-not-exist-xyz',
      }),
    ]
    expect(findRepairableRefs(refs, 5)).toEqual([])
  })
})
