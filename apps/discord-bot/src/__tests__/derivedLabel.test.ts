import { describe, expect, test } from 'bun:test'
import { rollOnTable, SalvageUnionReference } from 'salvageunion-reference'
import { deriveLabel } from '../derivedLabel.js'

describe('deriveLabel', () => {
  test('promotes the leading sentence and leaves the rest for the body', () => {
    const out = deriveLabel(
      "Your Union Crawler is inoperable and grounded. Its Bays are Intact, but inoperable. You must pay your Union Crawler's Upkeep Cost."
    )
    expect(out?.label).toBe('Your Union Crawler is inoperable and grounded')
    // The promoted sentence must NOT reappear beneath itself.
    expect(out?.rest).toBe(
      "Its Bays are Intact, but inoperable. You must pay your Union Crawler's Upkeep Cost."
    )
    expect(out?.rest).not.toContain('inoperable and grounded.')
  })

  test('a one-sentence entry has no remainder', () => {
    const out = deriveLabel('You are feeling great.')
    expect(out?.label).toBe('You are feeling great')
    expect(out?.rest).toBeUndefined()
  })

  test('refuses rather than truncating', () => {
    // The failure this exists to prevent: a headline cut mid-phrase that then
    // repeats the body verbatim underneath it.
    const long =
      'A random faction wanting to salvage the Chimerid Meteor arrives at the same time as the Pilots and will fight them for it.'
    expect(deriveLabel(long)).toBeUndefined()
  })

  test('refuses a single-word fragment', () => {
    expect(deriveLabel('Sparkles')).toBeUndefined()
    expect(deriveLabel('Apex.')).toBeUndefined()
  })

  test('refuses empty input rather than throwing', () => {
    expect(deriveLabel('')).toBeUndefined()
  })

  test('never invents — every label is a prefix of the entry it came from', () => {
    // The whole justification for deriving at all: these are the book's words,
    // not a paraphrase. Asserted across the real dataset rather than a fixture.
    for (const table of SalvageUnionReference.RollTables.all()) {
      for (let roll = 1; roll <= 20; roll++) {
        const outcome = rollOnTable(table.table, () => roll)
        if (!outcome.success) continue
        const out = deriveLabel(outcome.value)
        if (out === undefined) continue
        expect(outcome.value.startsWith(out.label)).toBe(true)
        if (out.rest !== undefined) expect(outcome.value).toContain(out.rest)
      }
    }
  })
})
