import { afterEach, describe, expect, setSystemTime, test } from 'bun:test'
import { downtimeGuideSteps, UPKEEP_STEP_NAME } from 'game-domain/rules/downtime'
import { PRESENCE_WRITE_MIN_MS } from 'game-domain/schemas/seat'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Ctx, User } from '../fixtures'
import {
  addMech,
  addPilot,
  makeUser,
  mechBody,
  moveOwnable,
  pilotBody,
  seatRows,
  seedTable,
} from '../fixtures'
import { testConvex } from '../harness'

/**
 * Solo seats: a pilot played on its owner's shelf, with no Game, keeps the
 * same seat state a Game seat has, plus its own Downtime, and hands it to the
 * Game's seat when it moves into one.
 *
 * The properties worth the most: only the pilot's owner reads or writes a
 * solo seat; boarding is limited to the owner's shelf mechs; upkeep is paid
 * once per solo Downtime however the steps move; and a move into a Game
 * carries the mount only when the mech is already there.
 */

const crush = { ref: 'system:crush', name: 'Crush', activated: false, applied: false }

/** The Upkeep & Upgrade step's index in the guide. */
const UPKEEP_STEP = downtimeGuideSteps().findIndex((step) => step.name === UPKEEP_STEP_NAME)

/** A player with pilot `p1` and mech `m1` on their shelf. */
async function soloPlayer(t: Ctx) {
  const player = await makeUser(t, 'Solo')
  await addPilot(player, 'p1', null)
  await addMech(player, 'm1', null)
  return player
}

async function soloSeat(user: User, pilotId = 'p1') {
  return await user.as.query(api.seats.solo, { pilotId })
}

const SOLO = { gameId: null, pilotId: 'p1' }

describe('reading a solo seat', () => {
  test('a pilot with no row reads as the default seat, and reading creates nothing', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    expect(await soloSeat(player)).toEqual({
      pilotId: 'p1',
      mount: { kind: 'foot' },
      range: 'Close',
      activeEffects: [],
      resolving: null,
      ejected: false,
      downtime: null,
      lastSeenAt: null,
      updatedAt: null,
    })
    expect(await seatRows(t)).toHaveLength(0)
  })

  test('nobody but the owner reads it, and a pilot in a Game has none', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    await player.as.mutation(api.seats.setRange, { ...SOLO, range: 'Far' })
    const stranger = await makeUser(t, 'Stranger')
    expect(await soloSeat(stranger)).toBeNull()

    const { player: member, gameId } = await seedTable(t)
    await addPilot(member, 'p-game', gameId)
    expect(await soloSeat(member, 'p-game')).toBeNull()
  })
})

