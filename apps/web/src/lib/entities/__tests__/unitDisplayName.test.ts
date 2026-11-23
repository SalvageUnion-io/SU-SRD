import { describe, expect, test } from 'bun:test'
import { unitDisplayName } from '../unitDisplayName'

/** A pilot is called by its callsign everywhere but its own sheet (r8 F1, SB8-04). */
describe('unitDisplayName', () => {
  test('a pilot by its callsign, never its optional name', () => {
    expect(unitDisplayName({ callsign: 'Wren', name: 'Coma' })).toBe('Wren')
  })

  test('an older pilot with no callsign by its name', () => {
    expect(unitDisplayName({ callsign: '', name: 'Coma' })).toBe('Coma')
  })

  test('any other unit by its name', () => {
    expect(unitDisplayName({ name: 'Big Lou' })).toBe('Big Lou')
  })
})
