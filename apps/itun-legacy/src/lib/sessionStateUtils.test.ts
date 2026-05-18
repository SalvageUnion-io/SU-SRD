import { describe, test, expect } from 'bun:test'
import { mergeSessionState, defaultSessionState, type SessionState } from './sessionStateUtils'

// ---------------------------------------------------------------------------
// defaultSessionState — zero-value for a new session
// ---------------------------------------------------------------------------

describe('defaultSessionState', () => {
  test('returns correct zero-value shape', () => {
    const s = defaultSessionState()
    expect(s.round_number).toBe(0)
    expect(s.initiative_winner).toBeNull()
    expect(s.active_encounter_id).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// mergeSessionState — shallow-merges patch onto existing, never replaces wholesale
// ---------------------------------------------------------------------------

describe('mergeSessionState', () => {
  test('merges round_number patch without clobbering other fields', () => {
    const existing: SessionState = {
      round_number: 3,
      initiative_winner: 'players',
      active_encounter_id: null,
    }
    const result = mergeSessionState(existing, { round_number: 4 })
    expect(result.round_number).toBe(4)
    expect(result.initiative_winner).toBe('players')
    expect(result.active_encounter_id).toBeNull()
  })

  test('merges initiative_winner patch without clobbering round_number', () => {
    const existing: SessionState = {
      round_number: 2,
      initiative_winner: null,
      active_encounter_id: null,
    }
    const result = mergeSessionState(existing, { initiative_winner: 'npcs' })
    expect(result.round_number).toBe(2)
    expect(result.initiative_winner).toBe('npcs')
  })

  test('uses defaultSessionState when existing is null', () => {
    const result = mergeSessionState(null, { round_number: 1 })
    expect(result.round_number).toBe(1)
    expect(result.initiative_winner).toBeNull()
    expect(result.active_encounter_id).toBeNull()
  })

  test('merging an empty patch returns a copy of the existing state', () => {
    const existing: SessionState = {
      round_number: 5,
      initiative_winner: 'players',
      active_encounter_id: null,
    }
    const result = mergeSessionState(existing, {})
    expect(result).toEqual(existing)
    // must be a new object (not same reference)
    expect(result).not.toBe(existing)
  })

  test('does not allow round_number to go below 0 — clamps to 0', () => {
    const existing: SessionState = {
      round_number: 0,
      initiative_winner: null,
      active_encounter_id: null,
    }
    const result = mergeSessionState(existing, { round_number: -1 })
    expect(result.round_number).toBe(0)
  })
})
