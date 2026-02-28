import { describe, test, expect } from 'bun:test'
import { formatRelativeTime, formatAbsoluteTime } from '../timeFormatting'

describe('formatRelativeTime', () => {
  const now = new Date('2026-02-24T12:00:00Z')

  test('seconds ago', () => {
    const date = new Date('2026-02-24T11:59:30Z')
    const result = formatRelativeTime(date, now)
    expect(result).toContain('30')
    expect(result).toMatch(/ago|s/)
  })

  test('minutes ago', () => {
    const date = new Date('2026-02-24T11:55:00Z')
    const result = formatRelativeTime(date, now)
    expect(result).toContain('5')
    expect(result).toMatch(/ago|m/)
  })

  test('hours ago', () => {
    const date = new Date('2026-02-24T09:00:00Z')
    const result = formatRelativeTime(date, now)
    expect(result).toContain('3')
    expect(result).toMatch(/ago|h/)
  })

  test('days ago', () => {
    const date = new Date('2026-02-22T12:00:00Z')
    const result = formatRelativeTime(date, now)
    expect(result).toContain('2')
    expect(result).toMatch(/ago|d/)
  })

  test('just now', () => {
    const result = formatRelativeTime(now, now)
    expect(result).toBeTruthy()
  })
})

describe('formatAbsoluteTime', () => {
  test('formats a date as readable string', () => {
    const date = new Date('2026-02-24T15:30:00Z')
    const result = formatAbsoluteTime(date)
    expect(result).toContain('2026')
    expect(result).toContain('Feb')
  })
})
