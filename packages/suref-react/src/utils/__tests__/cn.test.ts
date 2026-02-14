import { describe, test, expect } from 'bun:test'
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

  test('deduplicates tailwind classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  test('handles empty input', () => {
    expect(cn()).toBe('')
  })

  test('handles array input', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })
})
