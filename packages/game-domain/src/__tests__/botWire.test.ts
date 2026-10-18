import { describe, expect, it } from 'bun:test'
import { bearerToken, isPostableRoll, secretsMatch } from '../botWire'

describe('isPostableRoll', () => {
  it('takes a named table and one or two whole d20s', () => {
    expect(isPostableRoll('Core Mechanic', [14])).toBe(true)
    expect(isPostableRoll('Critical Damage', [1, 20])).toBe(true)
  })

  it('refuses a blank table name', () => {
    expect(isPostableRoll('   ', [14])).toBe(false)
  })

  it('refuses no dice, or more than two', () => {
    expect(isPostableRoll('Core Mechanic', [])).toBe(false)
    expect(isPostableRoll('Core Mechanic', [1, 2, 3])).toBe(false)
  })

  it('refuses a die off the d20 or not a whole number', () => {
    expect(isPostableRoll('Core Mechanic', [0])).toBe(false)
    expect(isPostableRoll('Core Mechanic', [21])).toBe(false)
    expect(isPostableRoll('Core Mechanic', [3.5])).toBe(false)
    expect(isPostableRoll('Core Mechanic', ['14'])).toBe(false)
  })
})

describe('secretsMatch', () => {
  it('matches only the same secret', () => {
    expect(secretsMatch('s3cret', 's3cret')).toBe(true)
    expect(secretsMatch('s3cret', 's3creT')).toBe(false)
  })

  it('refuses a secret of another length', () => {
    expect(secretsMatch('s3cret', 's3cret!')).toBe(false)
  })
})

describe('bearerToken', () => {
  it('reads the token from a bearer header', () => {
    expect(bearerToken('Bearer abc.def')).toBe('abc.def')
    expect(bearerToken('  Bearer abc  ')).toBe('abc')
  })

  it('is null for a missing, empty or non-bearer header', () => {
    expect(bearerToken(null)).toBeNull()
    expect(bearerToken('Bearer ')).toBeNull()
    expect(bearerToken('Basic abc')).toBeNull()
  })
})
