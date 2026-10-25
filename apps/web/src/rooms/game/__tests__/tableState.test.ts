import { describe, expect, test } from 'bun:test'
import { downtimeStepCount, isUpkeepStep } from 'game-domain/rules/downtime'
import { runAct } from '../acts'
import { AT, bodies, MEDIATOR, ORGANIZER, op, PLAYER, STRANGER, table } from './harness'

const faction = { id: 'f1', name: 'Union', standing: 'friendly' as const, deal: true }
const job = { id: 'j1', name: 'Haul', factionId: 'f1', pay: 3, payTl: 2 }

/** A table with a primary crawler and the player's pilot. */
function crewed() {
  const made = table()
  const { room } = made
  room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
  room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
  return made
}

function scrapOf(room: ReturnType<typeof table>['room']) {
  return room.store.unit('c1')?.body.scrapPool
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

describe('the ledger', () => {
  test('the Mediator keeps its factions and jobs; every member reads them', () => {
    const { room } = crewed()
    expect(room.ledger.ledger(STRANGER)).toBeNull()
    expect(room.ledger.ledger(PLAYER)).toEqual({ factions: [], jobs: [], incomeCollected: false })
    room.ledger.setFaction(MEDIATOR, faction, AT)
    room.ledger.setJob(MEDIATOR, job, AT)
    expect(room.ledger.ledger(PLAYER)).toMatchObject({
      factions: [faction],
      jobs: [{ ...job, state: 'open' }],
    })
    expect(() => room.ledger.setFaction(PLAYER, faction, AT)).toThrow()
    expect(() => room.ledger.setJob(MEDIATOR, { ...job, pay: 100_000 }, AT)).toThrow(
      'fit the ledger'
    )
    room.ledger.setJobState(MEDIATOR, 'j1', 'dropped', AT)
    room.ledger.setJobState(MEDIATOR, 'j1', 'open', AT)
    expect(() => room.ledger.setJobState(MEDIATOR, 'nope', 'open', AT)).toThrow('not in the ledger')
    room.ledger.removeFaction(MEDIATOR, 'f1', AT)
    expect(() => room.ledger.removeFaction(MEDIATOR, 'f1', AT)).toThrow('not in the ledger')
    room.ledger.removeJob(MEDIATOR, 'j1', AT)
    expect(room.ledger.ledger(PLAYER)).toMatchObject({ factions: [], jobs: [] })
  })

  test('a finished job pays the crawler once, as an op no client could send', () => {
    const { room } = crewed()
    room.ledger.setJob(MEDIATOR, job, AT)
    expect(room.ledger.completeJob(MEDIATOR, 'j1', AT)).toEqual({
      scrap: 3,
      tl: 2,
      crawlerName: 'Crawler c1',
    })
    expect(scrapOf(room)).toMatchObject({ tl2: 3 })
    expect(room.ledger.completeJob(MEDIATOR, 'j1', AT)).toBeNull()
    expect(scrapOf(room)).toMatchObject({ tl2: 3 })
    expect(() => room.ledger.setJobState(MEDIATOR, 'j1', 'open', AT)).toThrow('it has paid')
    expect(room.units.history(MEDIATOR, 'c1').at(-1)).toMatchObject({ source: 'ledger' })
    expect(() =>
      room.units.submit(MEDIATOR, [op('c1', { scrapPool: { tl1: 99 } }, { source: 'ledger' })])
    ).toThrow('only come from the Game')
  })

  test('a Game with no crawler has nowhere to pay', () => {
    const { room } = table()
    room.ledger.setJob(MEDIATOR, { ...job, pay: 0 }, AT)
    expect(() => room.ledger.completeJob(MEDIATOR, 'j1', AT)).toThrow('no crawler')
    expect(room.ledger.ledger(PLAYER)?.jobs[0]?.state).toBe('open')
  })

  test('deal income is collected once per Downtime, in the Upkeep step, at the crawler’s Tech Level', () => {
    const { room } = crewed()
    room.ledger.setFaction(MEDIATOR, faction, AT)
    room.ledger.setFaction(MEDIATOR, { ...faction, id: 'f2', deal: false }, AT)
    expect(() => room.ledger.collectIncome(MEDIATOR, AT)).toThrow('not running')
    room.play.beginDowntime(MEDIATOR, AT)
    if (!isUpkeepStep(0)) {
      expect(() => room.ledger.collectIncome(MEDIATOR, AT)).toThrow('step')
    }
    const upkeep = Array.from({ length: downtimeStepCount() }, (_, i) => i).find(isUpkeepStep)
    room.play.setDowntimeStep(MEDIATOR, upkeep ?? 0)
    expect(room.ledger.collectIncome(MEDIATOR, AT)).toEqual({
      scrap: 1,
      tl: 1,
      crawlerName: 'Crawler c1',
    })
    expect(room.ledger.ledger(PLAYER)?.incomeCollected).toBe(true)
    expect(room.ledger.collectIncome(MEDIATOR, AT)).toBeNull()
    expect(scrapOf(room)).toMatchObject({ tl1: 1 })

    room.play.endDowntime(MEDIATOR)
    room.ledger.removeFaction(MEDIATOR, 'f1', AT)
    room.play.beginDowntime(MEDIATOR, AT + 1)
    room.play.setDowntimeStep(MEDIATOR, upkeep ?? 0)
    expect(room.ledger.ledger(PLAYER)?.incomeCollected).toBe(false)
    expect(() => room.ledger.collectIncome(MEDIATOR, AT)).toThrow('no deals')
  })
})

describe('Safety Protocols', () => {
  test('any member adds a boundary; whoever added it or the table runner takes it off', () => {
    const { room } = table()
    const mine = room.safety.addBoundary(PLAYER, 'outOfBounds', '  spiders   in   mechs ', AT)
    room.safety.addBoundary(ORGANIZER, 'offCamera', 'Torture', AT + 1)
    expect(room.safety.boundaries(PLAYER)).toEqual([
      {
        id: mine,
        kind: 'outOfBounds',
        text: 'spiders in mechs',
        mine: true,
        mayRemove: true,
        addedAt: AT,
      },
      {
        id: expect.any(String),
        kind: 'offCamera',
        text: 'Torture',
        mine: false,
        mayRemove: false,
        addedAt: AT + 1,
      },
    ])
    expect(room.safety.boundaries(MEDIATOR).every((b) => b.mayRemove)).toBe(true)
    expect(room.safety.boundaries(STRANGER)).toEqual([])
    expect(() => room.safety.addBoundary(PLAYER, 'outOfBounds', '   ', AT)).toThrow('some words')
    expect(() => room.safety.addBoundary(STRANGER, 'offCamera', 'x', AT)).toThrow()
    const theirs = room.safety.boundaries(PLAYER)[1]?.id ?? ''
    expect(() => room.safety.removeBoundary(PLAYER, theirs)).toThrow('Only whoever added')
    room.safety.removeBoundary(PLAYER, mine)
    room.safety.removeBoundary(MEDIATOR, theirs)
    room.safety.removeBoundary(MEDIATOR, theirs)
    expect(room.safety.boundaries(PLAYER)).toEqual([])
  })

  test('a Game keeps at most so many boundaries', () => {
    const { room } = table()
    for (let i = 0; i < 60; i++) room.safety.addBoundary(PLAYER, 'offCamera', `b${i}`, AT + i)
    expect(() => room.safety.addBoundary(PLAYER, 'offCamera', 'one more', AT)).toThrow('at most')
  })

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

    runAct(med, 'ledger.setFaction', { faction })
    runAct(med, 'ledger.setJob', { job })
    runAct(med, 'ledger.setJobState', { id: 'j1', state: 'dropped' })
    runAct(med, 'ledger.setJobState', { id: 'j1', state: 'open' })
    expect(runAct(med, 'ledger.completeJob', { id: 'j1' })).toMatchObject({ value: { scrap: 3 } })
    expect(runAct(med, 'ledger.collectIncome', undefined as never)).toEqual({
      ok: false,
      refusal: 'Downtime is not running',
    })
    runAct(med, 'ledger.removeJob', { id: 'j1' })
    runAct(med, 'ledger.removeFaction', { id: 'f1' })
    expect(runAct(me, 'ledger.get', undefined as never)).toMatchObject({ value: { jobs: [] } })

    const added = runAct(me, 'safety.addBoundary', { kind: 'offCamera', text: 'Spiders' })
    expect(runAct(me, 'safety.boundaries', undefined as never)).toMatchObject({
      value: [{ text: 'Spiders', mayRemove: true }],
    })
    if (added.ok) runAct(me, 'safety.removeBoundary', { boundaryId: added.value })
    runAct(med, 'safety.setPostToChannel', { on: true })
    expect(runAct(me, 'safety.showStop', undefined as never)).toEqual({ ok: true, value: true })
    expect(runAct(me, 'safety.stopSign', undefined as never)).toMatchObject({
      value: { stop: { mine: true }, postToChannel: true },
    })
    runAct(me, 'safety.liftStop', undefined as never)
  })
})