describe('playing solo', () => {
  test('board, set range, toggle an effect, resolve, then dismount; state survives a re-read', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)

    await player.as.mutation(api.seats.board, { ...SOLO, mechId: 'm1' })
    await player.as.mutation(api.seats.setRange, { ...SOLO, range: 'Medium' })
    await player.as.mutation(api.seats.toggleEffect, { ...SOLO, ref: 'abilities:beefcake' })
    const rolled = { ...crush, activated: true, roll: { roll: 14, band: 'success' as const } }
    await player.as.mutation(api.seats.setResolving, { ...SOLO, resolving: rolled })

    // What this client reads after a reload.
    expect(await soloSeat(player)).toMatchObject({
      mount: { kind: 'boarded', mechId: 'm1' },
      range: 'Medium',
      activeEffects: ['abilities:beefcake'],
      resolving: rolled,
    })
    const [row] = await seatRows(t)
    expect(row?.gameId).toBeUndefined()
    expect(row?.ownerId).toBe(player.userId)

    await player.as.mutation(api.seats.clearResolving, SOLO)
    expect((await soloSeat(player))?.resolving).toBeNull()

    await player.as.mutation(api.seats.setResolving, { ...SOLO, resolving: crush })
    await player.as.mutation(api.seats.dismount, SOLO)
    expect(await soloSeat(player)).toMatchObject({ mount: { kind: 'foot' }, resolving: null })
    expect(await seatRows(t)).toHaveLength(1)
  })

  test('eject leaves the pilot on foot and flagged until the next board', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    await player.as.mutation(api.seats.board, { ...SOLO, mechId: 'm1' })
    await player.as.mutation(api.seats.eject, SOLO)
    expect(await soloSeat(player)).toMatchObject({ mount: { kind: 'foot' }, ejected: true })
    await player.as.mutation(api.seats.board, { ...SOLO, mechId: 'm1' })
    expect((await soloSeat(player))?.ejected).toBe(false)
  })

  test('each pilot on a shelf has its own seat', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    await addPilot(player, 'p2', null)
    await addMech(player, 'm2', null)
    await player.as.mutation(api.seats.board, { ...SOLO, mechId: 'm1' })
    await player.as.mutation(api.seats.board, { gameId: null, pilotId: 'p2', mechId: 'm2' })
    expect((await soloSeat(player, 'p2'))?.mount).toEqual({ kind: 'boarded', mechId: 'm2' })
    await expect(
      player.as.mutation(api.seats.board, { gameId: null, pilotId: 'p2', mechId: 'm1' })
    ).rejects.toThrow(/already aboard/i)
  })

  test("two accounts' pre-gens sharing a body id keep separate seats", async () => {
    const t = testConvex()
    const a = await makeUser(t, 'A')
    const b = await makeUser(t, 'B')
    // A claimed template pre-gen, moved to the shelf: no app id, the body id
    // every account that claimed it shares.
    await t.run(async (ctx) => {
      for (const ownerId of [a.userId, b.userId]) {
        await ctx.db.insert('pilots', {
          gameId: null,
          ownerId,
          body: pilotBody({ id: 'pregen', gameId: null }),
          updatedAt: 0,
        })
      }
    })
    await a.as.mutation(api.seats.setRange, { gameId: null, pilotId: 'pregen', range: 'Far' })
    await b.as.mutation(api.seats.setRange, { gameId: null, pilotId: 'pregen', range: 'Long' })
    expect((await soloSeat(a, 'pregen'))?.range).toBe('Far')
    expect((await soloSeat(b, 'pregen'))?.range).toBe('Long')
    expect(await seatRows(t)).toHaveLength(2)
  })
})

describe('solo refusals', () => {
  test("nobody else writes a solo seat: every write is the owner's", async () => {
    const t = testConvex()
    await soloPlayer(t)
    const stranger = await makeUser(t, 'Stranger')
    const writes = [
      () => stranger.as.mutation(api.seats.setRange, { ...SOLO, range: 'Far' }),
      () => stranger.as.mutation(api.seats.toggleEffect, { ...SOLO, ref: 'x' }),
      () => stranger.as.mutation(api.seats.board, { ...SOLO, mechId: 'm1' }),
      () => stranger.as.mutation(api.seats.dismount, SOLO),
      () => stranger.as.mutation(api.seats.eject, SOLO),
      () => stranger.as.mutation(api.seats.setResolving, { ...SOLO, resolving: crush }),
      () => stranger.as.mutation(api.seats.clearResolving, SOLO),
      () => stranger.as.mutation(api.seats.heartbeat, SOLO),
      () => stranger.as.mutation(api.downtime.soloBegin, { pilotId: 'p1' }),
      () => stranger.as.mutation(api.downtime.soloEnd, { pilotId: 'p1' }),
    ]
    for (const write of writes) {
      await expect(write()).rejects.toThrow(/another player's entity/i)
    }
    expect(await seatRows(t)).toHaveLength(0)
  })

  test('a pilot in a Game has no solo seat, and an unknown one is refused', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await addPilot(player, 'p-game', gameId)
    await expect(
      player.as.mutation(api.seats.setRange, { gameId: null, pilotId: 'p-game', range: 'Far' })
    ).rejects.toThrow(/in a Game/i)
    await expect(
      player.as.mutation(api.seats.setRange, { gameId: null, pilotId: 'nobody', range: 'Far' })
    ).rejects.toThrow(/not on your shelf/i)
  })

  test('only a mech on your own shelf, intact, is boarded solo', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    const other = await makeUser(t, 'Other')
    await addMech(other, 'm-other', null)
    await expect(
      player.as.mutation(api.seats.board, { ...SOLO, mechId: 'm-other' })
    ).rejects.toThrow(/another player's entity/i)

    const { player: member, gameId } = await seedTable(t)
    await addPilot(member, 'p-shelf', null)
    await addMech(member, 'm-game', gameId)
    await expect(
      member.as.mutation(api.seats.board, { gameId: null, pilotId: 'p-shelf', mechId: 'm-game' })
    ).rejects.toThrow(/in a Game/i)

    await player.as.mutation(api.entities.upsertByAppId, {
      table: 'mechs',
      appId: 'm1',
      gameId: null,
      body: { ...mechBody({ id: 'm1', gameId: null }), destroyed: true },
      expectedUpdatedAt: null,
    })
    await expect(player.as.mutation(api.seats.board, { ...SOLO, mechId: 'm1' })).rejects.toThrow(
      /destroyed/i
    )
  })
})

