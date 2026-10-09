/**
 * The retired `Pilot.equipmentLoadouts` field (audit AP-18).
 *
 * The field is gone from the strict schema, but stored and exported pilots can
 * still carry it, so three things must hold or such a pilot stops parsing:
 *
 *  1. `normalizeLegacyPilotRecord` drops the key — and lifts it into
 *     `partners` first when the record has none, so loadouts are never
 *     silently lost.
 *  2. `StoredPilotSchema` — the Convex edge parse — accepts a row that still
 *     carries it.
 *  3. The pilots store heals a row it is handed (one cached from Convex)
 *     without falling back to salvage.
 */
import { describe, expect, spyOn, test } from 'bun:test'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { normalizeLegacyPilotRecord, PilotSchema, StoredPilotSchema } from '../../schemas/pilot'

const PARTNER = {
  id: 'partner-1',
  hostRef: 'survey-drone',
  hostSchema: 'equipment' as const,
  systems: [],
  modules: [],
  conditions: [],
}

/** A valid current pilot, plus whatever legacy keys a test layers on. */
function pilot(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pilot-1',
    schemaVersion: 1,
    name: 'Yara Voss',
    callsign: 'Ghost',
    classRef: 'scavenger',
    abilities: [],
    equipment: ['survey-drone'],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    currentHP: 10,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...over,
  }
}

/** A stored pilot whose loadouts were already lifted, the old key still on it. */
const liftedWithKey = () =>
  pilot({
    partners: [PARTNER],
    equipmentLoadouts: { 'survey-drone': { systems: [], modules: [] } },
  })

describe('normalizeLegacyPilotRecord', () => {
  test('drops the key and keeps the partners already lifted', () => {
    const next = normalizeLegacyPilotRecord(liftedWithKey())
    expect('equipmentLoadouts' in next).toBe(false)
    expect(next.partners).toEqual([PARTNER])
  })

  test('lifts a loadout with no partners into partners rather than losing it', () => {
    const next = normalizeLegacyPilotRecord(
      pilot({ equipmentLoadouts: { 'survey-drone': { systems: ['s-1'], modules: [] } } })
    )
    expect('equipmentLoadouts' in next).toBe(false)
    expect(next.partners).toMatchObject([
      { hostRef: 'survey-drone', hostSchema: 'equipment', systems: ['s-1'] },
    ])
    expect(PilotSchema.safeParse(next).success).toBe(true)
  })

  test('still drops the vestigial rollResults', () => {
    expect('rollResults' in normalizeLegacyPilotRecord(pilot({ rollResults: [] }))).toBe(false)
  })

  test('returns a current record as-is', () => {
    const current = pilot()
    expect(normalizeLegacyPilotRecord(current)).toBe(current)
  })
})

describe('the strict schema and the stored-body parser', () => {
  test('PilotSchema no longer accepts the key', () => {
    expect(PilotSchema.safeParse(liftedWithKey()).success).toBe(false)
  })

  test('StoredPilotSchema accepts a row stored before the removal, and strips it', () => {
    const parsed = StoredPilotSchema.safeParse(liftedWithKey())
    expect(parsed.success).toBe(true)
    if (parsed.success) expect('equipmentLoadouts' in parsed.data).toBe(false)
  })
})

describe('the pilots store heals a row it is handed', () => {
  test('put() caches a Convex row that still carries the key, without salvage', async () => {
    const { pilots } = await import('../index')
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const cached = await pilots.put(liftedWithKey() as never)
      expect('equipmentLoadouts' in cached).toBe(false)
      expect(cached.partners).toEqual([PARTNER])
      // Healed by the store's normaliser, not rescued by the salvage path.
      expect(warn).not.toHaveBeenCalled()
      await pilots.delete('pilot-1')
    } finally {
      warn.mockRestore()
    }
  })
})
