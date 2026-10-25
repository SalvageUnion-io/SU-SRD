import { describe, expect, test } from 'bun:test'
import { BOUNDARIES_MAX, BOUNDARY_TEXT_MAX } from 'game-domain/games/safety'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Ctx } from '../fixtures'
import { makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * A Game's Safety Protocols (`convex/safety.ts`, Core Book pp.12-13): every
 * member keeps the boundaries and may show the Stop Sign, nobody is named,
 * and only the shower or the table runner lifts it.
 */

/** A Game where `mediator` organises and mediates, with two plain players. */
async function seedTable(t: Ctx) {
  const mediator = await makeUser(t, 'Mediator')
  const player = await makeUser(t, 'Player')
  const other = await makeUser(t, 'Other')
  const gameId = await mediator.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await mediator.as.mutation(api.invites.link, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  await other.as.mutation(api.invites.redeem, { code })
  await mediator.as.mutation(api.games.setMediator, {
    gameId,
    userId: mediator.userId,
    mediator: true,
  })
  return { mediator, player, other, gameId }
}

async function scheduledPosts(t: Ctx) {
  return await t.run(async (ctx) =>
    (await ctx.db.system.query('_scheduled_functions').collect()).filter(
      (job) => job.name === 'safety:postStop'
    )
  )
}

describe('boundaries', () => {
  test('any member adds one, and every member reads it without a name', async () => {
    const t = testConvex()
    const { player, other, gameId } = await seedTable(t)
    await player.as.mutation(api.safety.addBoundary, {
      gameId,
      kind: 'outOfBounds',
      text: '  Graphic   torture ',
    })
    await other.as.mutation(api.safety.addBoundary, { gameId, kind: 'offCamera', text: 'Gore' })

    const seen = await other.as.query(api.safety.boundaries, { gameId })
    expect(seen.map(({ kind, text }) => ({ kind, text }))).toEqual([
      { kind: 'outOfBounds', text: 'Graphic torture' },
      { kind: 'offCamera', text: 'Gore' },
    ])
    expect(Object.keys(seen[0] ?? {}).sort()).toEqual(['_id', 'kind', 'mayRemove', 'text'])
  })

  test('only whoever added it, or the table runner, takes it off', async () => {
    const t = testConvex()
    const { mediator, player, other, gameId } = await seedTable(t)
    const first = await player.as.mutation(api.safety.addBoundary, {
      gameId,
      kind: 'offCamera',
      text: 'Spiders',
    })
    const second = await player.as.mutation(api.safety.addBoundary, {
      gameId,
      kind: 'offCamera',
      text: 'Drowning',
    })

    expect((await other.as.query(api.safety.boundaries, { gameId }))[0]?.mayRemove).toBe(false)
    await expect(
      other.as.mutation(api.safety.removeBoundary, { boundaryId: first })
    ).rejects.toThrow()

    await player.as.mutation(api.safety.removeBoundary, { boundaryId: first })
    await mediator.as.mutation(api.safety.removeBoundary, { boundaryId: second })
    expect(await player.as.query(api.safety.boundaries, { gameId })).toEqual([])
  })

  test('refuses an empty or overlong one, and caps the lists', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    const add = (text: string) =>
      player.as.mutation(api.safety.addBoundary, { gameId, kind: 'outOfBounds', text })

    await expect(add('   ')).rejects.toThrow('A boundary needs some words.')
    await expect(add('x'.repeat(BOUNDARY_TEXT_MAX + 1))).rejects.toThrow('at most')
    for (let i = 0; i < BOUNDARIES_MAX; i += 1) await add(`Line ${i}`)
    await expect(add('One more')).rejects.toThrow(`at most ${BOUNDARIES_MAX}`)
  })

  test('a non-member reads nothing and adds nothing', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    const stranger = await makeUser(t, 'Stranger')
    await player.as.mutation(api.safety.addBoundary, { gameId, kind: 'offCamera', text: 'Gore' })

    expect(await stranger.as.query(api.safety.boundaries, { gameId })).toEqual([])
    await expect(
      stranger.as.mutation(api.safety.addBoundary, { gameId, kind: 'offCamera', text: 'x' })
    ).rejects.toThrow()
  })
})