describe('solo Downtime', () => {
  const P = { pilotId: 'p1' }

  test('begin, advance, set a step and end, surviving a re-read', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    expect(await player.as.query(api.downtime.soloState, P)).toEqual({
      running: false,
      stepIndex: null,
      completedBy: [],
      upkeepSpent: false,
    })

    await player.as.mutation(api.downtime.soloBegin, P)
    await player.as.mutation(api.downtime.soloAdvance, P)
    let state = await player.as.query(api.downtime.soloState, P)
    expect(state).toMatchObject({ running: true, stepIndex: 1, completedBy: [] })
    expect((await soloSeat(player))?.downtime).toMatchObject({ stepIndex: 1, upkeepSpent: false })

    await player.as.mutation(api.downtime.soloSetStep, { ...P, stepIndex: 0 })
    expect((await player.as.query(api.downtime.soloState, P))?.stepIndex).toBe(0)

    // Held to the guide's steps both ways, and the last step is where Advance stops.
    const last = downtimeGuideSteps().length - 1
    await player.as.mutation(api.downtime.soloSetStep, { ...P, stepIndex: 99 })
    expect((await player.as.query(api.downtime.soloState, P))?.stepIndex).toBe(last)
    await player.as.mutation(api.downtime.soloAdvance, P)
    expect((await player.as.query(api.downtime.soloState, P))?.stepIndex).toBe(last)
    await player.as.mutation(api.downtime.soloSetStep, { ...P, stepIndex: -3 })
    expect((await player.as.query(api.downtime.soloState, P))?.stepIndex).toBe(0)

    await player.as.mutation(api.downtime.soloEnd, P)
    state = await player.as.query(api.downtime.soloState, P)
    expect(state?.running).toBe(false)
    expect((await soloSeat(player))?.downtime).toBeNull()
    // Ending one that is not running is not an error.
    await player.as.mutation(api.downtime.soloEnd, P)
  })

  test('upkeep is paid once per Downtime, only in its step, whatever the steps do', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    await player.as.mutation(api.downtime.soloBegin, P)
    await expect(player.as.mutation(api.downtime.soloSpendUpkeep, P)).rejects.toThrow(
      /Upkeep & Upgrade step/
    )

    await player.as.mutation(api.downtime.soloSetStep, { ...P, stepIndex: UPKEEP_STEP })
    expect(await player.as.mutation(api.downtime.soloSpendUpkeep, P)).toBe(true)
    expect(await player.as.mutation(api.downtime.soloSpendUpkeep, P)).toBe(false)

    // Out and back into the step does not reopen it.
    await player.as.mutation(api.downtime.soloAdvance, P)
    await player.as.mutation(api.downtime.soloSetStep, { ...P, stepIndex: UPKEEP_STEP })
    expect(await player.as.mutation(api.downtime.soloSpendUpkeep, P)).toBe(false)

    // A second Begin while running is not a fresh Downtime.
    await player.as.mutation(api.downtime.soloBegin, P)
    expect(await player.as.query(api.downtime.soloState, P)).toMatchObject({
      stepIndex: UPKEEP_STEP,
      upkeepSpent: true,
    })

    // A fresh Downtime is the only thing that clears it.
    await player.as.mutation(api.downtime.soloEnd, P)
    await player.as.mutation(api.downtime.soloBegin, P)
    expect((await player.as.query(api.downtime.soloState, P))?.upkeepSpent).toBe(false)
    await player.as.mutation(api.downtime.soloSetStep, { ...P, stepIndex: UPKEEP_STEP })
    expect(await player.as.mutation(api.downtime.soloSpendUpkeep, P)).toBe(true)
  })

  test('a step is marked done once: a second Apply after a reload is refused', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    const train = downtimeGuideSteps().findIndex((step) => step.name === 'Train your Pilot')
    await player.as.mutation(api.downtime.soloBegin, P)
    expect((await player.as.query(api.downtime.soloState, P))?.doneSteps).toEqual([])
    await player.as.mutation(api.downtime.soloSetStep, { ...P, stepIndex: train })

    expect(
      await player.as.mutation(api.downtime.soloMarkStepDone, { ...P, stepIndex: train })
    ).toBe(true)
    // The reload: a fresh read of the seat still has it, and the claim is refused.
    expect((await player.as.query(api.downtime.soloState, P))?.doneSteps).toEqual([train])
    expect((await soloSeat(player))?.downtime).toMatchObject({ doneSteps: [train] })
    expect(
      await player.as.mutation(api.downtime.soloMarkStepDone, { ...P, stepIndex: train })
    ).toBe(false)

    // Moving the steps keeps it; a second Begin while running is no reset.
    await player.as.mutation(api.downtime.soloAdvance, P)
    await player.as.mutation(api.downtime.soloSetStep, { ...P, stepIndex: train })
    await player.as.mutation(api.downtime.soloBegin, P)
    expect(
      await player.as.mutation(api.downtime.soloMarkStepDone, { ...P, stepIndex: train })
    ).toBe(false)

    // Only a fresh Downtime clears it.
    await player.as.mutation(api.downtime.soloEnd, P)
    await player.as.mutation(api.downtime.soloBegin, P)
    expect((await player.as.query(api.downtime.soloState, P))?.doneSteps).toEqual([])
    expect(
      await player.as.mutation(api.downtime.soloMarkStepDone, { ...P, stepIndex: train })
    ).toBe(true)
  })

  test('only a real step is marked done, and only by the owner', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    await player.as.mutation(api.downtime.soloBegin, P)
    for (const stepIndex of [-1, 1.5, downtimeGuideSteps().length]) {
      await expect(
        player.as.mutation(api.downtime.soloMarkStepDone, { ...P, stepIndex })
      ).rejects.toThrow(/not a Downtime step/)
    }
    const stranger = await makeUser(t, 'Stranger')
    await expect(
      stranger.as.mutation(api.downtime.soloMarkStepDone, { ...P, stepIndex: 0 })
    ).rejects.toThrow(/another player's entity/i)
  })

  test('steps and upkeep need a running Downtime', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    for (const write of [
      () => player.as.mutation(api.downtime.soloAdvance, P),
      () => player.as.mutation(api.downtime.soloSetStep, { ...P, stepIndex: 1 }),
      () => player.as.mutation(api.downtime.soloSpendUpkeep, P),
      () => player.as.mutation(api.downtime.soloMarkStepDone, { ...P, stepIndex: 0 }),
    ]) {
      await expect(write()).rejects.toThrow(/not running/i)
    }
  })

  test("the solo Downtime is nobody else's to read", async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    await player.as.mutation(api.downtime.soloBegin, P)
    const stranger = await makeUser(t, 'Stranger')
    expect(await stranger.as.query(api.downtime.soloState, P)).toBeNull()
    await expect(stranger.as.mutation(api.downtime.soloAdvance, P)).rejects.toThrow(
      /another player's entity/i
    )
  })
})

