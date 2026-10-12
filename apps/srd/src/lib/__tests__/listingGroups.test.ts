import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { defaultGroups } from '../listingGroups'

describe('crawler bay listing groups', () => {
  it('groups the bays into Standard, then Expansion', () => {
    const groups = defaultGroups(SalvageUnionReference.CrawlerBays.all(), [], [5])
    expect(groups.map((group) => [group.label, group.items.length])).toEqual([
      ['Standard Bays', 10],
      ['Expansion Bays', 4],
    ])
    expect(groups[0]?.items.map((bay) => bay.name)).toContain('Med Bay')
  })
})
