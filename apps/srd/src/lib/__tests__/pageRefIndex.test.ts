import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { pageRefIndexFor } from '../pageRefIndex'

const guide = (name: string) => {
  const found = SalvageUnionReference.Guides.getByName(name)
  if (!found) throw new Error(`fixture missing: ${name}`)
  return found
}

describe('pageRefIndexFor', () => {
  test('holds just the Workshop Manual pages the entity cites', () => {
    const index = pageRefIndexFor(guide('Heat'))
    expect(Object.keys(index ?? {})).toEqual(['235'])
    expect(index?.[235]?.map((c) => [c.ref.schemaName, c.ref.name, c.noun])).toEqual([
      ['roll-tables', 'Reactor Overload', 'roll table'],
    ])
  })

  test('marks a guide, and never lists the entity itself', () => {
    const index = pageRefIndexFor(guide('Create a Mech'))
    expect(index?.[212]?.find((c) => c.ref.name === 'Create a Crawler')?.guide).toBe(true)
    const crawler = guide('Create a Crawler')
    for (const candidates of Object.values(pageRefIndexFor(crawler) ?? {})) {
      expect(candidates.some((c) => c.ref.id === crawler.id)).toBe(false)
    }
  })

  test('an entity that cites no page has no index', () => {
    expect(pageRefIndexFor(guide('Safety Protocols'))).toBeUndefined()
  })
})
