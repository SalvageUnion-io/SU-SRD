import { describe, expect, test } from 'bun:test'
import { formatClock, formatDateTime, formatDay } from '../formatDate'

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
})
