import { describe, expect, test } from 'bun:test'
import { memberName, unnamedMember } from '../memberName'

describe('memberName (r6 C11)', () => {
  test('a named member goes by their name', () => {
    expect(memberName('Mara', 3)).toBe('Mara')
  })
  test('one with no name goes by their place in the joining order', () => {
    expect(memberName(null, 1)).toBe('Player 2')
    expect(memberName('  ', 2)).toBe('Player 3')
    expect(unnamedMember(0)).toBe('Player 1')
  })
})
