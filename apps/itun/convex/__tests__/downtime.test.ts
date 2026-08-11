import { describe, expect, test } from 'bun:test'
import { api } from '../_generated/api'
import { testConvex } from './harness'

/**
 * Crew-wide Downtime (Phase 5).
 *
 * The two properties worth the most here are the ones that made per-player
 * Downtime unworkable in the first place: **upkeep charged once rather than
 * once per member**, and **step completion that means "done with THIS step"
 * rather than "done at some point".**
 */

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

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
  test('the second attempt reports already-spent rather than charging again', async () => {
    const t = testConvex()
    const { gm, a, b, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })

    expect(await a.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(true)
    // Six members each paying is the exact double-charging that made
    // per-player Downtime unworkable.
    expect(await b.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(false)
  })

  test('two players racing is not an error anybody sees', async () => {
    const t = testConvex()
    const { gm, a, b, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })

    // An ordinary race at a table, not a fault to surface.
    const results = [
      await a.as.mutation(api.downtime.spendUpkeep, { gameId }),
      await b.as.mutation(api.downtime.spendUpkeep, { gameId }),
    ]
    expect(results.filter(Boolean)).toHaveLength(1)
  })

  test('advancing a step does NOT reset it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })
    await a.as.mutation(api.downtime.spendUpkeep, { gameId })

    await gm.as.mutation(api.downtime.advance, { gameId })

    // Resetting here would charge the crew again mid-procedure.
    expect((await a.as.query(api.downtime.state, { gameId })).upkeepSpent).toBe(true)
    expect(await a.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(false)
  })

  test('a NEW downtime does reset it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.downtime.begin, { gameId })
    await a.as.mutation(api.downtime.spendUpkeep, { gameId })
    await gm.as.mutation(api.downtime.end, { gameId })

    await gm.as.mutation(api.downtime.begin, { gameId })
    // Upkeep is per Downtime, so the next one is payable again.
    expect(await a.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(true)
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