describe('moving into a Game hands the solo seat over', () => {
  /** A Game the solo player has joined, and their solo seat boarded in `m1` mid-everything. */
  async function playingSolo(t: Ctx) {
    const { organizer, player, gameId } = await seedTable(t)
    await addPilot(player, 'p1', null)
    await addMech(player, 'm1', null)
    await player.as.mutation(api.seats.board, { ...SOLO, mechId: 'm1' })
    await player.as.mutation(api.seats.setRange, { ...SOLO, range: 'Long' })
    await player.as.mutation(api.seats.toggleEffect, { ...SOLO, ref: 'abilities:beefcake' })
    await player.as.mutation(api.seats.setResolving, { ...SOLO, resolving: crush })
    await player.as.mutation(api.downtime.soloBegin, { pilotId: 'p1' })
    return { organizer, player, gameId }
  }

  async function gameSeat(user: User, gameId: Id<'games'>, pilotId = 'p1') {
    const seats = await user.as.query(api.seats.forGame, { gameId })
    return seats.find((s) => s.pilotId === pilotId)
  }

  test('with the mech already there: still aboard, range and effects kept', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await playingSolo(t)
    await moveOwnable(player, 'mechs', 'm1', gameId)
    // The mech went first; its solo boarder stays aboard so it can follow,
    // though the solo screen, which never plays a mech off its shelf, reads foot.
    expect((await seatRows(t))[0]?.mount).toEqual({ kind: 'boarded', mechId: 'm1' })
    expect(await soloSeat(player)).toMatchObject({ mount: { kind: 'foot' }, resolving: null })

    await moveOwnable(player, 'pilots', 'p1', gameId)

    expect(await gameSeat(organizer, gameId)).toMatchObject({
      mount: { kind: 'boarded', mechId: 'm1' },
      range: 'Long',
      activeEffects: ['abilities:beefcake'],
      // The resolve belonged to the shelf's deck.
      resolving: null,
    })
    const rows = await seatRows(t)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.gameId).toBe(gameId)
    // Solo Downtime does not follow: in a Game, Downtime is the Game's.
    expect(rows[0]?.downtime).toBeUndefined()
    expect(rows[0]?.ownerId).toBeUndefined()
  })

  test('with the mech left behind: on foot, the rest kept', async () => {
    const t = testConvex()
    const { player, gameId } = await playingSolo(t)
    await moveOwnable(player, 'pilots', 'p1', gameId)
    expect(await gameSeat(player, gameId)).toMatchObject({
      mount: { kind: 'foot' },
      range: 'Long',
      activeEffects: ['abilities:beefcake'],
    })
    expect(await soloSeat(player)).toBeNull()
    expect(await seatRows(t)).toHaveLength(1)
  })

  test('with somebody already aboard the mech there: on foot', async () => {
    const t = testConvex()
    const { player, gameId } = await playingSolo(t)
    await moveOwnable(player, 'mechs', 'm1', gameId)
    await addPilot(player, 'p2', gameId)
    // The solo seat is not at that table, so a seat there may take the mech.
    await player.as.mutation(api.seats.board, { gameId, pilotId: 'p2', mechId: 'm1' })

    await moveOwnable(player, 'pilots', 'p1', gameId)
    expect((await gameSeat(player, gameId))?.mount).toEqual({ kind: 'foot' })
  })

  test('a mech that leaves the Game before its pilot follows stands the solo boarder up', async () => {
    const t = testConvex()
    const { player, gameId } = await playingSolo(t)
    await moveOwnable(player, 'mechs', 'm1', gameId)
    await player.as.mutation(api.entities.removeByAppId, { table: 'mechs', appId: 'm1' })
    expect((await seatRows(t))[0]?.mount).toEqual({ kind: 'foot' })
    expect((await seatRows(t))[0]?.resolving).toBeUndefined()
  })

  test('presence follows the pilot into the Game', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await playingSolo(t)
    setSystemTime(new Date(40_000))
    await player.as.mutation(api.seats.heartbeat, SOLO)
    await moveOwnable(player, 'pilots', 'p1', gameId)
    setSystemTime()
    expect(await organizer.as.query(api.seats.presence, { gameId })).toEqual([40_000])
    expect(await seatRows(t)).toHaveLength(1)
  })

  test('a pilot with no solo seat sits down as any other', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await addPilot(player, 'p1', null)
    await moveOwnable(player, 'pilots', 'p1', gameId)
    expect(await seatRows(t)).toHaveLength(0)
  })
})

