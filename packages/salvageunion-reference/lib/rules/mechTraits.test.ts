/**
 * Mech traits derived from an installed loadout (ADR-029).
 *
 * Bio-Wings says "Your Mech gains the Fly Trait" — a trait belonging to the
 * MECH, not to the system that granted it. Nothing aggregated a mech's traits
 * before, which is why the blocker was never "a place to declare effects" but
 * the missing `target` plus this derivation.
 */

import { beforeAll, describe, expect, it } from 'bun:test'

import { SalvageUnionReference } from '../index.js'
import { mechTraits } from './mechTraits.js'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

describe('mechTraits', () => {
  it('grants the host mech a trait from a real installed system', () => {
    const traits = mechTraits({ systems: ['Bio-Wings'], modules: [] })
    expect(traits.map((t) => t.name)).toContain('Fly')
  })

  it('attributes the trait to the item that granted it', () => {
    const [fly] = mechTraits({ systems: ['Bio-Wings'], modules: [] })
    expect(fly?.source).toBe('Bio-Wings')
    expect(fly?.ref).toBe('Bio-Wings')
  })

  it('a bare loadout has no traits', () => {
    expect(mechTraits({ systems: [], modules: [] })).toEqual([])
  })

  it('an unresolvable ref grants nothing rather than throwing', () => {
    expect(mechTraits({ systems: ['no-such-system'], modules: [] })).toEqual([])
  })

  it('does NOT collect self-targeted effects — those belong to the item, not the mech', () => {
    // Only `target: 'hostMech'` lands on the mech. A weapon whose own choice
    // adds Ballistic to ITSELF must not make the mech Ballistic.
    const traits = mechTraits({ systems: ['Cargo Pod'], modules: [] })
    expect(traits).toEqual([])
  })

  it('two copies of the same grant yield one trait, not two', () => {
    const traits = mechTraits({ systems: ['Bio-Wings', 'Bio-Wings'], modules: [] })
    expect(traits.filter((t) => t.name === 'Fly')).toHaveLength(1)
  })
})
