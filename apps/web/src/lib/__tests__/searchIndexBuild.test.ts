/**
 * The build-time search index carries a row for a rule the dataset names in
 * no entry of its own (r2 H7): Training Points, found by its name or "tp",
 * opening the guide step that tells it.
 */
import { describe, expect, test } from 'bun:test'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { searchCompactIndex } from '../searchCompactIndex'
import { buildSearchIndexEntries } from '../searchIndexBuild'

const index = buildSearchIndexEntries()

describe('the search index’s rule rows', () => {
  test('"tp" and "training points" find Training Points first', () => {
    for (const query of ['tp', 'training points', 'Training Points']) {
      const [first] = searchCompactIndex(index, { query, limit: 5 })
      expect(first?.entityName).toBe('Training Points')
      expect(first?.pattern?.kind).toBe('Rule · Crawler Downtime')
    }
  })

  test('the row opens a step its guide’s page really has', () => {
    const row = index.find((entry) => entry.rule && entry.name === 'Training Points')
    const guide = SalvageUnionReference.Guides.getByName('Crawler Downtime')
    const anchors = (guide?.steps ?? []).map((step) => nameToSlug(step.name))
    const [page, anchor] = (row?.pattern?.href ?? '').split('#')
    expect(page).toBe('/guides/crawler-downtime/')
    expect(anchors).toContain(anchor as string)
    // One step of that name: the anchor is not numbered (`guideAnchors`).
    expect(anchors.filter((candidate) => candidate === anchor)).toHaveLength(1)
  })

  test('a full question finds rules where it found nothing', () => {
    const names = searchCompactIndex(index, {
      query: 'what happens when my mech hits 0 sp',
      limit: 10,
    }).map((result) => result.entityName)
    expect(names).toContain('Mech Damage')
  })
})

describe('search forgives a slip and knows what players say (r3 D1, D2)', () => {
  const first = (query: string) => searchCompactIndex(index, { query, limit: 10 })[0]?.entityName
  const top = (query: string, count: number) =>
    searchCompactIndex(index, { query, limit: count }).map((result) => result.entityName)

  test('swapped neighbours and a dropped double letter find the name', () => {
    expect(first('exlposive')).toBe('Explosive')
    expect(first('hackre')).toBe('Hacker')
    // "sheet" holds "heet": the name one slip away still leads the prose.
    expect(first('heet')).toBe('Heat')
  })

  test('a range band as players say it leads with its distance page', () => {
    expect(first('long range')).toBe('Long')
    expect(first('close range')).toBe('Close')
    expect(first('medium range')).toBe('Medium')
    expect(top('range bands', 5).sort()).toEqual(['Close', 'Far', 'Long', 'Medium', 'Range'])
  })

  test('a question players ask leads with the rule it is about', () => {
    expect(first('who goes first')).toBe('Group Initiative')
    expect(top('can I shoot twice', 2).sort()).toEqual(['Multi-attack', 'Turn action'])
    expect(first('my mech hits 0 SP')).toBe('Mech Damage')
    expect(first('what happens when my mech hits 0 sp')).toBe('Mech Damage')
  })

  test('every phrase names a page the dataset has', () => {
    for (const entry of index) {
      for (const alias of entry.aliases ?? []) expect(entry.text).toContain(alias)
    }
    // The distance pages themselves, not a rule that mentions them.
    const long = index.find((entry) => entry.name === 'Long')
    expect(long?.schemaName).toBe('distances')
    expect(long?.aliases).toContain('long range')
  })
})
