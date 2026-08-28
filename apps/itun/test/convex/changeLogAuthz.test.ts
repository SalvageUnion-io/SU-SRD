import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { testConvex } from './harness'

/**
 * Who may write into a game's Change Log.
 *
 * `entities.appendChangeLog` is the client's mirror of a local append: a record
 * of something that ALREADY happened on the user's own device. It called
 * `requireUser` and then inserted every entry verbatim — and every field of an
 * entry is client-supplied, `gameId` included. Nothing derived that id from a
 * record the caller could be shown to own.
 *
 * Two consequences, and the second is the sharp one:
 *
 *  - a signed-in user could write provenance rows into ANY game, including one
 *    they had left, or one whose id they held from an unredeemed invite link;
 *  - `proposals.alerts` returns every `field === 'alert'` row to every member of
 *    a game, and `proposals.broadcast` writes those rows behind
 *    `requireMediator`. So this mutation was an unguarded second door onto the
 *    Mediator's broadcast channel — a message to the whole crew, carrying a
 *    real `actorId`.
 *
 * Each test below fails against the pre-fix handler; the two happy-path cases
 * are the controls that say the fix did not simply close the door on everyone.
 */

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

function entry(gameId: string | null, over: Record<string, unknown> = {}) {
  return {
    gameId: gameId as never,
    entityType: 'pilot' as const,
    entityId: 'p1',
    ts: 1,
    kind: 'manual' as const,
    field: 'name',
    before: 'a',
    after: 'b',
    source: 'test',
    ...over,
  }
}

describe('appendChangeLog authorization', () => {
  test('a member may append to their own game', async () => {
    const t = testConvex()
    const gm = await makeUser(t, 'Mediator')
    const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })

    await gm.as.mutation(api.entities.appendChangeLog, { entries: [entry(gameId)] })

    const rows = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actorId).toBe(gm.userId)
  })

  test('an append with no game is unaffected — this is the Solo path', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Solo')

    await user.as.mutation(api.entities.appendChangeLog, { entries: [entry(null)] })

    const rows = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.gameId).toBeNull()
  })

  test('a non-member cannot append to a game they were never in', async () => {
    const t = testConvex()
    const gm = await makeUser(t, 'Mediator')
    const outsider = await makeUser(t, 'Outsider')
    const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })

    await expect(
      outsider.as.mutation(api.entities.appendChangeLog, { entries: [entry(gameId)] })
    ).rejects.toThrow(/Not a member of this game/)

    const rows = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(rows).toHaveLength(0)
  })

  test('the whole batch is refused when any one entry names a foreign game', async () => {
    const t = testConvex()
    const gm = await makeUser(t, 'Mediator')
    const player = await makeUser(t, 'Player')
    const theirs = await gm.as.mutation(api.games.create, { name: 'Theirs' })
    const mine = await player.as.mutation(api.games.create, { name: 'Mine' })

    // A batch that is mostly legitimate. Checking only the first entry, or
    // stopping at the first success, would let the smuggled row through.
    await expect(
      player.as.mutation(api.entities.appendChangeLog, {
        entries: [entry(mine), entry(theirs), entry(null)],
      })
    ).rejects.toThrow(/Not a member of this game/)

    const rows = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(rows).toHaveLength(0)
  })

  test('a member who left can no longer append', async () => {
    const t = testConvex()
    const gm = await makeUser(t, 'Mediator')
    const player = await makeUser(t, 'Player')
    const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })
    const code = await gm.as.mutation(api.invites.create, { gameId })
    await player.as.mutation(api.invites.redeem, { code })

    // While a member: allowed.
    await player.as.mutation(api.entities.appendChangeLog, { entries: [entry(gameId)] })

    await player.as.mutation(api.ownership.leaveGame, { gameId })

    await expect(
      player.as.mutation(api.entities.appendChangeLog, { entries: [entry(gameId)] })
    ).rejects.toThrow(/Not a member of this game/)

    const rows = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(rows).toHaveLength(1)
  })

  test('alerts cannot be written through a client append, even by the Mediator', async () => {
    const t = testConvex()
    const gm = await makeUser(t, 'Mediator')
    const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })
    await gm.as.mutation(api.games.setMediator, { gameId, userId: gm.userId, mediator: true })

    await expect(
      gm.as.mutation(api.entities.appendChangeLog, {
        entries: [
          entry(gameId, {
            field: 'alert',
            entityType: 'game',
            after: 'Mediator: everyone gets 20 scrap',
          }),
        ],
      })
    ).rejects.toThrow(/Alerts are written by the Mediator/)

    // The point of the rule is the feed, so assert on the feed and not only on
    // the throw: nothing reached the surface a player actually reads.
    const alerts = await gm.as.query(api.proposals.alerts, { gameId })
    expect(alerts).toHaveLength(0)
  })

  test('a member cannot smuggle an alert into the crew feed', async () => {
    const t = testConvex()
    const gm = await makeUser(t, 'Mediator')
    const player = await makeUser(t, 'Player')
    const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })
    await gm.as.mutation(api.games.setMediator, { gameId, userId: gm.userId, mediator: true })
    const code = await gm.as.mutation(api.invites.create, { gameId })
    await player.as.mutation(api.invites.redeem, { code })

    await expect(
      player.as.mutation(api.entities.appendChangeLog, {
        entries: [entry(gameId, { field: 'alert', entityType: 'game', after: 'free scrap' })],
      })
    ).rejects.toThrow(/Alerts are written by the Mediator/)

    const alerts = await player.as.query(api.proposals.alerts, { gameId })
    expect(alerts).toHaveLength(0)
  })
})
