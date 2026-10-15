import { describe, expect, test } from 'bun:test'
import { cn } from '../cn'

describe('cn', () => {
  test('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  test('handles falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar')
  })

  test('handles conditional classes', () => {
    const isActive = true
    const isDisabled = false
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active')
  })

  test('keeps every class: the stylesheet, not cn, decides between them', () => {
    expect(cn('su-btn su-btn--primary', 'su-btn--full')).toBe('su-btn su-btn--primary su-btn--full')
  })

  test('handles empty input', () => {
    expect(cn()).toBe('')
  })

  test('handles array input', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })
})
