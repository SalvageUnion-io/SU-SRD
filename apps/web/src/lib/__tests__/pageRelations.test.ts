/**
 * EDL E26, "A cross-reference goes both ways", over the whole dataset: every
 * link one Page draws to another (a pattern's loadout, a TL chip, a cite, a
 * roll table's names, a guide's terms, a crawler's bays) is listed back on the
 * Page it reaches (`relationsFor`), and every listing back answers a link.
 */

import { describe, expect, test } from 'bun:test'
import type { EntityRef, RefEntity, RefEnumSchemaName, RefMetaEntity } from 'salvageunion-reference'
import {
  entityRef,
  getSources,
  getTechLevel,
  isBioTitanPattern,
  provenancePrintings,
  resolveProvenance,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { bookHrefs } from '../bookHref'
import { buildChapters } from '../chapters'
import { srdHrefFor } from '../entityHref'
import { guideExplains, relationsFor, sharesABook, tableNames } from '../pageRelations'

const all = (schema: string) =>
  SalvageUnionReference.findAllIn(schema as RefEnumSchemaName, () => true) as RefEntity[]

const byName = (schema: string, name: string): RefEntity => {
  const found = SalvageUnionReference.getByNameIn(schema as RefEnumSchemaName, name)
  if (!found) throw new Error(`${schema} ${name} fixture missing`)
  return found as RefEntity
}

/** The refs a Page lists back, as `id` or `id:pattern`. */
function listedOn(schema: string, entity: RefEntity, key?: string): Set<string> {
  return new Set(
    relationsFor(schema, entity)
      .filter((relation) => !key || relation.key.startsWith(key))
      .flatMap((relation) => relation.rows.map((row) => idOf(row.ref)))
  )
}

const idOf = (ref: EntityRef) => (ref.pattern ? `${ref.id}:${ref.pattern}` : ref.id)

const pageSchemas = buildChapters().flatMap((chapter) => chapter.rows.map((row) => row.schemaId))

describe('E26: a cross-reference goes both ways', () => {
  test("a pattern's loadout links each part, and each part's Page lists the pattern", () => {
    for (const chassis of all('chassis')) {
      const patterns =
        'patterns' in chassis && Array.isArray(chassis.patterns) ? chassis.patterns : []
      for (const pattern of patterns) {
        if (isBioTitanPattern(pattern)) continue
        for (const field of ['systems', 'modules'] as const) {
          for (const part of (pattern[field] ?? []) as { name: string }[]) {
            const entity = SalvageUnionReference.getByNameIn(field, part.name) as
              | RefEntity
              | undefined
            if (!entity) continue
            expect(listedOn(field, entity, 'fitted-in')).toContain(`${chassis.id}:${pattern.name}`)
          }
        }
      }
    }
  })

  test("every entry's TL chip links its tech level, whose Page lists exactly those entries", () => {
    for (const level of all('tech-levels')) {
      const n = getTechLevel(level as RefMetaEntity)
      const listed = listedOn('tech-levels', level)
      const atLevel = pageSchemas
        .filter((schema) => schema !== 'tech-levels')
        .flatMap((schema) => all(schema))
        .filter((entity) => getTechLevel(entity as RefMetaEntity) === n)
      expect(new Set(atLevel.map((entity) => entity.id))).toEqual(listed)
      // The chip's link is the level named so (`factRef`, factRefs.test.ts).
      expect(level.name).toBe(`Tech ${n}`)
    }
  })

  test("every entry's cite links its books, and each book's Page lists the entry", () => {
    const books = new Map(all('sources').map((book) => [book.name, book]))
    const listed = new Map([...books].map(([name, book]) => [name, listedOn('sources', book)]))
    for (const schema of pageSchemas.filter((s) => s !== 'sources')) {
      for (const entity of all(schema)) {
        const printings = provenancePrintings(resolveProvenance(entity as RefMetaEntity))
        const hrefs = bookHrefs(printings)
        for (const [index, printing] of printings.entries()) {
          const book = printing.source ? books.get(printing.source) : undefined
          if (!book) continue
          expect(hrefs[index]).toBe(srdHrefFor(entityRef(book as RefMetaEntity)))
          expect(listed.get(book.name)).toContain(entity.id)
        }
        for (const source of getSources(entity as RefMetaEntity)) {
          if (books.has(source)) expect(listed.get(source)).toContain(entity.id)
        }
      }
    }
  })

  test('a crawler type and a bay of its book list each other', () => {
    for (const crawler of all('crawlers')) {
      for (const bay of all('crawler-bays')) {
        const pair = sharesABook(crawler, bay)
        expect(listedOn('crawlers', crawler).has(bay.id)).toBe(pair)
        expect(listedOn('crawler-bays', bay).has(crawler.id)).toBe(pair)
      }
    }
  })

  test('a keyword and the guide whose rules use it list each other', () => {
    const heat = byName('keywords', 'Heat')
    const heatGuide = byName('guides', 'Heat')
    expect(guideExplains(heatGuide, heat)).toBe(true)
    for (const guide of all('guides')) {
      for (const keyword of all('keywords')) {
        const pair = guideExplains(guide, keyword)
        expect(listedOn('guides', guide).has(keyword.id)).toBe(pair)
        expect(listedOn('keywords', keyword, 'guides').has(guide.id)).toBe(pair)
      }
    }
  })

  test("an entry a roll table's prose names lists the table", () => {
    for (const table of all('roll-tables')) {
      for (const ref of tableNames(table)) {
        const entity = SalvageUnionReference.get(ref.schemaName as RefEnumSchemaName, ref.id)
        if (!entity) continue
        expect(listedOn(ref.schemaName, entity as RefEntity, 'tables')).toContain(table.id)
      }
    }
  })
})
