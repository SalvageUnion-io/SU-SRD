/**
 * Entities whose dataset `name` deliberately differs from the heading printed
 * in the rulebook.
 *
 * These are NOT errors. Each one is a considered choice — usually because the
 * book itself uses two names for the same thing (an entry heading plus a
 * different form in its contents list, pattern loadouts, or summary tables) and
 * the dataset picked the form that reads better in a list, or that a public URL
 * already depends on.
 *
 * The problem this file solves is that the choice is invisible in the data. A
 * future contributor re-deriving names from the PDFs sees `Video Projection
 * Array` against a printed heading of `Projection Array`, reads it as a typo,
 * "corrects" it — and silently breaks `/schema/modules/item/video-projection-
 * array`, a URL that is canon.
 *
 * A documentary `alias` field on the records themselves was considered and
 * rejected: a field written but read by nothing is exactly the `indexable`
 * flag's failure mode (set on 39 records, consumed by no code, impossible to
 * tell whether it is load-bearing), and knip cannot see a dead data field the
 * way it sees a dead export. Encoding the decision as a test instead gives it
 * teeth — renaming one of these to its printed form fails the build, with a
 * message pointing at the reason — and it cannot rot into decoration.
 *
 * Search does not need this list: it already resolves both forms, because the
 * dataset and printed names overlap enough to match on substring.
 *
 * Adding an entry is a claim you have checked the book. Include the page.
 */
import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from './index.js'

type Deviation = {
  /** The `SalvageUnionReference` accessor the entity lives under. */
  schema: 'Modules' | 'Systems' | 'Equipment'
  /** The name in the dataset — the canonical one, which slugs and URLs use. */
  name: string
  /** The heading as printed in the book. */
  printedAs: string
  /** Printed page carrying that heading. */
  page: number
  why: string
}

const DEVIATIONS: Deviation[] = [
  {
    schema: 'Modules',
    name: 'Video Projection Array',
    printedAs: 'Projection Array',
    page: 196,
    why: 'The book uses both: the entry heading and index say "Projection Array", while the module contents list and the summary tables say "Video Projection Array". The dataset form is canon because /schema/modules/item/video-projection-array is a public URL.',
  },
  {
    schema: 'Modules',
    name: 'Adv. Weapon Link',
    printedAs: 'Advanced Weapon Link',
    page: 198,
    why: 'The book abbreviates to "Adv." in chassis pattern loadouts (e.g. p. 109) and spells it out in the entry heading. Abbreviated here to distinguish it at a glance from the plain "Weapon Link" (p. 193).',
  },
  {
    schema: 'Modules',
    name: 'Adv. Reactor Safety Protocols',
    printedAs: 'Advanced Reactor Safety Protocols',
    page: 202,
    why: 'Same "Adv." abbreviation, distinguishing it from "Reactor Safety Protocols" (p. 197).',
  },
  {
    schema: 'Modules',
    name: 'He₂ Coolant Flush',
    printedAs: 'He2 Coolant Flush',
    page: 205,
    why: 'Typographic only: the dataset uses a Unicode subscript two, the book sets a plain "2".',
  },
  {
    schema: 'Systems',
    name: 'Adv. Fabrication Arm',
    printedAs: 'Advanced Fabrication Arm',
    page: 177,
    why: 'Same "Adv." abbreviation, distinguishing it from "Fabrication Arm" (p. 174).',
  },
  {
    schema: 'Systems',
    name: 'Sandblaster',
    printedAs: 'Sand Blaster',
    page: 168,
    why: 'The book sets the heading as two words in small caps ("SAND BLASTER"); the dataset closes it up.',
  },
  {
    schema: 'Equipment',
    name: 'Adv. Epoxy Applicator',
    printedAs: 'Advanced Epoxy Applicator',
    page: 84,
    why: 'Same "Adv." abbreviation, distinguishing it from the Handheld Epoxy Canister (p. 83) and Integrated Epoxy Printer (p. 110).',
  },
]

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
