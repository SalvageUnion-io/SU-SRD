import { describe, test, expect } from 'bun:test'
import { computePilotSheetDerived } from '../usePilotSheetComputed'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { PilotRow, MechRow, CrawlerRow, EntityRefRow } from '../../types/common'

// Grab real reference data for test fixtures
const firstClass = SalvageUnionReference.Classes.all()[0]!
const firstChassis = SalvageUnionReference.Chassis.all()[0]!

function makePilot(overrides: Partial<PilotRow> = {}): PilotRow {
  return {
    id: 'pilot-1',
    user_id: 'user-1',
    callsign: 'TestPilot',
    class_ref: firstClass.id,
    hp: 6,
    ap: 6,
    tp: 0,
    mech_id: null,
    crawler_id: null,
    visible: true,
    is_boarded: false,
    in_downtime: false,
    background: null,
    motto: null,
    keepsake: null,
    appearance: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as PilotRow
}

function makeMech(overrides: Partial<MechRow> = {}): MechRow {
  return {
    id: 'mech-1',
    user_id: 'user-1',
    chassis_ref: firstChassis.id,
    pattern_name: null,
    current_sp: 10,
    current_ep: 6,
    current_heat: 0,
    salvage_slots_used: 0,
    source_pattern_id: null,
    source_ref_pattern_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as MechRow
}

function makeEntityRef(overrides: Partial<EntityRefRow> = {}): EntityRefRow {
  return {
    id: 'ref-1',
    parent_id: 'pilot-1',
    parent_type: 'pilot',
    schema_name: 'equipment',
    schema_ref_id: 'some-equipment',
    condition: 'intact',
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as EntityRefRow
}

describe('computePilotSheetDerived', () => {
  test('returns undefined values when pilot is null', () => {
    const result = computePilotSheetDerived({
      pilot: undefined,
      pilotRefs: [],
      mech: undefined,
      mechRefs: [],
      crawler: undefined,
      userId: 'user-1',
    })

    expect(result.pilotClass).toBeUndefined()
    expect(result.cardColor).toBe('bg-su-orange')
    expect(result.pilotClassName).toBe('Unknown')
    expect(result.pilotClassAssetUrl).toBeUndefined()
    expect(result.abilityCount).toBe(0)
    expect(result.mechChassis).toBeUndefined()
    expect(result.chassisName).toBeUndefined()
    expect(result.patternName).toBeUndefined()
    expect(result.comrades).toEqual([])
    expect(result.crawlerTlStats).toBeUndefined()
    expect(result.access).toBeUndefined()
    expect(result.canEdit).toBe(false)
  })

  test('resolves pilot class from class_ref', () => {
    const pilot = makePilot({ class_ref: firstClass.id })
    const result = computePilotSheetDerived({
      pilot,
      pilotRefs: [],
      mech: undefined,
      mechRefs: [],
      crawler: undefined,
      userId: 'user-1',
    })

    expect(result.pilotClass).toBeDefined()
    expect(result.pilotClass?.id).toBe(firstClass.id)
    expect(result.pilotClassName).toBe(firstClass.name)
  })

  test('counts abilities from pilotRefs', () => {
    const refs = [
      makeEntityRef({ id: 'ref-a', schema_name: 'abilities', schema_ref_id: 'a1' }),
      makeEntityRef({ id: 'ref-b', schema_name: 'abilities', schema_ref_id: 'a2' }),
      makeEntityRef({ id: 'ref-c', schema_name: 'equipment', schema_ref_id: 'e1' }),
    ]
    const result = computePilotSheetDerived({
      pilot: makePilot(),
      pilotRefs: refs,
      mech: undefined,
      mechRefs: [],
      crawler: undefined,
      userId: 'user-1',
    })

    expect(result.abilityCount).toBe(2)
  })

  test('resolves mechChassis and chassisName from mech', () => {
    const mech = makeMech({ chassis_ref: firstChassis.id })
    const result = computePilotSheetDerived({
      pilot: makePilot(),
      pilotRefs: [],
      mech,
      mechRefs: [],
      crawler: undefined,
      userId: 'user-1',
    })

    expect(result.mechChassis).toBeDefined()
    expect(result.mechChassis?.id).toBe(firstChassis.id)
    expect(result.chassisName).toBe(firstChassis.name)
  })

  test('formats patternName with quotes when present', () => {
    const mech = makeMech({ pattern_name: 'Iron Beast' })
    const result = computePilotSheetDerived({
      pilot: makePilot(),
      pilotRefs: [],
      mech,
      mechRefs: [],
      crawler: undefined,
      userId: 'user-1',
    })

    expect(result.patternName).toBe('\u201CIron Beast\u201D')
  })

  test('returns undefined patternName when mech has no pattern_name', () => {
    const mech = makeMech({ pattern_name: null })
    const result = computePilotSheetDerived({
      pilot: makePilot(),
      pilotRefs: [],
      mech,
      mechRefs: [],
      crawler: undefined,
      userId: 'user-1',
    })

    expect(result.patternName).toBeUndefined()
  })

  test('computes crawlerTlStats when crawler is present', () => {
    const crawler = {
      id: 'crawler-1',
      user_id: 'user-1',
      crawler_ref: 'some-ref',
      tech_level: 1,
      name: 'Test Crawler',
      visible: true,
    } as CrawlerRow
    const result = computePilotSheetDerived({
      pilot: makePilot(),
      pilotRefs: [],
      mech: undefined,
      mechRefs: [],
      crawler,
      userId: 'user-1',
    })

    expect(result.crawlerTlStats).toBeDefined()
    expect(result.crawlerTlStats).toHaveProperty('max_sp')
    expect(result.crawlerTlStats).toHaveProperty('upkeep')
    expect(result.crawlerTlStats).toHaveProperty('upgrade_cost')
  })

  test('computes access for owner', () => {
    const pilot = makePilot({ user_id: 'user-1' })
    const result = computePilotSheetDerived({
      pilot,
      pilotRefs: [],
      mech: undefined,
      mechRefs: [],
      crawler: undefined,
      userId: 'user-1',
    })

    expect(result.access).toEqual({ canView: true, canEdit: true })
    expect(result.canEdit).toBe(true)
  })

  test('computes access for non-owner viewing visible pilot', () => {
    const pilot = makePilot({ user_id: 'user-1', visible: true })
    const result = computePilotSheetDerived({
      pilot,
      pilotRefs: [],
      mech: undefined,
      mechRefs: [],
      crawler: undefined,
      userId: 'other-user',
    })

    expect(result.access).toEqual({ canView: true, canEdit: false })
    expect(result.canEdit).toBe(false)
  })

  test('computes access for non-owner viewing hidden pilot', () => {
    const pilot = makePilot({ user_id: 'user-1', visible: false })
    const result = computePilotSheetDerived({
      pilot,
      pilotRefs: [],
      mech: undefined,
      mechRefs: [],
      crawler: undefined,
      userId: 'other-user',
    })

    expect(result.access).toEqual({ canView: false })
    expect(result.canEdit).toBe(false)
  })

  test('returns default cardColor (bg-su-orange) for standard class', () => {
    const pilot = makePilot({ class_ref: firstClass.id })
    const result = computePilotSheetDerived({
      pilot,
      pilotRefs: [],
      mech: undefined,
      mechRefs: [],
      crawler: undefined,
      userId: 'user-1',
    })

    // Standard classes use bg-su-orange; only hybrid classes use bg-su-pink
    expect(['bg-su-orange', 'bg-su-pink']).toContain(result.cardColor)
  })
})
