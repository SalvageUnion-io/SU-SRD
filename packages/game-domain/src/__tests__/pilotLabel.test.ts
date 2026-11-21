import { describe, expect, test } from 'bun:test'
import { pilotCallsign, pilotLabel, pilotLabelOf } from '../pilotLabel'

/** A pilot's one name everywhere: the callsign first, then the name (glossary §14). */
describe('pilotLabel', () => {
  test('callsign first, then the name', () => {
    expect(pilotLabel({ callsign: 'GHOST', name: 'Mara Voss' })).toBe('GHOST · Mara Voss')
  })

  test('a callsign that only repeats the name is said once', () => {
    expect(pilotLabel({ callsign: 'Bonesaw', name: 'bonesaw ' })).toBe('Bonesaw')
  })

  test('one alone when the other is missing', () => {
    expect(pilotLabel({ callsign: ' ', name: 'Mara Voss' })).toBe('Mara Voss')
    expect(pilotLabel({ callsign: 'GHOST' })).toBe('GHOST')
  })

  test('a body that names nobody: null, or "Pilot" where a label must stand', () => {
    expect(pilotLabelOf({ name: 7 })).toBeNull()
    expect(pilotLabelOf(null)).toBeNull()
    expect(pilotLabel(undefined)).toBe('Pilot')
  })
})

describe('pilotCallsign', () => {
  test('the callsign, else the name', () => {
    expect(pilotCallsign({ callsign: 'GHOST', name: 'Mara Voss' })).toBe('GHOST')
    expect(pilotCallsign({ callsign: '', name: 'Mara Voss' })).toBe('Mara Voss')
    expect(pilotCallsign({})).toBe('Pilot')
  })
})
