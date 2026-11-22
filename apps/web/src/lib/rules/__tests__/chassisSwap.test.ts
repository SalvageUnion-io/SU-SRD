import { describe, expect, test } from 'bun:test'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { computeMechCapacity } from 'salvageunion-reference/rules'
import { loadoutOnChassis, namedForChassis } from '../chassisSwap'

const one = nameToSlug(
  (SalvageUnionReference.Systems.all().find((s) => s.slotsRequired === 1) ?? { name: '' }).name
)

describe('loadoutOnChassis', () => {
  test('a loadout that fits the new chassis is kept whole, in order', () => {
    const systems = [one, one]
    expect(loadoutOnChassis('mule', { systems, modules: [] })).toEqual({
      systems,
      modules: [],
      dropped: [],
    })
  })

  test('what overfills the new chassis is left off and named; the rest stays', () => {
    const max = computeMechCapacity({ chassisRef: 'mule', systems: [], modules: [] }).systemSlotsMax
    const systems = new Array<string>(max + 2).fill(one)
    const swap = loadoutOnChassis('mule', { systems, modules: [] })
    expect(swap.systems.length).toBe(max)
    expect(swap.dropped).toEqual([one, one])
  })
})

describe('namedForChassis (r5 C10)', () => {
  test('a mech still wearing its chassis name is, in any case; a named one is not', () => {
    expect(namedForChassis({ name: 'Scrapper', chassisRef: 'scrapper' })).toBe(true)
    expect(namedForChassis({ name: 'scrapper ', chassisRef: 'scrapper' })).toBe(true)
    expect(namedForChassis({ name: 'Rusty', chassisRef: 'scrapper' })).toBe(false)
    expect(namedForChassis({ name: '', chassisRef: '' })).toBe(false)
  })
})
