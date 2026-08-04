import { describe, expect, it } from 'bun:test'
import { loadAllDataFiles } from './loadData.js'
import {
  findDupesInContent,
  normalizeParagraph,
  runContentDupeCheck,
  MIN_WORDS,
} from './validateContentDupesLogic.js'

/** A paragraph long enough to clear MIN_WORDS, so fixtures test the real path. */
const LONG_A =
  'You make a special charge attack against the target, rolling to hit as normal against it.'
const LONG_B =
  'If you use this Ability whilst piloting a Mech, it deals SP damage equal to your Cargo Slots.'

const para = (value: string) => ({ type: 'paragraph', value })

describe('normalizeParagraph', () => {
  it('strips trait link markers so [[Vulnerable]] and Vulnerable compare equal', () => {
    expect(normalizeParagraph('gains the [[Vulnerable]] Trait')).toBe(
      normalizeParagraph('gains the Vulnerable Trait')
    )
  })

  it('collapses whitespace and lowercases', () => {
    expect(normalizeParagraph('  Roll   to\nhit  ')).toBe('roll to hit')
  })
})

describe('findDupesInContent', () => {
  it('flags a paragraph repeated verbatim, reporting only the later one', () => {
    const dupes = findDupesInContent([para(LONG_A), para(LONG_A)])

    expect(dupes).toHaveLength(1)
    expect(dupes[0]?.kind).toBe('exact')
    expect(dupes[0]?.paragraph).toBe(2)
    expect(dupes[0]?.duplicateOf).toBe(1)
  })

  it('flags an un-split blob that swallows the split paragraphs (the #66 shape)', () => {
    const blob = `Flavour text about crushing your enemies. ${LONG_A} ${LONG_B}`
    const dupes = findDupesInContent([para(blob), para(LONG_A), para(LONG_B)])

    expect(dupes).toHaveLength(2)
    expect(dupes.every((d) => d.kind === 'contains')).toBe(true)
    expect(dupes.every((d) => d.paragraph === 1)).toBe(true)
    expect(dupes.map((d) => d.duplicateOf).sort()).toEqual([2, 3])
  })

  it('detects containment across differing trait markup', () => {
    const split = 'Any target hit by this attack is knocked Prone and gains the Vulnerable Trait.'
    const blob = `It deals damage equal to your Cargo Slots. Any target hit by this attack is knocked Prone and gains the [[Vulnerable]] Trait.`

    const dupes = findDupesInContent([para(blob), para(split)])

    expect(dupes).toHaveLength(1)
    expect(dupes[0]?.kind).toBe('contains')
  })

  it('ignores short paragraphs below the MIN_WORDS floor', () => {
    const short = 'Roll to hit.'
    expect(short.split(' ').length).toBeLessThan(MIN_WORDS)

    expect(findDupesInContent([para(short), para(short)])).toHaveLength(0)
  })

  it('accepts distinct paragraphs that merely share phrasing', () => {
    const tech2 = 'Training during Downtime on your Union Crawler in a Tech 2 Pilot Bay grants one.'
    const tech3 = 'Training during Downtime on your Union Crawler in a Tech 3 Pilot Bay grants two.'

    expect(findDupesInContent([para(tech2), para(tech3)])).toHaveLength(0)
  })

  it('ignores content blocks with no string value', () => {
    expect(findDupesInContent([{ type: 'table', rows: [] }, para(LONG_A)])).toHaveLength(0)
  })
})

describe('runContentDupeCheck', () => {
  it('reports the owning file and record name', () => {
    const dupes = runContentDupeCheck({
      'actions.json': [{ name: 'Some Action', content: [para(LONG_A), para(LONG_A)] }],
    })

    expect(dupes).toHaveLength(1)
    expect(dupes[0]?.file).toBe('actions.json')
    expect(dupes[0]?.record).toBe('Some Action')
  })

  it('does not flag identical prose shared across two different records', () => {
    const dupes = runContentDupeCheck({
      'actions.json': [
        { name: 'First', content: [para(LONG_A)] },
        { name: 'Second', content: [para(LONG_A)] },
      ],
    })

    expect(dupes).toEqual([])
  })

  it('finds duplication in nested records, attributing the nested name', () => {
    const dupes = runContentDupeCheck({
      'chassis.json': [
        {
          name: 'Some Chassis',
          patterns: [{ name: 'Some Pattern', content: [para(LONG_B), para(LONG_B)] }],
        },
      ],
    })

    expect(dupes).toHaveLength(1)
    expect(dupes[0]?.record).toBe('Some Pattern')
  })
})

describe('the real data corpus', () => {
  it('has no record that duplicates its own content', () => {
    const dupes = runContentDupeCheck(loadAllDataFiles())

    // Named regressions from the `Break out Actions (#66)` migration. Listed
    // explicitly so a re-introduction fails with a readable message rather than
    // a bare count mismatch.
    expect(dupes.map((d) => `${d.file} :: ${d.record}`)).toEqual([])
  })
})
