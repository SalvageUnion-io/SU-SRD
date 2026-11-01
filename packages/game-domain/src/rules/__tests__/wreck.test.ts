import { describe, expect, it } from 'bun:test'
import { wreckOf } from '../wreck'

describe('wreckOf (Core Book p.246)', () => {
  it('a Vehicle or a Drone scraps for its Salvage Value in Scrap of its Tech Level', () => {
    const unit = { name: 'Box', techLevel: 2, salvageValue: 3 }
    expect(wreckOf('vehicles', unit, [])).toEqual({ kind: 'scrap', techLevel: 2, salvageValue: 3 })
    expect(wreckOf('drones', unit, [])).toEqual({ kind: 'scrap', techLevel: 2, salvageValue: 3 })
  })

  it('leaves nothing with no Tech 1-6, no Salvage Value, or nothing to scrap', () => {
    expect(wreckOf('drones', { techLevel: 'B', salvageValue: 3 }, [])).toBeNull()
    expect(wreckOf('vehicles', { techLevel: 2, salvageValue: 0 }, [])).toBeNull()
    expect(wreckOf('meld', { salvageValue: 1 }, [])).toBeNull()
    expect(wreckOf('vehicles', null, [])).toBeNull()
  })

  it('a Mech leaves its Chassis and what its pattern mounted', () => {
    const wreck = wreckOf('chassis', { name: 'Mule', techLevel: 1, salvageValue: 4 }, [
      { kind: 'system', name: 'Floodlights', item: { techLevel: 1, salvageValue: 1 } },
    ])
    expect(wreck?.kind).toBe('mech')
    expect(wreck?.kind === 'mech' && wreck.parts.map((p) => p.kind)).toEqual(['chassis', 'system'])
  })
})
