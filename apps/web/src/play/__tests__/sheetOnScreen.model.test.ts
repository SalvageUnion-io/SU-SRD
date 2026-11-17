import { describe, expect, test } from 'bun:test'
import type { SheetChoice } from '../sheetOnScreen.model'
import { listedName, sheetChoiceSections } from '../sheetOnScreen.model'

const c = (kind: SheetChoice['kind'], id: string, name: string, yours = false): SheetChoice => ({
  kind,
  id,
  name,
  yours,
})

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
