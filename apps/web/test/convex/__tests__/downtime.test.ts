import { describe, expect, test } from 'bun:test'
import { downtimeStepOpId } from 'game-domain/ops/downtimeStep'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Ctx } from '../fixtures'
import { addPilot, makeUser, unitOp } from '../fixtures'
import { testConvex } from '../harness'

/**
 * Crew-wide Downtime.
 *
 * The two properties worth the most here are the ones that made per-player
 * Downtime unworkable in the first place: **upkeep charged once rather than
 * once per member**, and **step completion that means "done with THIS step"
 * rather than "done at some point".**
 */

type GameId = Id<'games'>

async function seedTable(t: Ctx) {
  const gm = await makeUser(t, 'Mediator')
  const a = await makeUser(t, 'Ash')
  const b = await makeUser(t, 'Bex')
  const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await gm.as.mutation(api.invites.link, { gameId })
  await a.as.mutation(api.invites.redeem, { code })
  await b.as.mutation(api.invites.redeem, { code })
  await gm.as.mutation(api.games.setMediator, { gameId, userId: gm.userId, mediator: true })
  return { gm, a, b, gameId }
}

describe('the phase is table-wide and Mediator-driven', () => {
  test('not-running is a reported state, not a null', async () => {
    const t = testConvex()
    const { a, gameId } = await seedTable(t)

    // Reporting it saves every caller inventing the same default.
    const s = await a.as.query(api.downtime.state, { gameId })
    expect(s?.running).toBe(false)
    expect(s?.stepIndex).toBeNull()
  })

  test('the Mediator begins and advances; everybody sees it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)

    await gm.as.mutation(api.downtime.begin, { gameId })
    expect((await a.as.query(api.downtime.state, { gameId }))?.stepIndex).toBe(0)

    await gm.as.mutation(api.downtime.advance, { gameId })
    expect((await a.as.query(api.downtime.state, { gameId }))?.stepIndex).toBe(1)
  })

  test('a player cannot begin, advance or end it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)

    await expect(a.as.mutation(api.downtime.begin, { gameId })).rejects.toThrow(/mediator/i)
    await gm.as.mutation(api.downtime.begin, { gameId })
    await expect(a.as.mutation(api.downtime.advance, { gameId })).rejects.toThrow(/mediator/i)
    await expect(a.as.mutation(api.downtime.end, { gameId })).rejects.toThrow(/mediator/i)
  })

  test('advancing before it starts is refused', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await expect(gm.as.mutation(api.downtime.advance, { gameId })).rejects.toThrow(/not running/i)
  })
})

describe('the Mediator may put the table back a step (setStep)', () => {
  test('back and forward, held to the guide, clearing who is done', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })
    await gm.as.mutation(api.downtime.advance, { gameId })
    await gm.as.mutation(api.downtime.advance, { gameId })
    await a.as.mutation(api.downtime.markStepDone, { gameId, done: true })

    await gm.as.mutation(api.downtime.setStep, { gameId, stepIndex: 1 })
    const back = await a.as.query(api.downtime.state, { gameId })
    expect(back?.stepIndex).toBe(1)
    expect(back?.completedBy).toHaveLength(0)

    await gm.as.mutation(api.downtime.setStep, { gameId, stepIndex: -4 })
    expect((await a.as.query(api.downtime.state, { gameId }))?.stepIndex).toBe(0)
  })

  test('going back to Upkeep & Upgrade does not make it payable again', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })
    await gm.as.mutation(api.downtime.advance, { gameId })
    expect(await gm.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(true)
    await gm.as.mutation(api.downtime.advance, { gameId })

    await gm.as.mutation(api.downtime.setStep, { gameId, stepIndex: 1 })
    expect(await gm.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(false)
  })

  test('a player cannot, and nobody can before it runs', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await expect(gm.as.mutation(api.downtime.setStep, { gameId, stepIndex: 1 })).rejects.toThrow(
      /not running/i
    )
    await gm.as.mutation(api.downtime.begin, { gameId })
    await expect(a.as.mutation(api.downtime.setStep, { gameId, stepIndex: 1 })).rejects.toThrow(
      /mediator/i
    )
  })
})

