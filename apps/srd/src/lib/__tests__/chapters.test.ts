import { describe, expect, test } from 'bun:test'
import { getEntitySchemas, SalvageUnionReference } from 'salvageunion-reference'
import { buildChapters, CONTENTS, chapterForSchema } from '../chapters'

/**
 * The SRD's chapters (board 06): the index the home page prints, the nav
 * drawer freezes and every listing and entity page's band and trail read.
 */
describe('buildChapters', () => {
  const chapters = buildChapters()

  test('the book’s five chapters, in its order, each in its colour', () => {
    expect(chapters.map((c) => [c.title, c.tone])).toEqual([
      ['Pilot Bay', 'pilot'],
      ['Mech Workshop', 'mech'],
      ['Union Crawler', 'crawler'],
      ['Denizens of the Wasteland', 'denizen'],
      ['Rules & Reference', 'rules'],
    ])
  })

  test('every catalogued schema is in exactly one chapter, so nothing drops off the index', () => {
    const catalogued = SalvageUnionReference.CatalogCategories.all().flatMap((c) => c.schemas)
    const indexed = chapters.flatMap((c) => c.rows.map((row) => row.schemaId))
    expect([...indexed].sort()).toEqual([...new Set(catalogued)].sort())
    expect(new Set(indexed).size).toBe(indexed.length)
  })

  test('counts are the real entry counts, and a chapter’s total is its rows’ sum', () => {
    const counts = new Map(getEntitySchemas().map((s) => [s.id, s.itemCount]))
    for (const chapter of chapters) {
      for (const row of chapter.rows) expect(row.count).toBe(counts.get(row.schemaId) ?? -1)
      expect(chapter.total).toBe(chapter.rows.reduce((sum, row) => sum + row.count, 0))
    }
  })

  test('Rules & Reference leads with what a table reaches for: guides, then roll tables', () => {
    const rules = chapters.find((c) => c.id === 'rules-reference')
    expect(rules?.rows.slice(0, 2).map((row) => row.schemaId)).toEqual(['guides', 'roll-tables'])
  })

  test('rows link to their listing; chapters to their anchor on Contents', () => {
    const mech = chapters.find((c) => c.id === 'mech-workshop')
    expect(mech?.href).toBe('/#mech-workshop')
    expect(mech?.rows[0]?.href).toBe('/schema/chassis/')
  })
})

describe('chapterForSchema', () => {
  test('a schema wears its chapter’s band', () => {
    expect(chapterForSchema('chassis').tone).toBe('mech')
    expect(chapterForSchema('abilities').title).toBe('Pilot Bay')
    expect(chapterForSchema('npcs').tone).toBe('denizen')
    expect(chapterForSchema('roll-tables').title).toBe('Rules & Reference')
    expect(chapterForSchema('guides').tone).toBe('rules')
  })

  test('a schema no chapter gathers falls back to Contents', () => {
    expect(chapterForSchema('actions')).toEqual(CONTENTS)
  })
})
