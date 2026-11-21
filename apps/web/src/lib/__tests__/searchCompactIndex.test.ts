import { describe, expect, test } from 'bun:test'
import { scoreSearchMatch } from 'salvageunion-reference'
import { searchCompactIndex } from '../searchCompactIndex'
import type { CompactSearchEntry } from '../searchIndexTypes'

function entry(name: string, text = name.toLowerCase()): CompactSearchEntry {
  return {
    id: name,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    schemaName: 'systems',
    schemaTitle: 'Systems',
    text,
  }
}

const INDEX = [
  entry('Heavy Arc Laser', 'heavy arc laser a sweeping beam'),
  entry('Laser Rifle'),
  entry('Laser'),
  entry('Heavy Laser'),
  entry('Hellfire Missiles'),
  entry('Scrap Cannon', 'scrap cannon fires scrap and the odd laser'),
]

describe('searchCompactIndex', () => {
  test('ranks by the shared name-priority tiers', () => {
    const names = searchCompactIndex(INDEX, { query: 'laser' }).map((r) => r.entityName)
    // exact (100) → prefix (50) → contains (25, twice) → prose-only hit (0).
    expect(names[0]).toBe('Laser')
    expect(names[1]).toBe('Laser Rifle')
    expect(names.slice(2, 4).sort()).toEqual(['Heavy Arc Laser', 'Heavy Laser'])
    expect(names[4]).toBe('Scrap Cannon')
  })

  test('its score IS the shared score — no local tiers', () => {
    for (const result of searchCompactIndex(INDEX, { query: 'heavy laser' })) {
      const nameText = result.entityName.toLowerCase()
      expect(result.matchScore).toBe(
        scoreSearchMatch({
          nameText,
          loweredQuery: 'heavy laser',
          tokens: ['heavy', 'laser'],
          usedTypo: false,
        })
      )
    }
  })

  test('typo forgiveness is name-only and ranks below literal hits', () => {
    const [hit] = searchCompactIndex(INDEX, { query: 'hellfyre' })
    expect(hit?.entityName).toBe('Hellfire Missiles')
    expect(hit?.matchScore).toBe(-15)
  })

  test('blank queries, schema filters and limits', () => {
    expect(searchCompactIndex(INDEX, { query: '  ' })).toEqual([])
    expect(searchCompactIndex(INDEX, { query: 'laser', schemas: ['chassis'] })).toEqual([])
    expect(searchCompactIndex(INDEX, { query: 'laser', limit: 2 })).toHaveLength(2)
  })

  test('a rule told inside a guide ranks as a rule, a pattern as itself (r2 H7)', () => {
    const rule: CompactSearchEntry = {
      ...entry('Training Points', 'training points tp'),
      schemaName: 'guides',
      pattern: {
        href: '/guides/crawler-downtime/#train-your-pilot',
        kind: 'Rule · Crawler Downtime',
      },
      rule: true,
    }
    const guide: CompactSearchEntry = {
      ...entry('Crawler Downtime', 'crawler downtime tp training points'),
      schemaName: 'guides',
    }
    const names = (query: string) =>
      searchCompactIndex([rule, guide], { query }).map((r) => r.entityName)
    expect(names('tp')).toEqual(['Training Points', 'Crawler Downtime'])
    expect(names('training points')).toEqual(['Training Points', 'Crawler Downtime'])
    expect(searchCompactIndex([rule, guide], { query: 'tp' })[0]?.pattern?.href).toBe(
      '/guides/crawler-downtime/#train-your-pilot'
    )
  })
})
