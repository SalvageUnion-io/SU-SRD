/**
 * A partner is a projection of its grant, and every interesting case here is one
 * where that projection is NOT one-to-one:
 *
 *   - Big Brother's DronTek pattern fields FOUR drones over ONE stat block, each
 *     under its own instance name. The bug this replaced read `drones[0]`.
 *   - A drone's integrated hardware lives on the stat block while its fitted
 *     loadout lives on the pattern, so the live drone's systems are the union of
 *     two different sources.
 *   - A Custom build has no pattern at all, but the CHASSIS ABILITY still grants
 *     the drone — a Little Sestra without a pattern is still a Little Sestra.
 *
 * The reconciliation tests pin the property that matters most in play: a drone
 * that survives an edit keeps its damage. Re-seeding a mech's drones on a
 * pattern change is correct; re-seeding their structure is data loss.
 */

import { describe, expect, test } from 'bun:test'
import type { PartnerInstance } from '../../schemas/partner'
import {
  isPartnerEquipment,
  mechPartnerSeeds,
  pilotPartnerSeeds,
  syncPartners,
} from '../partnerGrants'

/** Deterministic ids so a reconciliation result can be asserted whole. */
const mintSequential = () => {
  let n = 0
  return () => `new-${++n}`
}

describe('mechPartnerSeeds — the chassis ability grants, the pattern kits', () => {
  test('Little Sestra / Surveyor: one drone, integrated system PLUS pattern loadout', () => {
    const seeds = mechPartnerSeeds('little-sestra', 'Surveyor')
    expect(seeds).toHaveLength(1)
    const [drone] = seeds
    expect(drone?.hostRef).toBe('sestra-drone')
    expect(drone?.hostSchema).toBe('drones')
    // The config names the stat block directly, so no instance name.
    expect(drone?.name).toBeUndefined()
    // Integrated first, then the pattern's three picks.
    expect(drone?.systems).toEqual([
      'hover-locomotion-system',
      'long-barrelled-green-laser',
      'high-gain-antenna',
      'cargo-pod',
    ])
    expect(drone?.modules).toEqual(['survey-scanner', 'm315-motion-scanner'])
  })

  test('a Custom build still gets the drone the chassis ability grants, bare', () => {
    const seeds = mechPartnerSeeds('little-sestra', '')
    expect(seeds).toHaveLength(1)
    expect(seeds[0]?.hostRef).toBe('sestra-drone')
    // Integrated hardware only — nothing was fitted.
    expect(seeds[0]?.systems).toEqual(['hover-locomotion-system'])
    expect(seeds[0]?.modules).toEqual([])
  })

  test('Big Brother / DronTek: FOUR drones, one stat block, four instance names', () => {
    const seeds = mechPartnerSeeds('big-brother', 'DronTek')
    expect(seeds).toHaveLength(4)
    expect(seeds.map((s) => s.name)).toEqual([
      'Shield Drone',
      'Anti-Missile Drone',
      'Fire Support Drone',
      'Minelayer Drone',
    ])
    // All four ride the same stat block — that is what `ref` is for.
    expect(new Set(seeds.map((s) => s.hostRef))).toEqual(new Set(['big-brother-drone']))
    expect(seeds[0]?.systems).toEqual([
      'hover-locomotion-system',
      'refractive-shield-projector',
      'electro-magnetic-shield-projector',
    ])
    expect(seeds[0]?.modules).toEqual(['energy-cell'])
  })

  test('a chassis with no drone-granting ability grants nothing', () => {
    expect(mechPartnerSeeds('bad-penny', 'Hauler')).toEqual([])
  })

  test('an unresolvable chassis returns [] rather than throwing', () => {
    expect(mechPartnerSeeds('no-such-chassis', 'Whatever')).toEqual([])
  })
})

describe('pilotPartnerSeeds — equipment carrying a stat block is a partner', () => {
  test('the three partner equipment records are recognised', () => {
    expect(isPartnerEquipment('auto-turret')).toBe(true)
    expect(isPartnerEquipment('survey-drone')).toBe(true)
    expect(isPartnerEquipment('mecha-companion')).toBe(true)
  })

  test('ordinary gear is not', () => {
    expect(isPartnerEquipment('cutting-torch')).toBe(false)
    expect(isPartnerEquipment('no-such-equipment')).toBe(false)
  })

  test('seeds one bare partner per granting slug, ignoring ordinary gear', () => {
    const seeds = pilotPartnerSeeds(['cutting-torch', 'survey-drone', 'auto-turret'])
    expect(seeds.map((s) => s.hostRef)).toEqual(['survey-drone', 'auto-turret'])
    expect(seeds.every((s) => s.hostSchema === 'equipment')).toBe(true)
    // Pilot partners arrive empty; a mech's arrives wearing its pattern.
    expect(seeds.every((s) => s.systems.length === 0 && s.modules.length === 0)).toBe(true)
  })
})

