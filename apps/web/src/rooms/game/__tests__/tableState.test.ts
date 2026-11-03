import { describe, expect, test } from 'bun:test'
import { runAct } from '../acts'
import { AT, bodies, MEDIATOR, ORGANIZER, op, PLAYER, STRANGER, table } from './harness'

/** A table with a primary crawler and the player's pilot. */
function crewed() {
  const made = table()
  const { room } = made
  room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
  room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
  return made
}

describe('the Scene', () => {
  test('the Mediator sets its conditions in catalogue order, and the hours pass under them', () => {
    const { room } = table()
    expect(room.scene.scene(PLAYER)).toEqual({ conditions: [], hours: 0 })
    expect(room.scene.passHour(MEDIATOR, AT)).toBe(0)
    room.scene.setConditions(MEDIATOR, ['freezing', 'radiation-storm', 'freezing', 'nope'], AT)
    expect(room.scene.scene(PLAYER)).toEqual({
      conditions: ['radiation-storm', 'freezing'],
      hours: 0,
    })
    expect(room.scene.passHour(MEDIATOR, AT)).toBe(1)
    expect(room.scene.passHour(MEDIATOR, AT)).toBe(2)
    room.scene.setConditions(MEDIATOR, ['freezing'], AT)
    expect(room.scene.scene(PLAYER).hours).toBe(2)
    room.scene.setConditions(MEDIATOR, [], AT)
    expect(room.scene.scene(PLAYER)).toEqual({ conditions: [], hours: 0 })
    expect(room.scene.scene(STRANGER)).toEqual({ conditions: [], hours: 0 })
    expect(() => room.scene.setConditions(PLAYER, ['freezing'], AT)).toThrow()
    expect(() => room.scene.passHour(PLAYER, AT)).toThrow()
  })
})

describe('the area being salvaged', () => {
  test('each roll spends 1 Supply, on the Tech Level it was set at, until it is picked clean', () => {
    const { room } = crewed()
    expect(() => room.scene.spendSupply(PLAYER, 'p1', AT)).toThrow('no area to salvage')
    room.scene.setSalvageArea(MEDIATOR, { name: '  Raider Camp ', techLevel: 3, supply: 2 }, AT)
    expect(room.scene.salvageArea(PLAYER)).toEqual({ name: 'Raider Camp', techLevel: 3, supply: 2 })
    expect(room.scene.salvageArea(STRANGER)).toBeNull()
    expect(room.scene.spendSupply(PLAYER, 'p1', AT)).toEqual({ techLevel: 3, supply: 1 })
    expect(room.scene.spendSupply(PLAYER, 'p1', AT)).toEqual({ techLevel: 3, supply: 0 })
    expect(() => room.scene.spendSupply(PLAYER, 'p1', AT)).toThrow('picked clean')
    // Only whoever plays the pilot rolls for it, and only a pilot rolls.
    expect(() => room.scene.spendSupply(MEDIATOR, 'p1', AT)).toThrow()
    expect(() => room.scene.spendSupply(MEDIATOR, 'c1', AT)).toThrow('not in this Game')
    expect(() =>
      room.scene.setSalvageArea(MEDIATOR, { name: 'x', techLevel: 9, supply: 1 }, AT)
    ).toThrow('Tech Level of 1 to 6')
    expect(() =>
      room.scene.setSalvageArea(PLAYER, { name: 'x', techLevel: 1, supply: 1 }, AT)
    ).toThrow()
    room.scene.setSalvageArea(MEDIATOR, null, AT)
    expect(room.scene.salvageArea(PLAYER)).toBeNull()
  })
})

describe('the retired ledger', () => {
  test('its pay-out source stays one no client may send', () => {
    const { room } = crewed()
    expect(() =>
      room.units.submit(MEDIATOR, [op('c1', { scrapPool: { tl1: 99 } }, { source: 'ledger' })])
    ).toThrow('only come from the Game')
  })
})

describe('Safety Protocols', () => {
  test('the Stop Sign pauses the game without saying who, and is lifted by them or the table runner', () => {
    const { room } = table()
    expect(room.safety.stopSign(STRANGER)).toBeNull()
    expect(room.safety.showStop(PLAYER, AT)).toBe(false)
    expect(room.safety.showStop(ORGANIZER, AT + 5)).toBe(false)
    expect(room.safety.stopSign(PLAYER)).toEqual({
      stop: { shownAt: AT, mine: true },
      mayLift: true,
      mayManage: false,
      postToChannel: false,
    })
    expect(room.safety.stopSign(ORGANIZER)).toMatchObject({
      stop: { shownAt: AT, mine: false },
      mayLift: false,
    })
    expect(JSON.stringify(room.safety.stopSign(ORGANIZER))).not.toContain(PLAYER)
    expect(() => room.safety.liftStop(ORGANIZER, AT)).toThrow('Only whoever showed')
    room.safety.liftStop(MEDIATOR, AT)
    expect(room.safety.stopSign(PLAYER)?.stop).toBeNull()
    room.safety.liftStop(PLAYER, AT)
  })

  test('with the opt-in, showing it posts at most once a minute, while it is still up', () => {
    const { room } = table()
    expect(() => room.safety.setPostToChannel(PLAYER, true, AT)).toThrow()
    room.safety.setPostToChannel(MEDIATOR, true, AT)
    expect(room.safety.showStop(PLAYER, AT)).toBe(true)
    expect(room.safety.stillPosting()).toBe(true)
    room.safety.liftStop(PLAYER, AT)
    expect(room.safety.stillPosting()).toBe(false)
    expect(room.safety.showStop(PLAYER, AT + 30_000)).toBe(false)
    room.safety.liftStop(PLAYER, AT)
    expect(room.safety.showStop(PLAYER, AT + 60_000)).toBe(true)
    room.safety.setPostToChannel(MEDIATOR, false, AT)
    expect(room.safety.stillPosting()).toBe(false)
  })
})

describe('the table’s acts, by their Convex names', () => {
  test('each reaches its part of the room, and a refusal is an answer', () => {
    const { room } = crewed()
    const as = (actor: string) => ({ room, actor, gameId: 'g1', at: AT })
    const med = as(MEDIATOR)
    const me = as(PLAYER)
    runAct(med, 'scenes.setConditions', { conditions: ['freezing'] })
    expect(runAct(med, 'scenes.passHour', undefined as never)).toEqual({ ok: true, value: 1 })
    expect(runAct(me, 'scenes.current', undefined as never)).toMatchObject({ value: { hours: 1 } })
    runAct(med, 'salvageAreas.set', { area: { name: '', techLevel: 2, supply: 1 } })
    expect(runAct(me, 'salvageAreas.spend', { pilotId: 'p1' })).toEqual({
      ok: true,
      value: { techLevel: 2, supply: 0 },
    })
    expect(runAct(me, 'salvageAreas.spend', { pilotId: 'p1' })).toEqual({
      ok: false,
      refusal: 'This area is picked clean',
    })
    expect(runAct(me, 'salvageAreas.here', undefined as never)).toMatchObject({
      value: { supply: 0 },
    })

    runAct(med, 'safety.setPostToChannel', { on: true })
    expect(runAct(me, 'safety.showStop', undefined as never)).toEqual({ ok: true, value: true })
    expect(runAct(me, 'safety.stopSign', undefined as never)).toMatchObject({
      value: { stop: { mine: true }, postToChannel: true },
    })
    runAct(me, 'safety.liftStop', undefined as never)
  })
})
