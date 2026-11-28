import { describe, expect, test } from 'bun:test'
import { pilotCallsign, pilotLabel, pilotLabelOf } from '../pilotLabel'

/** A pilot's one name everywhere: the callsign (glossary §14, r8 F1). */
describe('pilotLabel', () => {
  test('the callsign alone: the optional name never joins it', () => {
    expect(pilotLabel({ callsign: 'GHOST', name: 'Mara Voss' })).toBe('GHOST')
    expect(pilotLabel({ callsign: 'Bonesaw', name: 'bonesaw ' })).toBe('Bonesaw')
  })

  test('the name for an older pilot with no callsign', () => {
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
  test('the same name as pilotLabel', () => {
    expect(pilotCallsign({ callsign: 'GHOST', name: 'Mara Voss' })).toBe('GHOST')
    expect(pilotCallsign({ callsign: '', name: 'Mara Voss' })).toBe('Mara Voss')
    expect(pilotCallsign({})).toBe('Pilot')
  })
})
