import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from '../index'
import { bayKind } from '../view/parts/kind'

/**
 * The `expansion` data tag distinguishes base crawler facilities (pre-installed
 * on every Union Crawler — Core Book "Union Crawler Bays", p.221) from
 * expansion "upgrade"/found bays acquired during play (built for a resource
 * cost or found as a scenario facility). ITUN's crawler wizard seeds only the
 * base bays, so this tag must stay accurate.
 */
describe('CrawlerBays expansion tag', () => {
  const EXPANSION_BAY_NAMES = [
    'Bio-Mech Bay',
    'Bio-Crafting Bay',
    'Nanite Processing Bay',
    'VR Tubes',
  ]

  it('tags exactly the expansion-source bays with expansion: true', () => {
    const tagged = SalvageUnionReference.CrawlerBays.all()
      .filter((bay) => bay.expansion === true)
      .map((bay) => bay.name)
      .sort()
    expect(tagged).toEqual([...EXPANSION_BAY_NAMES].sort())
  })

  it('tags the base facilities expansion: false, so every bay carries the tag', () => {
    const baseBays = SalvageUnionReference.CrawlerBays.all().filter(
      (bay) => !EXPANSION_BAY_NAMES.includes(bay.name)
    )
    expect(baseBays.length).toBe(10)
    for (const bay of baseBays) {
      expect(bay.expansion).toBe(false)
    }
  })

  it('reads the tag as the bay kind: Standard or Expansion', () => {
    const kinds = Object.fromEntries(
      SalvageUnionReference.CrawlerBays.all().map((bay) => [bay.name, bayKind(bay)])
    )
    expect(kinds['Med Bay']).toBe('Standard')
    expect(kinds.Cantina).toBe('Standard')
    expect(kinds['VR Tubes']).toBe('Expansion')
    expect(kinds['Bio-Mech Bay']).toBe('Expansion')
    const chassis = SalvageUnionReference.Chassis.all()[0]
    expect(chassis && bayKind(chassis)).toBeUndefined()
  })
})