describe('completion is per step, not cumulative', () => {
  test('marking done shows up for the whole table', async () => {
    const t = testConvex()
    const { gm, a, b, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })

    await a.as.mutation(api.downtime.markStepDone, { gameId, done: true })

    // The point of a shared phase: Bex can see Ash is finished.
    const seen = await b.as.query(api.downtime.state, { gameId })
    expect(seen?.completedBy.map((c) => c.displayName)).toContain('Ash')
  })

  test('advancing clears it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })
    await a.as.mutation(api.downtime.markStepDone, { gameId, done: true })

    await gm.as.mutation(api.downtime.advance, { gameId })

    // Otherwise a player who finished step 1 looks finished for the whole
    // Downtime — the opposite of what the Mediator needs to know.
    expect((await a.as.query(api.downtime.state, { gameId }))?.completedBy).toHaveLength(0)
  })

  test('marking done twice does not duplicate', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })

    await a.as.mutation(api.downtime.markStepDone, { gameId, done: true })
    await a.as.mutation(api.downtime.markStepDone, { gameId, done: true })

    expect((await a.as.query(api.downtime.state, { gameId }))?.completedBy).toHaveLength(1)
  })

  test('a player can un-mark themselves', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })
    await a.as.mutation(api.downtime.markStepDone, { gameId, done: true })
    await a.as.mutation(api.downtime.markStepDone, { gameId, done: false })

    expect((await a.as.query(api.downtime.state, { gameId }))?.completedBy).toHaveLength(0)
  })
})

describe('crawler upkeep is spent once, not per member', () => {
  /** Begin a Downtime and advance to the Upkeep & Upgrade step (step 2). */
  async function toUpkeepStep(gm: Awaited<ReturnType<typeof seedTable>>['gm'], gameId: GameId) {
    await gm.as.mutation(api.downtime.begin, { gameId })
    await gm.as.mutation(api.downtime.advance, { gameId })
  }

  test('the second attempt reports already-spent rather than charging again', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await toUpkeepStep(gm, gameId)

    expect(await gm.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(true)
    // A second press, or the hub open beside Play, is not a second
    // charge: paying per press is the double-charging per-player Downtime had.
    expect(await gm.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(false)
  })

  test('only the Mediator pays it: the crawler is theirs (ADR-038 §5)', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await toUpkeepStep(gm, gameId)

    await expect(a.as.mutation(api.downtime.spendUpkeep, { gameId })).rejects.toThrow(/mediator/i)
    expect((await a.as.query(api.downtime.state, { gameId }))?.upkeepSpent).toBe(false)
    expect(await gm.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(true)
  })

  test('only in the Upkeep & Upgrade step: every other step refuses it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })

    // Step 1 is Tally Salvage.
    await expect(gm.as.mutation(api.downtime.spendUpkeep, { gameId })).rejects.toThrow(
      /Upkeep & Upgrade step/
    )
    await gm.as.mutation(api.downtime.advance, { gameId })
    expect(await gm.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(true)

    // Past it, an unpaid or paid Upkeep alike is no longer the table's to spend.
    await gm.as.mutation(api.downtime.advance, { gameId })
    await expect(gm.as.mutation(api.downtime.spendUpkeep, { gameId })).rejects.toThrow(
      /Upkeep & Upgrade step/
    )
    expect((await a.as.query(api.downtime.state, { gameId }))?.upkeepSpent).toBe(true)
  })

  test('advancing a step does NOT reset it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await toUpkeepStep(gm, gameId)
    await gm.as.mutation(api.downtime.spendUpkeep, { gameId })

    await gm.as.mutation(api.downtime.advance, { gameId })

    // Resetting here would charge the crew again mid-procedure.
    expect((await a.as.query(api.downtime.state, { gameId }))?.upkeepSpent).toBe(true)
  })

  test('a second Begin while running is no restart, so it does not reset it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await toUpkeepStep(gm, gameId)
    await gm.as.mutation(api.downtime.spendUpkeep, { gameId })

    await gm.as.mutation(api.downtime.begin, { gameId })

    expect(await a.as.query(api.downtime.state, { gameId })).toMatchObject({
      stepIndex: 1,
      upkeepSpent: true,
    })
  })

  test('a NEW downtime does reset it', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await toUpkeepStep(gm, gameId)
    await gm.as.mutation(api.downtime.spendUpkeep, { gameId })
    await gm.as.mutation(api.downtime.end, { gameId })

    await toUpkeepStep(gm, gameId)
    // Upkeep is per Downtime, so the next one is payable again.
    expect(await gm.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(true)
  })
})

