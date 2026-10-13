/**
 * The entity model's trait facets, on their own terms: an action's sub-header
 * cells and a crawler tech level's population band. (Moved here from
 * component-lib's card tests with the pass-through wrappers they tested.)
 */
import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from '../../index'
import type { SURefMetaEntity } from '../../schemas/index'
import { actionFacets, populationRange } from '../parts/traits'

const tier = (name: string): SURefMetaEntity => {
  const found = SalvageUnionReference.CrawlerTechLevels.getByName(name)
  if (!found) throw new Error(`${name} fixture missing`)
  return found
}

describe('actionFacets', () => {
  test('leads with the type, then range / damage / traits', () => {
    const cells = actionFacets({
      actionType: 'Turn',
      range: ['Close', 'Medium'],
      damage: { amount: 4, damageType: 'SP' },
      traits: [{ type: 'explosive', amount: 1 }],
    })
    expect(cells.map((c) => [c.label, c.value])).toEqual([
      ['Turn Action', undefined],
      ['Range', 'Close / Medium'],
      ['Damage', '4 SP'],
      ['Explosive', '1'],
    ])
  })

  test('a split action type reads Mech first, as the book prints it', () => {
    expect(actionFacets({ actionType: 'Short' }, 'Turn').map((c) => c.label)).toEqual([
      'Turn Action (Mech)',
      'Short Action (Pilot)',
    ])
  })
})

describe('populationRange', () => {
  test('formats a bounded band with an en dash and grouped thousands', () => {
    expect(populationRange(tier('City Crawler'))).toBe('5,000–15,000')
  })

  test('formats the unbounded top tier open-ended', () => {
    expect(populationRange(tier('Megacity Crawler'))).toBe('25,000+')
  })

  test('returns undefined for an entity that has no population band', () => {
    const mule = SalvageUnionReference.Chassis.getByName('Mule')
    if (!mule) throw new Error('Mule fixture missing')
    expect(populationRange(mule)).toBeUndefined()
  })
})
