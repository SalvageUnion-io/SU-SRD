import { describe, expect, test } from 'bun:test'
import { hasMediator, runsTable } from '../roles'

const MEDIATOR = { mediator: true, organizer: false }
const ORGANIZER = { mediator: false, organizer: true }
const PLAYER = { mediator: false, organizer: false }

describe('whether the game has a Mediator', () => {
  test('it does when any member mediates', () => {
    expect(hasMediator([MEDIATOR, ORGANIZER, PLAYER])).toBe(true)
  })

  test('an Organizer is not a Mediator', () => {
    // The Dashboard needs a real Mediator (ADR-038 §1); the Organizer's
    // table-runner fallback does not count.
    expect(hasMediator([ORGANIZER, PLAYER])).toBe(false)
  })

  test('an empty roster has none', () => {
    expect(hasMediator([])).toBe(false)
  })
})

describe('who runs the table', () => {
  test('the Mediator does', () => {
    expect(runsTable(MEDIATOR, true)).toBe(true)
  })

  test('a player never does', () => {
    expect(runsTable(PLAYER, false)).toBe(false)
    expect(runsTable(PLAYER, true)).toBe(false)
  })

  test('the Organizer does only while nobody mediates', () => {
    // A brand-new Game is exactly this shape: one member, organizer, no
    // Mediator. Without the fallback nobody could raise its first crawler.
    expect(runsTable(ORGANIZER, false)).toBe(true)
    expect(runsTable(ORGANIZER, true)).toBe(false)
  })
})