describe('a step applies once per pilot (its step op)', () => {
  async function stepTable(t: Ctx) {
    const table = await seedTable(t)
    await addPilot(table.a, 'pa', table.gameId)
    await addPilot(table.a, 'pa2', table.gameId)
    await table.gm.as.mutation(api.downtime.begin, { gameId: table.gameId })
    const started = await table.gm.as.query(api.downtime.state, { gameId: table.gameId })
    return { ...table, startedAt: started?.startedAt ?? 0 }
  }

  function step(gameId: GameId, startedAt: number, pilotId: string, stepIndex: number) {
    return unitOp('pilot', {
      appId: pilotId,
      gameId,
      id: downtimeStepOpId(startedAt, pilotId, stepIndex),
      patch: {},
    })
  }

  test('the second send applies nothing: not after an un-mark, not after the Mediator’s Back', async () => {
    const t = testConvex()
    const { gm, a, gameId, startedAt } = await stepTable(t)

    expect((await a.as.mutation(api.ops.apply, step(gameId, startedAt, 'pa', 0)))?.fresh).toBe(true)
    await a.as.mutation(api.downtime.markStepDone, { gameId, done: true })
    await a.as.mutation(api.downtime.markStepDone, { gameId, done: false })
    expect((await a.as.mutation(api.ops.apply, step(gameId, startedAt, 'pa', 0)))?.fresh).toBe(
      false
    )

    await gm.as.mutation(api.downtime.advance, { gameId })
    await gm.as.mutation(api.downtime.setStep, { gameId, stepIndex: 0 })
    expect((await a.as.mutation(api.ops.apply, step(gameId, startedAt, 'pa', 0)))?.fresh).toBe(
      false
    )
    expect((await a.as.query(api.downtime.state, { gameId, pilotId: 'pa' }))?.doneSteps).toEqual([
      0,
    ])
  })

  test('per pilot, not per member: a member’s second pilot takes its own', async () => {
    const t = testConvex()
    const { a, gameId, startedAt } = await stepTable(t)
    await a.as.mutation(api.ops.apply, step(gameId, startedAt, 'pa', 0))
    expect((await a.as.mutation(api.ops.apply, step(gameId, startedAt, 'pa2', 0)))?.fresh).toBe(
      true
    )
    expect((await a.as.query(api.downtime.state, { gameId, pilotId: 'pa2' }))?.doneSteps).toEqual([
      0,
    ])
  })

  test('a fresh Downtime takes its steps afresh', async () => {
    const t = testConvex()
    const { gm, a, gameId, startedAt } = await stepTable(t)
    await a.as.mutation(api.ops.apply, step(gameId, startedAt, 'pa', 0))
    await gm.as.mutation(api.downtime.end, { gameId })
    await new Promise((resolve) => setTimeout(resolve, 2))
    await gm.as.mutation(api.downtime.begin, { gameId })
    const next = (await gm.as.query(api.downtime.state, { gameId }))?.startedAt ?? 0
    expect(next).not.toBe(startedAt)
    expect((await a.as.query(api.downtime.state, { gameId, pilotId: 'pa' }))?.doneSteps).toEqual([])
    expect((await a.as.mutation(api.ops.apply, step(gameId, next, 'pa', 0)))?.fresh).toBe(true)
  })

  test('only whoever may write the pilot', async () => {
    const t = testConvex()
    const { b, gameId, startedAt } = await stepTable(t)
    await expect(b.as.mutation(api.ops.apply, step(gameId, startedAt, 'pa', 0))).rejects.toThrow()
  })
})

describe('non-members', () => {
  test('cannot read or touch a table they are not at', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    const outsider = await makeUser(t, 'Outsider')
    await gm.as.mutation(api.downtime.begin, { gameId })

    expect(await outsider.as.query(api.downtime.state, { gameId })).toEqual(null)
    await expect(
      outsider.as.mutation(api.downtime.markStepDone, { gameId, done: true })
    ).rejects.toThrow(/not a member/i)
  })
})
