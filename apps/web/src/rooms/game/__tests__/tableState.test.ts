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

describe('up now', () => {
  test('the Mediator marks whose turn it is, every seat reads it, and clearing it reads newer', () => {
    const { room } = table()
    room.scene.setUpNow(MEDIATOR, 'p1', AT)
    expect(room.scene.scene(PLAYER)).toEqual({ conditions: [], hours: 0, upNow: 'p1' })
    expect(room.scene.updatedAt('scene')).toBe(AT)
    room.scene.setConditions(MEDIATOR, ['freezing'], AT + 1)
    expect(room.scene.scene(PLAYER).upNow).toBe('p1')
    room.scene.setUpNow(MEDIATOR, 'p2', AT + 2)
    expect(room.scene.scene(PLAYER).upNow).toBe('p2')
    room.scene.setUpNow(MEDIATOR, null, AT + 3)
    expect(room.scene.scene(PLAYER)).toEqual({ conditions: ['freezing'], hours: 0 })
    expect(room.scene.updatedAt('scene')).toBe(AT + 3)
    expect(room.scene.scene(STRANGER)).toEqual({ conditions: [], hours: 0 })
    expect(() => room.scene.setUpNow(PLAYER, 'p1', AT)).toThrow('Only the Mediator')
    expect(() => room.scene.setUpNow(MEDIATOR, '', AT)).toThrow()
    // A marker is no roll and no alert.
    expect(room.log.rolls(PLAYER)).toEqual([])
    expect(room.log.alerts(PLAYER)).toEqual([])
  })
})

/** ADR-068 §4: what the Mediator puts on the table, filtered as the room keeps it. */
describe('on the table, and Hold', () => {
  test('an NPC is served by its name and kind alone; a roll table by its name; null clears', () => {
    const { room } = table()
    const id = room.opposition.addNpc(
      MEDIATOR,
      { name: 'Raider 2', refSchema: 'npcs', refSlug: 'raider', currentHp: 5, maxHp: 6 },
      AT
    )
    room.scene.putOnTable(MEDIATOR, { kind: 'npc', npcId: id }, AT + 1)
    expect(room.scene.scene(PLAYER).onTable).toEqual({
      kind: 'npc',
      name: 'Raider 2',
      refSchema: 'npcs',
      refSlug: 'raider',
    })
    expect(room.scene.updatedAt('scene')).toBe(AT + 1)
    // Its numbers moving changes nothing a player is served.
    room.opposition.updateNpc(MEDIATOR, id, { currentHp: 1 }, AT + 2)
    expect(JSON.stringify(room.scene.scene(PLAYER))).not.toContain('Hp')
    room.scene.putOnTable(MEDIATOR, { kind: 'table', name: ' Core Mechanic ' }, AT + 3)
    expect(room.scene.scene(PLAYER).onTable).toEqual({ kind: 'table', name: 'Core Mechanic' })
    room.scene.putOnTable(MEDIATOR, null, AT + 4)
    expect(room.scene.scene(PLAYER).onTable).toBeUndefined()
    expect(room.scene.updatedAt('scene')).toBe(AT + 4)
    expect(() => room.scene.putOnTable(PLAYER, { kind: 'table', name: 'X' }, AT)).toThrow(
      'Only the Mediator'
    )
    expect(() => room.scene.putOnTable(MEDIATOR, { kind: 'npc', npcId: 'gone' }, AT)).toThrow(
      'no longer on the tray'
    )
    expect(() => room.scene.putOnTable(MEDIATOR, { kind: 'table', name: ' ' }, AT)).toThrow()
  })

  test('the Mediator holds the table and lets it go; every seat reads it', () => {
    const { room } = table()
    room.scene.setHold(MEDIATOR, true, AT)
    expect(room.scene.scene(PLAYER).hold).toBe(true)
    expect(room.scene.scene(STRANGER).hold).toBeUndefined()
    room.scene.setHold(MEDIATOR, false, AT + 1)
    expect(room.scene.scene(PLAYER)).toEqual({ conditions: [], hours: 0 })
    expect(() => room.scene.setHold(PLAYER, true, AT)).toThrow('Only the Mediator')
    const c = { room, actor: MEDIATOR, gameId: 'g1', at: AT + 2 }
    expect(runAct(c, 'scenes.hold', { hold: true })).toEqual({ ok: true, value: undefined })
  })
})

