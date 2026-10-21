/**
 * Name references: an entry the prose names in plain words, as the book prints
 * a game term (capitalised, whole words), its kind's noun choosing between
 * namesakes but never joining the link, each entry once per text.
 */
import { describe, expect, test } from 'bun:test'
import type { EntityRef, EntitySchemaName } from 'salvageunion-reference'
import type { NameRefCandidate, NameRefIndex } from '../nameRefs'
import { findNameRefs } from '../nameRefs'

const ref = (schemaName: EntitySchemaName, name: string): EntityRef => ({
  schemaName,
  id: `${schemaName}-${name}`,
  slug: name.toLowerCase().replaceAll(' ', '-'),
  name,
})

const entry = (
  schemaName: EntitySchemaName,
  name: string,
  rest: Omit<NameRefCandidate, 'ref'> = {}
): NameRefCandidate => ({ ref: ref(schemaName, name), ...rest })

const index: NameRefIndex = {
  dependable: [entry('traits', 'dependable', { noun: 'Trait' })],
  'heat check': [entry('keywords', 'heat check')],
  heavy: [entry('traits', 'heavy', { noun: 'Trait' })],
  'critical damage': [entry('roll-tables', 'Critical Damage', { noun: 'Table', nounInLink: true })],
  morale: [
    entry('keywords', 'morale'),
    entry('roll-tables', 'Morale', { noun: 'Table', needsNoun: true, nounInLink: true }),
  ],
  close: [entry('distances', 'Close', { noun: 'Range', range: true })],
  repair: [entry('abilities', 'Repair', { noun: 'Ability', needsNoun: true })],
  mech: [entry('keywords', 'mech')],
  rifle: [entry('equipment', 'Rifle')],
  system: [entry('keywords', 'system')],
  intact: [entry('keywords', 'intact')],
  'a.i. personality': [
    entry('roll-tables', 'A.I. Personality', { noun: 'Table', nounInLink: true }),
  ],
  '.50 cal machine gun': [entry('systems', '.50 Cal Machine Gun', { noun: 'System' })],
}

/** Each match as the words it links and the kind it means. */
const linked = (text: string, owner?: string) =>
  findNameRefs(text, index, [], owner).map((m) => [text.slice(m.start, m.end), m.ref.schemaName])

describe('findNameRefs', () => {
  test('links a trait the prose names, the name alone, never the noun after it', () => {
    expect(
      linked(
        'This Chassis gains the Dependable Trait. Additionally, you may re-roll results on the Critical Damage Table and on failed Heat Checks.'
      )
    ).toEqual([
      ['Dependable', 'traits'],
      ['Critical Damage Table', 'roll-tables'],
      ['Heat Checks', 'keywords'],
    ])
  })

  test('only a name printed as a term: capitalised, whole words', () => {
    expect(linked('known for its dependable build quality')).toEqual([])
    expect(linked('a Mechanic arrives')).toEqual([])
    expect(linked('an Anti-Mech mine')).toEqual([])
  })

  test("a kind's noun picks it among namesakes; a one-word table needs its noun", () => {
    expect(linked('the crew makes a Morale check')).toEqual([['Morale', 'keywords']])
    expect(linked('roll on the Morale Table')).toEqual([['Morale Table', 'roll-tables']])
  })

  test('a range links with its noun or after its preposition', () => {
    expect(linked('everything in Close Range')).toEqual([['Close', 'distances']])
    expect(linked('anything within Close of you')).toEqual([['Close', 'distances']])
    expect(linked('they see a Close friend')).toEqual([])
  })

  test('a one-word ability links only with its noun', () => {
    expect(linked('you can Repair it later')).toEqual([])
    expect(linked('use the Repair Ability')).toEqual([['Repair', 'abilities']])
  })

  test('a one-word name opening a sentence, or inside a proper name, stays text', () => {
    expect(linked('Mech parts. Mech parts again.')).toEqual([])
    expect(linked('built by Evantis Heavy Industries')).toEqual([])
    expect(linked("the DronTek 'K4' Rifle is larger")).toEqual([])
    expect(linked('a Heavy weapon')).toEqual([['Heavy', 'traits']])
  })

  test('a game noun after a term is no proper name; the noun, after a term, stays text', () => {
    expect(linked('Both an Intact System and more')).toEqual([['Intact', 'keywords']])
  })

  test('links each entry once per text, the longest name winning', () => {
    expect(linked('a target Mech, and then a second Mech')).toEqual([['Mech', 'keywords']])
    expect(linked('fire the .50 Cal Machine Gun')).toEqual([['.50 Cal Machine Gun', 'systems']])
  })

  test('finds a name whose first word carries punctuation', () => {
    expect(linked('Roll on the A.I. Personality Table')).toEqual([
      ['A.I. Personality Table', 'roll-tables'],
    ])
  })

  test("never links its owner's name; a namesake only by its noun", () => {
    expect(linked('the Morale of the crew', 'keywords-morale')).toEqual([])
    expect(linked('roll on the Morale Table', 'keywords-morale')).toEqual([
      ['Morale Table', 'roll-tables'],
    ])
  })

  test('skips the spans it is told to (trait markup)', () => {
    const text = 'gains the [[Dependable]] Trait'
    const start = text.indexOf('[[')
    expect(findNameRefs(text, index, [{ start, end: start + 14 }])).toEqual([])
  })
})
