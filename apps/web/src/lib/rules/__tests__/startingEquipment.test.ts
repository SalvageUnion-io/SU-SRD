import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { must } from '../../../components/__tests__/must'
import { abilityGrantedEquipment, isStartingEquipment } from '../startingEquipment'

const equipment = (name: string) => must(SalvageUnionReference.Equipment.getByName(name))

describe('starting equipment (SB-03)', () => {
  test('gear an Ability grants is never a free starting pick', () => {
    for (const name of ['Custom Sniper Rifle', 'Holo Companion', 'Auto-Turret', 'Hacking Kit']) {
      expect(abilityGrantedEquipment().has(name)).toBe(true)
      expect(isStartingEquipment(equipment(name))).toBe(false)
    }
  })

  test('the Tech 1 list stays; higher Tech Levels never were', () => {
    const pool = SalvageUnionReference.Equipment.all().filter(isStartingEquipment)
    expect(pool.length).toBeGreaterThan(5)
    expect(pool.every((item) => item.techLevel === 1)).toBe(true)
    expect(pool.some((item) => abilityGrantedEquipment().has(item.name))).toBe(false)
  })
})