describe('the Stop Sign', () => {
  test('any member shows it, and every member sees it paused without who', async () => {
    const t = testConvex()
    const { mediator, player, other, gameId } = await seedTable(t)
    expect((await other.as.query(api.safety.stopSign, { gameId }))?.stop).toBeNull()

    await player.as.mutation(api.safety.showStop, { gameId })

    const theirs = await player.as.query(api.safety.stopSign, { gameId })
    expect(theirs?.stop?.mine).toBe(true)
    expect(theirs?.mayLift).toBe(true)

    const others = await other.as.query(api.safety.stopSign, { gameId })
    expect(others?.stop?.mine).toBe(false)
    expect(others?.mayLift).toBe(false)
    expect(Object.keys(others?.stop ?? {}).sort()).toEqual(['mine', 'shownAt'])

    expect((await mediator.as.query(api.safety.stopSign, { gameId }))?.mayLift).toBe(true)
  })

  test('only whoever showed it, or the table runner, lifts it', async () => {
    const t = testConvex()
    const { mediator, player, other, gameId } = await seedTable(t)
    await player.as.mutation(api.safety.showStop, { gameId })

    await expect(other.as.mutation(api.safety.liftStop, { gameId })).rejects.toThrow()
    await mediator.as.mutation(api.safety.liftStop, { gameId })
    expect((await player.as.query(api.safety.stopSign, { gameId }))?.stop).toBeNull()

    await other.as.mutation(api.safety.showStop, { gameId })
    await other.as.mutation(api.safety.liftStop, { gameId })
    expect((await player.as.query(api.safety.stopSign, { gameId }))?.stop).toBeNull()
  })

  test('showing it while it is up changes nothing', async () => {
    const t = testConvex()
    const { player, other, gameId } = await seedTable(t)
    await player.as.mutation(api.safety.showStop, { gameId })
    await other.as.mutation(api.safety.showStop, { gameId })
    // Still the first shower's: the second press did not take it over.
    expect((await player.as.query(api.safety.stopSign, { gameId }))?.stop?.mine).toBe(true)
  })

  test('a non-member reads null and cannot show it', async () => {
    const t = testConvex()
    const { gameId } = await seedTable(t)
    const stranger = await makeUser(t, 'Stranger')
    expect(await stranger.as.query(api.safety.stopSign, { gameId })).toBeNull()
    await expect(stranger.as.mutation(api.safety.showStop, { gameId })).rejects.toThrow()
  })
})

describe('posting the Stop Sign to Discord', () => {
  async function bind(t: Ctx, gameId: Id<'games'>, boundBy: Id<'users'>) {
    await t.run(async (ctx) => {
      await ctx.db.insert('channelBindings', {
        gameId,
        channelId: '123456789012345678',
        boundBy,
        boundAt: Date.now(),
      })
    })
  }

  test('posts nothing until the table runner opts in', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)
    await bind(t, gameId, mediator.userId)

    await player.as.mutation(api.safety.showStop, { gameId })
    expect(await scheduledPosts(t)).toHaveLength(0)
  })

  test('only the table runner opts in', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)
    await expect(
      player.as.mutation(api.safety.setPostToChannel, { gameId, on: true })
    ).rejects.toThrow()
    await mediator.as.mutation(api.safety.setPostToChannel, { gameId, on: true })
    const read = await player.as.query(api.safety.stopSign, { gameId })
    expect(read?.postToChannel).toBe(true)
    expect(read?.mayManage).toBe(false)
  })

  test('opted in, showing it schedules one post, at most once a minute', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)
    await bind(t, gameId, mediator.userId)
    await mediator.as.mutation(api.safety.setPostToChannel, { gameId, on: true })

    await player.as.mutation(api.safety.showStop, { gameId })
    await player.as.mutation(api.safety.liftStop, { gameId })
    await player.as.mutation(api.safety.showStop, { gameId })
    expect(await scheduledPosts(t)).toHaveLength(1)
  })
})
