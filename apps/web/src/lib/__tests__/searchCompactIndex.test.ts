import { describe, expect, test } from 'bun:test'
import { scoreSearchMatch } from 'salvageunion-reference'
import { aboveFloor, searchCompactIndex } from '../searchCompactIndex'
import { buildSearchIndexEntries } from '../searchIndexBuild'
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

describe('aboveFloor: the dropdown leaves out what only mentions the query (SB6-28)', () => {
  test('"pinning" is Pinning, never the entries whose words say it', () => {
    const results = aboveFloor(searchCompactIndex(buildSearchIndexEntries(), { query: 'pinning' }))
    const names = results.map((r) => r.entityName)
    expect(names[0]).toBe('Pinning')
    for (const prose of ['Retreat', 'Leviathan', 'Mazona']) expect(names).not.toContain(prose)
  })

  test('with nothing named, every match stays: the words are the only answer', () => {
    const prose = searchCompactIndex(INDEX, { query: 'odd' })
    expect(prose.length).toBeGreaterThan(0)
    expect(aboveFloor(prose)).toEqual(prose)
  })
})

describe('a question finds the rules term it holds (r7 E1)', () => {
  const index = buildSearchIndexEntries()
  const first = (query: string, n = 1) =>
    aboveFloor(searchCompactIndex(index, { query }))
      .slice(0, n)
      .map((r) => `${r.entityName} (${r.schemaName})`)

  test('the term leads the phrase it is in', () => {
    expect(first('overheat mech')).toEqual(['Overheat (traits)'])
    expect(first('what happens when my mech overheats')).toEqual(['Overheat (traits)'])
    expect(first('how far can my mech move', 2).sort()).toEqual([
      'Map Movement (guides)',
      'Move (keywords)',
    ])
  })

  test('another form of the name finds the how-to (SB7-20)', () => {
    expect(first('salvage')).toEqual(['Salvaging (guides)'])
  })

  test('the prose that holds the rest stays under the term', () => {
    const names = aboveFloor(searchCompactIndex(index, { query: 'overheat mech' })).map(
      (r) => r.entityName
    )
    expect(names).toContain('Pushing a Mech')
  })
})

describe("'pilot bay' offers the Crawler Bay and the Reference's section (RR7-16)", () => {
  test('both, the section opening its chapter page', () => {
    const results = aboveFloor(
      searchCompactIndex(buildSearchIndexEntries(), { query: 'pilot bay' })
    )
    expect(results.map((r) => r.pattern?.href ?? r.schemaName).slice(0, 2)).toEqual([
      'crawler-bays',
      '/pilots/',
    ])
  })
})
