import { describe, expect, test } from 'bun:test'
import { api } from '../../../convex/_generated/api'
import type { Ctx } from '../fixtures'
import { makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * A Game's Scene conditions: the Mediator sets them and passes the hours,
 * every member reads them, and nobody else does either.
 */

async function seedTable(t: Ctx) {
  const gm = await makeUser(t, 'Mediator')
  const a = await makeUser(t, 'Ash')
  const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await gm.as.mutation(api.invites.link, { gameId })
  await a.as.mutation(api.invites.redeem, { code })
  await gm.as.mutation(api.games.setMediator, { gameId, userId: gm.userId, mediator: true })
  return { gm, a, gameId }
}

describe('Scene conditions', () => {
  test('a Game starts clear', async () => {
    const t = testConvex()
    const { a, gameId } = await seedTable(t)
    expect(await a.as.query(api.scenes.current, { gameId })).toEqual({ conditions: [], hours: 0 })
  })

  test('the Mediator sets them, once each in catalogue order, and every member reads them', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.scenes.setConditions, {
      gameId,
      conditions: ['freezing', 'radiation-storm', 'freezing'],
    })
    expect((await a.as.query(api.scenes.current, { gameId })).conditions).toEqual([
      'radiation-storm',
      'freezing',
    ])
  })

  test('a player cannot set them or pass an hour', async () => {
    const t = testConvex()
    const { a, gameId } = await seedTable(t)
    await expect(
      a.as.mutation(api.scenes.setConditions, { gameId, conditions: ['freezing'] })
    ).rejects.toThrow(/mediator/i)
    await expect(a.as.mutation(api.scenes.passHour, { gameId })).rejects.toThrow(/mediator/i)
  })

  test('hours count under conditions and clear with the last one', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    expect(await gm.as.mutation(api.scenes.passHour, { gameId })).toBe(0)
    await gm.as.mutation(api.scenes.setConditions, { gameId, conditions: ['radiation-storm'] })
    await gm.as.mutation(api.scenes.passHour, { gameId })
    expect(await gm.as.mutation(api.scenes.passHour, { gameId })).toBe(2)
    // Changing which conditions hold keeps the clock.
    await gm.as.mutation(api.scenes.setConditions, {
      gameId,
      conditions: ['radiation-storm', 'low-visibility'],
    })
    expect((await a.as.query(api.scenes.current, { gameId })).hours).toBe(2)
    await gm.as.mutation(api.scenes.setConditions, { gameId, conditions: [] })
    expect(await a.as.query(api.scenes.current, { gameId })).toEqual({ conditions: [], hours: 0 })
  })

  test('someone outside the Game reads a clear Scene', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    const stranger = await makeUser(t, 'Stranger')
    await gm.as.mutation(api.scenes.setConditions, { gameId, conditions: ['freezing'] })
    expect(await stranger.as.query(api.scenes.current, { gameId })).toEqual({
      conditions: [],
      hours: 0,
    })
  })
})
