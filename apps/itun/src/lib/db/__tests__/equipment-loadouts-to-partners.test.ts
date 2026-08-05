/**
 * Unit tests for the v11 record rewrite (equipmentLoadouts → partners).
 * The through-the-opener path is covered in migrations.test.ts; these pin the
 * pure rewrite semantics.
 *
 * The case that matters most is the LAST one: two Mecha Companions. ADR-023
 * keyed loadouts by equipment slug, so Mecha Packmaster's second companion had
 * nowhere to live. The migration cannot recover data that was never storable —
 * what it must do is give the surviving loadout an id, so that adding the
 * second companion afterwards is possible at all.
 */
import { describe, expect, test } from 'bun:test'
import { partnersFromLoadouts } from '../migrations/11-equipment-loadouts-to-partners'

let counter = 0
const stableId = (): string => `partner-${++counter}`

/** First element, asserted present — the rewrite returning null is its own test. */
const first = (rows: Record<string, unknown>[] | null): Record<string, unknown> => {
  if (!rows || rows.length === 0) throw new Error('expected at least one partner')
  return rows[0] as Record<string, unknown>
}
const reset = (): void => {
  counter = 0
}

describe('partnersFromLoadouts (v11 loadouts → partners)', () => {
  test('lifts a loadout into a partner instance with an id', () => {
    reset()
    const partners = partnersFromLoadouts(
      {
        equipmentLoadouts: {
          'survey-drone': { systems: ['high-gain-antenna'], modules: ['survey-scanner'] },
        },
      },
      stableId
    )
    expect(partners).toEqual([
      {
        id: 'partner-1',
        hostRef: 'survey-drone',
        hostSchema: 'equipment',
        systems: ['high-gain-antenna'],
        modules: ['survey-scanner'],
        conditions: [],
      },
    ])
  })

  test('pulls identity across from the parallel equipmentChoices map', () => {
    reset()
    const partner = first(
      partnersFromLoadouts(
        {
          equipmentLoadouts: { 'mecha-companion': { systems: [], modules: [] } },
          equipmentChoices: {
            'mecha-companion': {
              Name: ['Incitatus'],
              Appearance: ['An elongated mechanical snake.'],
              'A.I. Personality': ['Loyal'],
            },
          },
        },
        stableId
      )
    )
    expect(partner.name).toBe('Incitatus')
    expect(partner.appearance).toBe('An elongated mechanical snake.')
    expect(partner.aiPersonality).toBe('Loyal')
  })

  test('carries per-item condition and uses state onto the instance', () => {
    reset()
    const partner = first(
      partnersFromLoadouts(
        {
          equipmentLoadouts: {
            'auto-turret': {
              systems: ['red-laser'],
              modules: [],
              systemConditions: { 'red-laser': 'damaged' },
              moduleConditions: { 'energy-cell': 'destroyed' },
              itemUses: { 'red-laser': 2 },
            },
          },
        },
        stableId
      )
    )
    expect(partner.systemConditions).toEqual({ 'red-laser': 'damaged' })
    expect(partner.moduleConditions).toEqual({ 'energy-cell': 'destroyed' })
    expect(partner.itemUses).toEqual({ 'red-laser': 2 })
  })

  test('each loadout becomes its OWN partner with its own id', () => {
    reset()
    const partners = partnersFromLoadouts(
      {
        equipmentLoadouts: {
          'survey-drone': { systems: [], modules: [] },
          'mecha-companion': { systems: [], modules: [] },
        },
      },
      stableId
    ) as Record<string, unknown>[]
    expect(partners).toHaveLength(2)
    expect(new Set(partners.map((p) => p.id)).size).toBe(2)
    // This is the whole point: identity is now per-instance, so a SECOND
    // mecha-companion (Mecha Packmaster, Core Book p. 69) can coexist with the
    // first instead of overwriting its slug-keyed entry.
    expect(partners.map((p) => p.hostRef)).toEqual(['survey-drone', 'mecha-companion'])
  })

  test('is idempotent — a record that already has partners is left alone', () => {
    reset()
    expect(
      partnersFromLoadouts(
        {
          partners: [{ id: 'existing' }],
          equipmentLoadouts: { 'survey-drone': { systems: [], modules: [] } },
        },
        stableId
      )
    ).toBeNull()
  })

  test('is a no-op for records with no loadouts, and for non-pilot shapes', () => {
    reset()
    expect(partnersFromLoadouts({ equipmentLoadouts: {} }, stableId)).toBeNull()
    expect(partnersFromLoadouts({ id: 'x', name: 'A Pilot With No Drone' }, stableId)).toBeNull()
    expect(partnersFromLoadouts(null, stableId)).toBeNull()
    expect(partnersFromLoadouts('not a record', stableId)).toBeNull()
  })

  test('tolerates a malformed loadout entry rather than failing the pilot', () => {
    reset()
    const partners = partnersFromLoadouts(
      {
        equipmentLoadouts: {
          'survey-drone': 'not an object',
          'auto-turret': { systems: ['red-laser', 42], modules: null },
        },
      },
      stableId
    ) as Record<string, unknown>[]
    expect(partners).toHaveLength(1)
    const only = first(partners)
    expect(only.hostRef).toBe('auto-turret')
    // Non-string entries are dropped, not coerced.
    expect(only.systems).toEqual(['red-laser'])
    expect(only.modules).toEqual([])
  })
})
