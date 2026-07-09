/**
 * Unit tests for isWeaponSystem — the predicate that decides whether a crawler
 * System counts toward the Armament-Bay (weapons-system) cap.
 *
 * A system is a weapon iff one of its resolved actions deals damage. Verified
 * against real reference data so a schema/data shift that breaks the predicate
 * is caught here rather than silently mis-capping crawlers.
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from '../index.js'
import { isWeaponSystem } from './crawlerSystems.js'

beforeAll(async () => {
  await SalvageUnionReference.preload(['systems', 'actions'])
})

function systemByName(name: string) {
  const s = SalvageUnionReference.Systems.find((x) => x.name === name)
  if (!s) throw new Error(`system not found in reference data: ${name}`)
  return s
}

const WEAPON_SYSTEMS = ['.50 Cal Machine Gun', 'Chainsaw Arm', 'Mini Mortar']
const NON_WEAPON_SYSTEMS = ['Armour Plating', 'Cargo Pod', 'Locomotion System']

describe('isWeaponSystem', () => {
  for (const name of WEAPON_SYSTEMS) {
    it(`treats damage-dealing system "${name}" as a weapon`, () => {
      expect(isWeaponSystem(systemByName(name))).toBe(true)
    })
  }

  for (const name of NON_WEAPON_SYSTEMS) {
    it(`treats non-damage system "${name}" as a non-weapon`, () => {
      expect(isWeaponSystem(systemByName(name))).toBe(false)
    })
  }

  it('only some systems are weapons (sanity: dataset has a mix)', () => {
    const all = SalvageUnionReference.Systems.all()
    const weapons = all.filter(isWeaponSystem)
    expect(weapons.length).toBeGreaterThan(0)
    expect(weapons.length).toBeLessThan(all.length)
  })
})
