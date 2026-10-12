/**
 * Enforces the printed-name section of the prose-deviation allowlist, `proseDeviations.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from './index'
import type { NameDeviation } from './proseDeviations'
import { NAME_DEVIATIONS } from './proseDeviations'

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
