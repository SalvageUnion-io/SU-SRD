import { describe, expect, test } from 'bun:test'
import { mayBindChannel } from '../discord'

describe('mayBindChannel', () => {
  test('the Mediator or the Organiser, never a player alone', () => {
    expect(mayBindChannel({ mediator: true, organizer: false })).toBe(true)
    expect(mayBindChannel({ mediator: false, organizer: true })).toBe(true)
    expect(mayBindChannel({ mediator: false, organizer: false })).toBe(false)
  })
})
