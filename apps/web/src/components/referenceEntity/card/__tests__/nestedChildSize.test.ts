/**
 * A nested child renders compact, or mini inside a mini card, so a child never
 * outgrows its parent.
 */
import { describe, expect, test } from 'bun:test'
import { nestedChildSize } from '../entityCardTone'

describe('nestedChildSize', () => {
  test('nested children render compact, or mini inside a mini card', () => {
    expect(nestedChildSize('full')).toBe('compact')
    expect(nestedChildSize('compact')).toBe('compact')
    expect(nestedChildSize('mini')).toBe('mini')
  })
})