describe('solo cleanup', () => {
  test('deleting a shelf pilot deletes its solo seat', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    await player.as.mutation(api.seats.board, { ...SOLO, mechId: 'm1' })
    await player.as.mutation(api.entities.removeByAppId, { table: 'pilots', appId: 'p1' })
    expect(await seatRows(t)).toHaveLength(0)
  })

  test('deleting the boarded shelf mech leaves the solo pilot on foot', async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    await player.as.mutation(api.seats.board, { ...SOLO, mechId: 'm1' })
    await player.as.mutation(api.seats.setResolving, { ...SOLO, resolving: crush })
    await player.as.mutation(api.entities.removeByAppId, { table: 'mechs', appId: 'm1' })
    expect(await soloSeat(player)).toMatchObject({ mount: { kind: 'foot' }, resolving: null })
  })

  test("deleting an account deletes its solo seats and nobody else's", async () => {
    const t = testConvex()
    const player = await soloPlayer(t)
    const other = await makeUser(t, 'Other')
    await addPilot(other, 'p-other', null)
    await player.as.mutation(api.seats.setRange, { ...SOLO, range: 'Far' })
    await other.as.mutation(api.seats.setRange, { gameId: null, pilotId: 'p-other', range: 'Far' })

    await player.as.mutation(api.account.deleteAccount, {})

    expect((await seatRows(t)).map((r) => r.pilotId)).toEqual(['p-other'])
  })
})

