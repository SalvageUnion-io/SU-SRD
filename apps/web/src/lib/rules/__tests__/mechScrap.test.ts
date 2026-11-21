import { describe, expect, test } from 'bun:test'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { mechScrap } from '../mechScrap'

const chassis = SalvageUnionReference.Chassis.all()
const systems = SalvageUnionReference.Systems.all()

describe('mechScrap', () => {
  test('a bare chassis is worth its own Salvage Value, at its Tech Level', () => {
    const mule = chassis.find((c) => c.name === 'Mule')
    if (!mule) throw new Error('no Mule')
    expect(mechScrap({ chassisRef: 'mule', systems: [], modules: [] })).toEqual({
      total: mule.salvageValue,
      byTechLevel: [{ techLevel: mule.techLevel, scrap: mule.salvageValue }],
    })
  })

  test('the loadout counts, each copy, split by the Tech Level of the part', () => {
    const mule = chassis.find((c) => c.name === 'Mule')
    const high = systems.find(
      (s) => typeof s.techLevel === 'number' && s.techLevel > 1 && s.salvageValue > 0
    )
    const low = systems.find((s) => s.techLevel === 1 && s.salvageValue > 0)
    if (!mule || !high || !low) throw new Error('fixture')
    const cost = mechScrap({
      chassisRef: 'mule',
      systems: [nameToSlug(low.name), nameToSlug(low.name), nameToSlug(high.name)],
      modules: [],
    })
    expect(cost.total).toBe(mule.salvageValue + 2 * low.salvageValue + high.salvageValue)
    expect(cost.byTechLevel).toEqual([
      { techLevel: 1, scrap: mule.salvageValue + 2 * low.salvageValue },
      { techLevel: high.techLevel, scrap: high.salvageValue },
    ])
  })

  test('no chassis and an unknown ref price at nothing', () => {
    expect(mechScrap({ chassisRef: '', systems: ['not-a-system'], modules: [] })).toEqual({
      total: 0,
      byTechLevel: [],
    })
  })
})
