import { describe, expect, test } from 'bun:test'
import type { SheetChoice } from '../sheetOnScreen.model'
import { listedName, partnerChoices, sheetChoiceSections } from '../sheetOnScreen.model'

const c = (
  kind: 'pilot' | 'mech' | 'crawler',
  id: string,
  name: string,
  yours = false
): SheetChoice => ({ kind, id, name, yours })

describe('sheetChoiceSections (play.md §18)', () => {
  test('yours first, this pilot leading; then the table’s, pilot, mech, crawler, by name', () => {
    const sections = sheetChoiceSections(
      [
        c('mech', 'm1', 'Atlas', true),
        c('crawler', 'k1', 'Tenacity'),
        c('pilot', 'p2', 'Rook'),
        c('pilot', 'p1', 'Wren', true),
        c('mech', 'm2', 'Mule'),
        c('pilot', 'p3', 'Mags'),
      ],
      'p1'
    )
    expect(sections.map((s) => s.map((x) => x.name))).toEqual([
      ['Wren', 'Atlas'],
      ['Mags', 'Rook', 'Mule', 'Tenacity'],
    ])
  })

  test('a unit listed twice appears once; one with no name is left out; empty sections go', () => {
    const sections = sheetChoiceSections(
      [c('pilot', 'p1', 'Wren', true), c('pilot', 'p1', 'Wren', false), c('mech', 'm9', ' ')],
      'p1'
    )
    expect(sections).toEqual([[c('pilot', 'p1', 'Wren', true)]])
  })

  test('listedName reads a body’s name, else empty', () => {
    expect(listedName({ name: 'Rook' })).toBe('Rook')
    expect(listedName(null)).toBe('')
    expect(listedName({ name: 3 })).toBe('')
  })
})

describe('partnerChoices (companions, play.md §18)', () => {
  test('each partner with an id and a stat block reference, naming its host', () => {
    const choices = partnerChoices(
      {
        kind: 'pilot',
        id: 'p1',
        partners: [
          { id: 'pt-1', hostRef: 'mecha-companion', hostSchema: 'equipment', name: 'Custos' },
          { id: 'pt-2' },
          null,
        ],
      },
      true
    )
    expect(choices).toEqual([
      {
        kind: 'partner',
        id: 'pt-1',
        name: 'Custos',
        yours: true,
        host: { kind: 'pilot', id: 'p1' },
      },
    ])
  })

  test('no partners, none listed; companions sort after the units', () => {
    expect(partnerChoices({ kind: 'mech', id: 'm1' }, false)).toEqual([])
    const sections = sheetChoiceSections(
      [
        ...partnerChoices(
          { kind: 'pilot', id: 'p1', partners: [{ id: 'pt-1', hostRef: 'x', name: 'Custos' }] },
          true
        ),
        c('pilot', 'p1', 'Wren', true),
      ],
      'p1'
    )
    expect(sections[0]?.map((x) => x.kind)).toEqual(['pilot', 'partner'])
  })
})
