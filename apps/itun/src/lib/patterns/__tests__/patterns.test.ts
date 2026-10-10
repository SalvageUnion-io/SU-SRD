import { describe, expect, test } from 'bun:test'
import { FIXTURE_NOW, mechFixture } from '../../../components/__tests__/fixtures'
import { MechPatternSchema } from '../../schemas/pattern'
import {
  asReferencePattern,
  mechFromPattern,
  patternCopy,
  patternFromMech,
  patternHref,
  patternLoadout,
  slotsUsed,
} from '../patterns'

/**
 * Saved mech patterns (issue 1276): what a pattern keeps of a mech, and what a mech
 * built from one starts as.
 */

const towRig = MechPatternSchema.parse({
  id: 'pat-tow-rig',
  schemaVersion: 1,
  name: 'Tow Rig',
  chassisRef: 'scrapper',
  systems: ['rigging-arm', 'transport-hold'],
  modules: ['comms-module'],
  cargoLots: [],
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
      cargoLots: [],
      notes: 'Hauls wrecks.',
    })
  })

  test('blank notes are no notes', () => {
    const input = patternFromMech(mechFixture({ id: 'm2' }), { name: 'Bare', notes: '   ' })
    expect('notes' in input).toBe(false)
  })
})

describe('building a mech from a pattern', () => {
  test('starts fresh — full SP and EP, Heat 0, an empty hold — and records its source', () => {
    const input = mechFromPattern(towRig)
    expect(input).toMatchObject({
      name: 'Tow Rig',
      patternName: 'Tow Rig',
      chassisRef: 'scrapper',
      systems: ['rigging-arm', 'transport-hold'],
      modules: ['comms-module'],
      cargoLots: [],
      conditions: [],
      currentHeat: 0,
      sourcePattern: 'pat-tow-rig',
    })
    expect(input.currentSP).toBe(9)
    expect(input.currentEP).toBe(9)
  })

  test('copies the loadout rather than sharing the arrays', () => {
    const input = mechFromPattern(towRig)
    expect(input.systems).not.toBe(towRig.systems)
  })
})

describe('copying a pattern to your shelf', () => {
  test('is the same pattern under a new id, minted by the db layer', () => {
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
    expect(slotsUsed(systems)).toBe(4)
    expect(slotsUsed(modules)).toBe(1)
  })

  test('renders as a reference pattern, by name', () => {
    expect(asReferencePattern(towRig)).toEqual({
      name: 'Tow Rig',
      systems: [{ name: 'Rigging Arm' }, { name: 'Transport Hold' }],
      modules: [{ name: 'Comms Module' }],
    })
  })

  test('lives at /p/pattern/:id', () => {
    expect(patternHref('pat-tow-rig')).toBe('/p/pattern/pat-tow-rig')
  })
})
