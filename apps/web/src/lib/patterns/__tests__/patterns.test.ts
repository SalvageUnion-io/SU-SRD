import { describe, expect, test } from 'bun:test'
import { MechPatternSchema } from 'game-domain/schemas/pattern'
import { FIXTURE_NOW, mechFixture } from '../../../components/__tests__/fixtures'
import {
  asReferencePattern,
  loadoutSlots,
  mechFromPattern,
  patternCopy,
  patternFromMech,
  patternLoadout,
  savedPatternHref,
} from '../patterns'

/**
 * Saved mech patterns: what a pattern keeps of a mech, and what a mech
 * built from one starts as.
 */

const towRig = MechPatternSchema.parse({
  id: 'pat-tow-rig',
  schemaVersion: 1,
  name: 'Tow Rig',
  chassisRef: 'scrapper',
  systems: ['rigging-arm', 'transport-hold'],
  modules: ['comms-module'],
  notes: 'Rig first, rivet later.',
  createdAt: FIXTURE_NOW,
})

describe('saving a mech as a pattern', () => {
  test('keeps the chassis and loadout, and leaves cargo, Damage and Heat on the mech', () => {
    const mech = mechFixture({
      id: 'm1',
      chassisRef: 'scrapper',
      systems: ['rigging-arm'],
      modules: ['comms-module'],
      currentSP: 2,
      currentHeat: 5,
      cargoLots: [
        { id: 'lot-1', kind: 'unit', name: 'scrap', cat: 'SEALED', units: 2, code: 'SCR' },
      ],
    })
    const input = patternFromMech(mech, { name: '  Tow Rig ', notes: '  Hauls wrecks. ' })

    expect(input).toEqual({
      schemaVersion: 1,
      name: 'Tow Rig',
      chassisRef: 'scrapper',
      systems: ['rigging-arm'],
      modules: ['comms-module'],
      notes: 'Hauls wrecks.',
    })
  })

  test('blank notes are no notes', () => {
    const input = patternFromMech(mechFixture({ id: 'm2' }), { name: 'Bare', notes: '   ' })
    expect('notes' in input).toBe(false)
  })
})

describe('building a mech from a pattern', () => {
  test('starts fresh — SP, EP and Heat unset, an empty hold — and records its source', () => {
    const input = mechFromPattern(towRig)
    expect(input).toMatchObject({
      name: 'Tow Rig',
      chassisRef: 'scrapper',
      systems: ['rigging-arm', 'transport-hold'],
      modules: ['comms-module'],
      cargoLots: [],
      conditions: [],
      sourcePattern: 'pat-tow-rig',
    })
    expect(input).not.toHaveProperty('currentSP')
    expect(input).not.toHaveProperty('currentEP')
    expect(input).not.toHaveProperty('currentHeat')
  })

  test('copies the loadout rather than sharing the arrays', () => {
    const input = mechFromPattern(towRig)
    expect(input.systems).not.toBe(towRig.systems)
  })
})

describe('copying a pattern to your Training Bay', () => {
  test('is the same pattern under a new id, minted on create', () => {
    const copy = patternCopy(towRig)
    expect('id' in copy).toBe(false)
    expect('createdAt' in copy).toBe(false)
    expect(copy).toMatchObject({ name: 'Tow Rig', notes: 'Rig first, rivet later.' })
  })
})

describe('a pattern in the reference shapes', () => {
  test('resolves its loadout by slug and counts its slots', () => {
    const { systems, modules } = patternLoadout(towRig)
    expect(systems.map((s) => s.name)).toEqual(['Rigging Arm', 'Transport Hold'])
    expect(modules.map((m) => m.name)).toEqual(['Comms Module'])
    expect(loadoutSlots(towRig)).toMatchObject({ systemSlotsUsed: 4, moduleSlotsUsed: 1 })
  })

  test("a multi-headed chassis's budget counts its heads, as the sheet does (Cerberus)", () => {
    const bare = loadoutSlots({ chassisRef: 'cerberus', systems: [], modules: [] })
    expect(bare.systemSlotsMax).toBeGreaterThan(5)
  })

  test('renders as a reference pattern, by name', () => {
    expect(asReferencePattern(towRig)).toEqual({
      name: 'Tow Rig',
      systems: [{ name: 'Rigging Arm' }, { name: 'Transport Hold' }],
      modules: [{ name: 'Comms Module' }],
    })
  })

  test('lives at /p/pattern/:id', () => {
    expect(savedPatternHref('pat-tow-rig')).toBe('/p/pattern/pat-tow-rig')
  })
})