describe('asking a seat for a roll', () => {
  test('the Mediator asks; only that seat and the Mediator read it; the seat answers it', () => {
    const { room } = crewed()
    room.scene.askRoll(MEDIATOR, 'p1', ' Core Mechanic ', AT + 1)
    const ask = [{ pilotId: 'p1', table: 'Core Mechanic' }]
    expect(room.scene.scene(MEDIATOR).asks).toEqual(ask)
    expect(room.scene.scene(PLAYER).asks).toEqual(ask)
    expect(room.scene.scene(ORGANIZER).asks).toBeUndefined()
    expect(room.scene.updatedAt('scene')).toBe(AT + 1)
    expect(() => room.scene.askRoll(PLAYER, 'p1', 'Core Mechanic', AT)).toThrow('Only the Mediator')
    expect(() => room.scene.askRoll(MEDIATOR, 'c1', 'Core Mechanic', AT)).toThrow('not a Pilot')
    expect(() => room.scene.answerAsk(ORGANIZER, 'p1', AT)).toThrow()
    room.scene.answerAsk(PLAYER, 'p1', AT + 2)
    expect(room.scene.scene(MEDIATOR).asks).toBeUndefined()
    room.scene.askRoll(MEDIATOR, 'p1', 'Group Initiative', AT + 3)
    room.scene.askRoll(MEDIATOR, 'p1', null, AT + 4)
    expect(room.scene.scene(PLAYER)).toEqual({ conditions: [], hours: 0 })
    const c = { room, actor: MEDIATOR, gameId: 'g1', at: AT + 5 }
    expect(runAct(c, 'scenes.askRoll', { pilotId: 'p1', table: 'Core Mechanic' }).ok).toBe(true)
    expect(runAct({ ...c, actor: PLAYER }, 'scenes.answerAsk', { pilotId: 'p1' }).ok).toBe(true)
  })
})

describe("the Mediator's rolls", () => {
  const roll = (description: string, hidden: boolean, ts: number) => ({
    entityType: 'game',
    field: 'roll',
    after: { description, ...(hidden ? { private: true } : {}) },
    source: 'play',
    ts,
  })

  test('a shared one reaches every seat; a private one only the Mediator', () => {
    const { room } = table()
    room.log.append(MEDIATOR, [roll('Mediator · Morale · 4', false, AT)])
    room.log.append(MEDIATOR, [roll('Mediator · Reaction · 9', true, AT + 1)])
    expect(room.log.rolls(PLAYER).map((r) => r.description)).toEqual(['Mediator · Morale · 4'])
    expect(room.log.rolls(MEDIATOR)).toMatchObject([
      { description: 'Mediator · Reaction · 9', private: true },
      { description: 'Mediator · Morale · 4' },
    ])
    expect(room.log.rolls(MEDIATOR)[1]).not.toHaveProperty('private')
  })

  test("a player's roll is never private, whatever the client sent", () => {
    const { room } = table()
    room.log.append(PLAYER, [roll('Rook · Core Mechanic · 14', true, AT)])
    expect(room.log.rolls(ORGANIZER)).toMatchObject([{ description: 'Rook · Core Mechanic · 14' }])
    expect(room.log.rolls(PLAYER)[0]).not.toHaveProperty('private')
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
    expect(room.safety.showStop(PLAYER, AT)).toBe(true)
    expect(room.safety.showStop(ORGANIZER, AT + 5)).toBe(false)
    expect(room.safety.stopSign(PLAYER)).toEqual({
      stop: { shownAt: AT, mine: true },
      mayLift: true,
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

  test('showing it always posts, at most once a minute, while it is still up', () => {
    const { room } = table()
    expect(room.safety.showStop(PLAYER, AT)).toBe(true)
    expect(room.safety.stillPosting()).toBe(true)
    room.safety.liftStop(PLAYER, AT)
    expect(room.safety.stillPosting()).toBe(false)
    expect(room.safety.showStop(PLAYER, AT + 30_000)).toBe(false)
    room.safety.liftStop(PLAYER, AT)
    expect(room.safety.showStop(PLAYER, AT + 60_000)).toBe(true)
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

    expect(runAct(me, 'safety.showStop', undefined as never)).toEqual({ ok: true, value: true })
    expect(runAct(me, 'safety.stopSign', undefined as never)).toMatchObject({
      value: { stop: { mine: true }, mayLift: true },
    })
    runAct(me, 'safety.liftStop', undefined as never)
  })
})