describe('syncPartners — the grant is the lifecycle', () => {
  const existing = (over: Partial<PartnerInstance>): PartnerInstance => ({
    id: 'p1',
    hostRef: 'sestra-drone',
    hostSchema: 'drones',
    systems: [],
    modules: [],
    conditions: [],
    ...over,
  })

  test('a host with no grant and no partners stays absent, not an empty array', () => {
    expect(syncPartners(undefined, [])).toBeUndefined()
  })

  test('losing the grant clears the field to [] so the write actually lands', () => {
    expect(syncPartners([existing({})], [])).toEqual([])
  })

  test('a new grant mints an instance carrying its seed loadout', () => {
    const [drone] = syncPartners(undefined, mechPartnerSeeds('little-sestra', 'Surveyor'), {
      exact: true,
      mintId: mintSequential(),
    }) as PartnerInstance[]
    expect(drone?.id).toBe('new-1')
    expect(drone?.hostRef).toBe('sestra-drone')
    expect(drone?.systems).toContain('long-barrelled-green-laser')
    expect(drone?.conditions).toEqual([])
  })

  test('EXACT: a surviving drone keeps its live state but re-cuts its loadout', () => {
    const damaged = existing({
      id: 'keep-me',
      name: 'Custos',
      currentSP: 2,
      currentHeat: 3,
      conditions: ['jammed'],
      systems: ['hover-locomotion-system', 'long-barrelled-green-laser'],
    })
    const [drone] = syncPartners([damaged], mechPartnerSeeds('little-sestra', 'Scrounger'), {
      exact: true,
    }) as PartnerInstance[]

    // Identity and damage survive the pattern change...
    expect(drone?.id).toBe('keep-me')
    expect(drone?.name).toBe('Custos')
    expect(drone?.currentSP).toBe(2)
    expect(drone?.currentHeat).toBe(3)
    expect(drone?.conditions).toEqual(['jammed'])
    // ...but the loadout is the NEW pattern's, exactly as the mech's own is.
    expect(drone?.systems).toEqual([
      'hover-locomotion-system',
      'red-laser',
      'fabrication-arm',
      'high-gain-antenna',
    ])
  })

  test('EXACT: named instances match by name, so Big Brother keeps four distinct drones', () => {
    const seeds = mechPartnerSeeds('big-brother', 'DronTek')
    const first = syncPartners(undefined, seeds, {
      exact: true,
      mintId: mintSequential(),
    }) as PartnerInstance[]
    const damaged = first.map((p) => (p.name === 'Minelayer Drone' ? { ...p, currentSP: 1 } : p))

    const second = syncPartners(damaged, seeds, { exact: true }) as PartnerInstance[]
    expect(second.map((p) => p.id)).toEqual(first.map((p) => p.id))
    expect(second.find((p) => p.name === 'Minelayer Drone')?.currentSP).toBe(1)
    // The other three were never touched.
    expect(second.filter((p) => p.currentSP !== undefined)).toHaveLength(1)
  })

  test('EXACT: a chassis swap drops the drone the new chassis does not grant', () => {
    const result = syncPartners([existing({})], mechPartnerSeeds('bad-penny', 'Hauler'), {
      exact: true,
    })
    expect(result).toEqual([])
  })

  test('ADDITIVE: a surplus partner of a still-granted stat block survives', () => {
    // Mecha Packmaster fields two Mecha Companions off ONE equipment slug, so
    // the seed count can legitimately understate the roster.
    const two = [
      existing({ id: 'a', hostRef: 'mecha-companion', hostSchema: 'equipment' }),
      existing({ id: 'b', hostRef: 'mecha-companion', hostSchema: 'equipment' }),
    ]
    const result = syncPartners(two, pilotPartnerSeeds(['mecha-companion'])) as PartnerInstance[]
    expect(result.map((p) => p.id).sort()).toEqual(['a', 'b'])
  })

  test('ADDITIVE: unequipping the granting item still takes every instance with it', () => {
    const two = [
      existing({ id: 'a', hostRef: 'mecha-companion', hostSchema: 'equipment' }),
      existing({ id: 'b', hostRef: 'mecha-companion', hostSchema: 'equipment' }),
    ]
    expect(syncPartners(two, pilotPartnerSeeds([]))).toEqual([])
  })

  test('ADDITIVE: an existing partner never has its loadout rewritten', () => {
    const kitted = existing({
      hostRef: 'survey-drone',
      hostSchema: 'equipment',
      systems: ['red-laser'],
    })
    const [drone] = syncPartners([kitted], pilotPartnerSeeds(['survey-drone'])) as PartnerInstance[]
    expect(drone?.systems).toEqual(['red-laser'])
  })
})
