import { describe, expect, test } from 'bun:test'
import { mayBindChannel, postsByDefault } from '../discord'

describe('mayBindChannel', () => {
  test('the Mediator or the Organiser, never a player alone', () => {
    expect(mayBindChannel({ mediator: true, organizer: false })).toBe(true)
    expect(mayBindChannel({ mediator: false, organizer: true })).toBe(true)
    expect(mayBindChannel({ mediator: false, organizer: false })).toBe(false)
  })
})

describe('postsByDefault', () => {
  test('a player posts, the Mediator rolls privately, solo posts', () => {
    expect(postsByDefault({ mediator: false })).toBe(true)
    expect(postsByDefault({ mediator: true })).toBe(false)
    expect(postsByDefault(null)).toBe(true)
  })
})
