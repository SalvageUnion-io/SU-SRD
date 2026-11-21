import { describe, expect, test } from 'bun:test'
import { modKeyHint } from '../modKeyHint'

describe('modKeyHint', () => {
  test('a Mac or iOS keyboard reads the Command key', () => {
    expect(modKeyHint('MacIntel')).toBe('⌘K')
    expect(modKeyHint('iPhone')).toBe('⌘K')
  })

  test('every other keyboard reads Ctrl, in both tools', () => {
    expect(modKeyHint('Linux x86_64')).toBe('Ctrl K')
    expect(modKeyHint('Win32')).toBe('Ctrl K')
  })
})
