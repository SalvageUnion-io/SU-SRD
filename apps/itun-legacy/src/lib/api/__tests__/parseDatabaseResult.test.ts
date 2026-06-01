import { describe, test, expect } from 'bun:test'
import { z } from 'zod'
import {
  parseDatabaseResult,
  parseDatabaseResultArray,
  DatabaseParseError,
} from '../parseDatabaseResult'

const PilotSchema = z.object({
  id: z.string(),
  callsign: z.string(),
  hp: z.number(),
})

describe('parseDatabaseResult', () => {
  test('parses a valid row', () => {
    const row = { id: 'p1', callsign: 'Nomad', hp: 10 }
    const result = parseDatabaseResult(row, PilotSchema)
    expect(result).toEqual(row)
  })

  test('strips unknown keys by default (Zod passthrough off)', () => {
    const row = { id: 'p1', callsign: 'Nomad', hp: 10, extra: 'ignored' }
    const result = parseDatabaseResult(row, PilotSchema)
    expect(result).toEqual({ id: 'p1', callsign: 'Nomad', hp: 10 })
  })

  test('throws DatabaseParseError for invalid shape', () => {
    const row = { id: 'p1', callsign: 'Nomad', hp: 'ten' }
    expect(() => parseDatabaseResult(row, PilotSchema)).toThrow(DatabaseParseError)
  })

  test('throws with context prefix in the message', () => {
    const row = { id: 'p1' }
    let caught: unknown
    try {
      parseDatabaseResult(row, PilotSchema, 'getPilotById')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(DatabaseParseError)
    const err = caught as DatabaseParseError
    expect(err.message).toContain('[getPilotById]')
    expect(err.context).toBe('getPilotById')
    expect(Array.isArray(err.issues)).toBe(true)
  })

  test('throws DatabaseParseError on null input', () => {
    expect(() => parseDatabaseResult(null, PilotSchema, 'ctx')).toThrow(
      /Expected database row but received null\/undefined/
    )
  })

  test('throws DatabaseParseError on undefined input', () => {
    expect(() => parseDatabaseResult(undefined, PilotSchema)).toThrow(DatabaseParseError)
  })
})

describe('parseDatabaseResultArray', () => {
  test('parses an array of valid rows', () => {
    const rows = [
      { id: 'p1', callsign: 'Nomad', hp: 10 },
      { id: 'p2', callsign: 'Scrapper', hp: 8 },
    ]
    const result = parseDatabaseResultArray(rows, PilotSchema)
    expect(result).toEqual(rows)
  })

  test('returns [] when data is null', () => {
    expect(parseDatabaseResultArray(null, PilotSchema)).toEqual([])
  })

  test('returns [] when data is undefined', () => {
    expect(parseDatabaseResultArray(undefined, PilotSchema)).toEqual([])
  })

  test('throws when data is not an array', () => {
    expect(() => parseDatabaseResultArray({ not: 'an array' }, PilotSchema, 'listPilots')).toThrow(
      /Expected array of database rows/
    )
  })

  test('throws with index context when any row is invalid', () => {
    const rows = [
      { id: 'p1', callsign: 'Nomad', hp: 10 },
      { id: 'p2', callsign: 'Scrapper', hp: 'eight' },
    ]
    let caught: unknown
    try {
      parseDatabaseResultArray(rows, PilotSchema, 'listPilots')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(DatabaseParseError)
    const err = caught as DatabaseParseError
    expect(err.message).toContain('[listPilots]')
    expect(err.message).toContain('index 1')
  })
})
