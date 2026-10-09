import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { Ctx } from './fixtures'
import { makeUser } from './fixtures'
import { testConvex } from './harness'

/**
 * Crew-wide Downtime (Phase 5).
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
  const code = await gm.as.mutation(api.invites.create, { gameId })
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
    expect(s.running).toBe(false)
    expect(s.stepIndex).toBeNull()
  })

  test('the Mediator begins and advances; everybody sees it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)

    await gm.as.mutation(api.downtime.begin, { gameId })
    expect((await a.as.query(api.downtime.state, { gameId })).stepIndex).toBe(0)

    await gm.as.mutation(api.downtime.advance, { gameId })
    expect((await a.as.query(api.downtime.state, { gameId })).stepIndex).toBe(1)
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

describe('completion is per step, not cumulative', () => {
  test('marking done shows up for the whole table', async () => {
    const t = testConvex()
    const { gm, a, b, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })

    await a.as.mutation(api.downtime.markStepDone, { gameId, done: true })

    // The point of a shared phase: Bex can see Ash is finished.
    const seen = await b.as.query(api.downtime.state, { gameId })
    expect(seen.completedBy.map((c) => c.displayName)).toContain('Ash')
  })

  test('advancing clears it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })
    await a.as.mutation(api.downtime.markStepDone, { gameId, done: true })

    await gm.as.mutation(api.downtime.advance, { gameId })

    // Otherwise a player who finished step 1 looks finished for the whole
    // Downtime — the opposite of what the Mediator needs to know.
    expect((await a.as.query(api.downtime.state, { gameId })).completedBy).toHaveLength(0)
  })

  test('marking done twice does not duplicate', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })

    await a.as.mutation(api.downtime.markStepDone, { gameId, done: true })
    await a.as.mutation(api.downtime.markStepDone, { gameId, done: true })

    expect((await a.as.query(api.downtime.state, { gameId })).completedBy).toHaveLength(1)
  })

  test('a player can un-mark themselves', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })
    await a.as.mutation(api.downtime.markStepDone, { gameId, done: true })
    await a.as.mutation(api.downtime.markStepDone, { gameId, done: false })

    expect((await a.as.query(api.downtime.state, { gameId })).completedBy).toHaveLength(0)
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
    // A second press, or the hub open beside the Dashboard, is not a second
    // charge: paying per press is the double-charging per-player Downtime had.
    expect(await gm.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(false)
  })

  test('only the Mediator pays it: the crawler is theirs (ADR-038 §5)', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await toUpkeepStep(gm, gameId)

    await expect(a.as.mutation(api.downtime.spendUpkeep, { gameId })).rejects.toThrow(/mediator/i)
    expect((await a.as.query(api.downtime.state, { gameId })).upkeepSpent).toBe(false)
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
    expect((await a.as.query(api.downtime.state, { gameId })).upkeepSpent).toBe(true)
  })

  test('advancing a step does NOT reset it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await toUpkeepStep(gm, gameId)
    await gm.as.mutation(api.downtime.spendUpkeep, { gameId })

    await gm.as.mutation(api.downtime.advance, { gameId })

    // Resetting here would charge the crew again mid-procedure.
    expect((await a.as.query(api.downtime.state, { gameId })).upkeepSpent).toBe(true)
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

describe('non-members', () => {
  test('cannot read or touch a table they are not at', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    const outsider = await makeUser(t, 'Outsider')
    await gm.as.mutation(api.downtime.begin, { gameId })

    await expect(outsider.as.query(api.downtime.state, { gameId })).rejects.toThrow(/not a member/i)
    await expect(
      outsider.as.mutation(api.downtime.markStepDone, { gameId, done: true })
    ).rejects.toThrow(/not a member/i)
  })
})
