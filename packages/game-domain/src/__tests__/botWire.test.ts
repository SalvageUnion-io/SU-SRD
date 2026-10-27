import { describe, expect, it } from 'bun:test'
import { BOT_RELAY_POST_ROLL_PATH, isPostableRoll, relayUrl } from '../botWire'

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

describe('relayUrl', () => {
  it('names a relay path as a binding fetch takes it', () => {
    expect(new URL(relayUrl(BOT_RELAY_POST_ROLL_PATH)).pathname).toBe('/relay/post-roll')
  })
})
