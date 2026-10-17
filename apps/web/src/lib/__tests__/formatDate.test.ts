import { describe, expect, test } from 'bun:test'
import { formatAgo, formatClock, formatDateTime, formatDay } from '../formatDate'

const TS = Date.UTC(2026, 9, 14, 13, 5)

describe('formatDate', () => {
  test('every format follows the viewer locale', () => {
    const at = new Date(TS)
    expect(formatClock(TS)).toBe(
      at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    )
    expect(formatDay(TS)).toBe(
      at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    )
    expect(formatDateTime(TS)).toBe(
      at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    )
  })

  test('a day names its year', () => {
    expect(formatDay(TS)).toContain('2026')
  })

  test('ago says when, in words', () => {
    expect(formatAgo(0, 30_000)).toBe('just now')
    expect(formatAgo(0, 2 * 60_000)).toBe('2 min ago')
    expect(formatAgo(0, 3 * 60 * 60_000)).toBe('3 h ago')
    expect(formatAgo(0, 49 * 60 * 60_000)).toBe('2 days ago')
  })
})
