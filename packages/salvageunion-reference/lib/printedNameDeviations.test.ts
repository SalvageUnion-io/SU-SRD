/**
 * Enforces the printed-name deviation record in `printedNameDeviations.ts`.
 *
 * The list lives in its own module because `tools/check-printed-names.ts` reads
 * it too — the scan suppresses names already recorded here, so its output is
 * only ever findings nobody has ruled on yet.
 */
import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from './index.js'
import type { Deviation } from './printedNameDeviations.js'
import { DEVIATIONS } from './printedNameDeviations.js'

const named = (schema: Deviation['schema'], name: string) =>
  SalvageUnionReference[schema].all().find((e) => 'name' in e && e.name === name)

describe('deliberate deviations from the printed name', () => {
  for (const d of DEVIATIONS) {
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
    expect(DEVIATIONS.filter((d) => d.name === d.printedAs)).toEqual([])
  })
})