describe('presence heartbeat', () => {
  afterEach(() => {
    setSystemTime()
  })

  /** A Game where the player's `p1` has sat down. */
  async function seated(t: Ctx) {
    const table = await seedTable(t)
    await addPilot(table.player, 'p1', table.gameId)
    return table
  }

  test('stamps lastSeenAt for the crew to read, without moving updatedAt', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seated(t)
    setSystemTime(new Date(10_000))
    await player.as.mutation(api.seats.setRange, { gameId, pilotId: 'p1', range: 'Far' })

    setSystemTime(new Date(50_000))
    await player.as.mutation(api.seats.heartbeat, { gameId, pilotId: 'p1' })

    const seats = await organizer.as.query(api.seats.forGame, { gameId })
    expect(seats.find((s) => s.pilotId === 'p1')).toMatchObject({
      lastSeenAt: 50_000,
      updatedAt: 10_000,
    })
    const vitals = await organizer.as.query(api.crew.vitals, { gameId })
    expect(vitals.pilots.find((p) => p.linkId === 'p1')?.lastSeenAt).toBe(50_000)
  })

  test('presence: each beating seat’s last beat, for members only', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seated(t)
    // Seated but never beaten: nothing to count.
    await player.as.mutation(api.seats.setRange, { gameId, pilotId: 'p1', range: 'Far' })
    expect(await organizer.as.query(api.seats.presence, { gameId })).toEqual([])

    setSystemTime(new Date(70_000))
    await player.as.mutation(api.seats.heartbeat, { gameId, pilotId: 'p1' })
    expect(await organizer.as.query(api.seats.presence, { gameId })).toEqual([70_000])

    const stranger = await makeUser(t, 'Stranger')
    await expect(stranger.as.query(api.seats.presence, { gameId })).rejects.toThrow(/not a member/i)
  })

  test('a beat inside the write interval writes nothing', async () => {
    const t = testConvex()
    const { player, gameId } = await seated(t)
    const beat = () => player.as.mutation(api.seats.heartbeat, { gameId, pilotId: 'p1' })

    setSystemTime(new Date(100_000))
    await beat()
    setSystemTime(new Date(100_000 + PRESENCE_WRITE_MIN_MS - 1))
    await beat()
    expect((await seatRows(t))[0]?.lastSeenAt).toBe(100_000)

    setSystemTime(new Date(100_000 + PRESENCE_WRITE_MIN_MS))
    await beat()
    expect((await seatRows(t))[0]?.lastSeenAt).toBe(100_000 + PRESENCE_WRITE_MIN_MS)
  })

  test('the first beat creates the default seat', async () => {
    const t = testConvex()
    const { player, gameId } = await seated(t)
    await player.as.mutation(api.seats.heartbeat, { gameId, pilotId: 'p1' })
    const rows = await seatRows(t)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ mount: { kind: 'foot' }, range: 'Close', activeEffects: [] })
  })

  test('a pilot gone from the Game takes its seat, and so its presence, along', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seated(t)
    await player.as.mutation(api.seats.heartbeat, { gameId, pilotId: 'p1' })
    await player.as.mutation(api.entities.removeByAppId, { table: 'pilots', appId: 'p1' })
    expect(await organizer.as.query(api.seats.presence, { gameId })).toEqual([])
  })

  test('only whoever may write the seat beats for it, the Mediator not', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seated(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: organizer.userId,
      mediator: true,
    })
    await expect(
      organizer.as.mutation(api.seats.heartbeat, { gameId, pilotId: 'p1' })
    ).rejects.toThrow(/another player's entity/i)
    const stranger = await makeUser(t, 'Stranger')
    await expect(
      stranger.as.mutation(api.seats.heartbeat, { gameId, pilotId: 'p1' })
    ).rejects.toThrow(/not a member/i)
    expect(await seatRows(t)).toHaveLength(0)
  })
})
