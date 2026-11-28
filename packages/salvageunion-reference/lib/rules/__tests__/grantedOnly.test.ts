/**
 * R63: granted-only gear comes from its grantor and nothing else. A class
 * ability's item is granted-only; shelf gear is not; and a catalog pick of
 * Pilot Equipment never offers it.
 */
import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from '../../index'
import { resolveCatalogChoiceEntities } from '../choiceCatalog'
import { isGrantedOnly } from '../grantedOnly'

const CLASS_GEAR = [
  'Auto-Turret',
  'Camo Suit',
  'Custom Missile Launcher',
  'Custom Sniper Rifle',
  'Hacking Kit',
  'Holo Companion',
  'Knife Missile',
  'Mecha Companion',
  'Miniaturised EMP',
  'Stealth Field Generator',
  'Survey Drone',
  'Teleport Beacon',
  'Wingsuit',
]

describe('isGrantedOnly (R63)', () => {
  test('exactly the class-granted gear is granted-only', () => {
    const granted = SalvageUnionReference.Equipment.all()
      .filter((item) => isGrantedOnly('equipment', item))
      .map((item) => item.name)
      .sort()
    expect(granted).toEqual(CLASS_GEAR)
  })

  test('shelf gear and a same-named record in another schema are not', () => {
    expect(isGrantedOnly('equipment', { name: 'First Aid Kit' })).toBe(false)
    // "Survey Drone" is also an opposition drone, which no ability grants.
    expect(isGrantedOnly('drones', { name: 'Survey Drone' })).toBe(false)
  })

  test('a catalog pick of equipment never offers granted-only gear', () => {
    const blackMarket = SalvageUnionReference.Actions.getByName('Black Market')
    const choice = blackMarket?.choices?.find(
      (c) => c.source?.kind === 'catalog' && c.source.schema?.includes('equipment')
    )
    if (!choice) throw new Error('Black Market equipment catalog missing')
    const offered = resolveCatalogChoiceEntities(choice).map((e) => e.name)
    expect(offered.length).toBeGreaterThan(0)
    expect(offered.filter((name) => CLASS_GEAR.includes(String(name)))).toEqual([])
  })
})
