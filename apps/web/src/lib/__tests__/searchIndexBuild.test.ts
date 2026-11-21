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
