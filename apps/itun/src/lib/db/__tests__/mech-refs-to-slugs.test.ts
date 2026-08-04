/**
 * Unit tests for the v6 record rewrite (mech/pattern refs: names → slugs).
 * The full through-the-opener migration path is covered in migrations.test.ts;
 * these pin the pure rewrite semantics.
 */
import { describe, expect, test } from 'bun:test'
import { normalizeRefsRecord } from '../migrations/6-mech-refs-to-slugs'

describe('normalizeRefsRecord (v6 name → slug rewrite)', () => {
  test('slugifies chassisRef, systems, and modules', () => {
    const next = normalizeRefsRecord({
      chassisRef: 'Ghost Chassis',
      systems: ['Welding Rig', 'already-a-slug'],
      modules: ["Aardvark's Tongue"],
    })
    expect(next).toEqual({
      chassisRef: 'ghost-chassis',
      systems: ['welding-rig', 'already-a-slug'],
      modules: ['aardvarks-tongue'],
    })
  })

  test('re-keys systemConditions, moduleConditions, and itemUses', () => {
    const next = normalizeRefsRecord({
      systems: ['Welding Rig'],
      systemConditions: { 'Welding Rig': 'damaged' },
      moduleConditions: { 'Armor Plating': 'destroyed' },
      itemUses: { 'Welding Rig': 2 },
    })
    expect(next).toEqual({
      systems: ['welding-rig'],
      systemConditions: { 'welding-rig': 'damaged' },
      moduleConditions: { 'armor-plating': 'destroyed' },
      itemUses: { 'welding-rig': 2 },
    })
  })

  test('is a no-op (null) for records already in slug form', () => {
    expect(
      normalizeRefsRecord({
        chassisRef: 'ghost-chassis',
        systems: ['welding-rig'],
        modules: [],
        systemConditions: { 'welding-rig': 'damaged' },
      })
    ).toBeNull()
  })

  test('leaves empty refs and non-mech shapes untouched', () => {
    expect(normalizeRefsRecord({ chassisRef: '', systems: [], modules: [] })).toBeNull()
    expect(normalizeRefsRecord({ id: 'x', name: 'A Pilot-Like Record' })).toBeNull()
  })

  test('preserves unrelated fields verbatim on rewrite', () => {
    const next = normalizeRefsRecord({
      id: 'mech-1',
      chassisRef: 'Ghost Chassis',
      currentSP: 4,
      cargoLots: [{ id: 'lot-1' }],
    })
    expect(next).toMatchObject({ id: 'mech-1', currentSP: 4, cargoLots: [{ id: 'lot-1' }] })
  })
})
