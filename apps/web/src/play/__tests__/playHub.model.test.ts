import { describe, expect, test } from 'bun:test'
import { gameChips, gameDoor, gameRowModel } from '../playHub.model'

/** The Play hub's Your Games: a Game's Row, its chips and its one door (ADR-052 §4). */

const GAME = { _id: 'g1', name: 'The Rust Belt Run', mediator: false }

describe('a Game’s Row', () => {
  test('is titled by the Game, in the crawler’s tone, and links nowhere by itself', () => {
    const model = gameRowModel('The Rust Belt Run')
    expect(model.title).toBe('The Rust Belt Run')
    expect(model.tone).toBe('crawler')
    expect(model.ref.synthetic).toBe(true)
    expect(model.facts).toEqual([])
  })
})

describe('its chips', () => {
  test('your role, how many are here, and the Downtime step', () => {
    expect(
      gameChips({ mediator: false, here: 3, downtime: { running: true, stepIndex: 3 } })
    ).toEqual([
      { key: 'role', label: 'Player' },
      { key: 'here', label: '3 here' },
      { key: 'downtime', label: 'Downtime', value: 'Step 4' },
    ])
  })

  test('nobody here and no Downtime: the role alone', () => {
    expect(
      gameChips({ mediator: true, here: 0, downtime: { running: false, stepIndex: null } })
    ).toEqual([{ key: 'role', label: 'Mediator' }])
    expect(gameChips({ mediator: true, here: 0, downtime: undefined })).toEqual([
      { key: 'role', label: 'Mediator' },
    ])
  })

  test('a Downtime with no step yet is named alone', () => {
    expect(
      gameChips({ mediator: false, here: 0, downtime: { running: true, stepIndex: null } })[1]
    ).toEqual({ key: 'downtime', label: 'Downtime' })
  })
})

describe('its one door', () => {
  test('Mediate where you mediate, even with a pilot there', () => {
    expect(gameDoor({ ...GAME, mediator: true }, [{ id: 'p1', name: 'Bonesaw' }])).toEqual({
      label: 'Mediate',
      href: '/play/game/g1',
      ariaLabel: 'Mediate The Rust Belt Run',
    })
  })

  test('else Play your pilot', () => {
    expect(gameDoor(GAME, [{ id: 'p1', name: 'Bonesaw' }])).toEqual({
      label: 'Play Bonesaw',
      href: '/play/p1',
      ariaLabel: 'Play Bonesaw in The Rust Belt Run',
    })
  })

  test('none with no pilot of yours there', () => {
    expect(gameDoor(GAME, [])).toBeNull()
  })
})
