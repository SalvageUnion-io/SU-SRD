/**
 * Enforces the printed-name and authored-lead sections of the prose-deviation
 * allowlist, `proseDeviations.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { firstParagraphText, SalvageUnionReference } from '../index'
import type { NameDeviation } from '../proseDeviations'
import { AUTHORED_LEADS, NAME_DEVIATIONS } from '../proseDeviations'

const named = (schema: NameDeviation['schema'], name: string) =>
  SalvageUnionReference[schema].all().find((e) => 'name' in e && e.name === name)

describe('deliberate deviations from the printed name', () => {
  for (const d of NAME_DEVIATIONS) {
    describe(`${d.name} (printed "${d.printedAs}", p. ${d.page})`, () => {
      test('still carries its dataset name', () => {
        // Fails if someone "corrects" this to the printed heading. Read `why`
        // above before changing the data — renaming also changes the slug.
        expect(named(d.schema, d.name)).toBeDefined()
      })

      test('has not gained a duplicate under the printed name', () => {
        expect(named(d.schema, d.printedAs)).toBeUndefined()
      })

      test('still cites the page the printed heading is on', () => {
        const entity = named(d.schema, d.name)
        expect(entity && 'page' in entity ? entity.page : undefined).toBe(d.page)
      })
    })
  }

  test('every deviation is a real difference', () => {
    // A entry whose two names are equal is stale bookkeeping, not a deviation.
    expect(NAME_DEVIATIONS.filter((d) => d.name === d.printedAs)).toEqual([])
  })
})

describe('authored roll-table leads', () => {
  for (const lead of AUTHORED_LEADS) {
    test(`${lead.name} (p. ${lead.page}) leads with its authored line`, () => {
      // Fails if the table's first paragraph changes: re-check the book, and
      // drop the entry if the table now quotes it.
      const table = SalvageUnionReference.RollTables.getByName(lead.name)
      expect(table?.page).toBe(lead.page)
      expect(firstParagraphText(table?.content)).toBe(lead.text)
    })
  }
})
