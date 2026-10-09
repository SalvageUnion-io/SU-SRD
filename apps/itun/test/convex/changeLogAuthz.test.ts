import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { addCrawler, addPilot, makeUser, seedTable } from './fixtures'
import { testConvex } from './harness'

/**
 * Who may write into a game's Change Log.
 *
 * `changeLog.appendChangeLog` records something that ALREADY happened on the
 * user's own device, and every field of an entry is client-supplied, `gameId`
 * included. Inserting entries verbatim after `requireUser` alone would derive
 * that id from no record the caller could be shown to own.
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
    await addPilot(gm, 'p1', null)

    await gm.as.mutation(api.changeLog.appendChangeLog, { entries: [entry(gameId)] })

    const rows = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actorId).toBe(gm.userId)
  })

  test('an append with no game is unaffected — this is the Solo path', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Solo')
    await addPilot(user, 'p1', null)

    await user.as.mutation(api.changeLog.appendChangeLog, { entries: [entry(null)] })

    const rows = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.gameId).toBeNull()
  })

  test('an entry with no before or after key lands, with that side null', async () => {
    // A field set for the first time has no `before` and a cleared one no
    // `after`; the Convex client drops the undefined key on the wire. Requiring
    // it refused the whole batch (ITUN-CONVEX-3/-4).
    const t = testConvex()
    const user = await makeUser(t, 'Solo')
    await addPilot(user, 'p1', null)
    const { before: _before, ...firstSet } = entry(null)
    const { after: _after, ...cleared } = entry(null, { field: 'maxHpOverride' })

    await user.as.mutation(api.changeLog.appendChangeLog, { entries: [firstSet, cleared] })

    const rows = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(rows.map((r) => [r.field, r.before, r.after])).toEqual([
      ['name', null, 'b'],
      ['maxHpOverride', 'a', null],
    ])
  })

  test('a non-member cannot append to a game they were never in', async () => {
    const t = testConvex()
    const gm = await makeUser(t, 'Mediator')
    const outsider = await makeUser(t, 'Outsider')
    const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })

    await expect(
      outsider.as.mutation(api.changeLog.appendChangeLog, { entries: [entry(gameId)] })
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
      player.as.mutation(api.changeLog.appendChangeLog, {
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
    await addPilot(player, 'p1', null)

    // While a member: allowed.
    await player.as.mutation(api.changeLog.appendChangeLog, { entries: [entry(gameId)] })

    // Leaving, as far as authorization can tell: the membership row is gone.
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query('memberships')
        .withIndex('by_game_user', (q) => q.eq('gameId', gameId).eq('userId', player.userId))
        .unique()
      if (membership !== null) await ctx.db.delete(membership._id)
    })

    await expect(
      player.as.mutation(api.changeLog.appendChangeLog, { entries: [entry(gameId)] })
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
      gm.as.mutation(api.changeLog.appendChangeLog, {
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
      player.as.mutation(api.changeLog.appendChangeLog, {
        entries: [entry(gameId, { field: 'alert', entityType: 'game', after: 'free scrap' })],
      })
    ).rejects.toThrow(/Alerts are written by the Mediator/)

    const alerts = await player.as.query(api.proposals.alerts, { gameId })
    expect(alerts).toHaveLength(0)
  })
})

describe("appendChangeLog and an entity's history", () => {
  // `forEntity` hands an entity's owner and crew every row filed under its id.
  // An entry with `gameId: null` names no game to be a member of, so the game
  // check alone let anyone who knew an entity's id write into its history.

  test('a stranger cannot plant rows in a build they cannot write', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    const stranger = await makeUser(t, 'Stranger')
    await addPilot(owner, 'p-owner', null)

    await expect(
      stranger.as.mutation(api.changeLog.appendChangeLog, {
        entries: [entry(null, { entityId: 'p-owner', after: 'Planted' })],
      })
    ).rejects.toThrow(/not yours to write/)

    // Assert on what the owner reads, not only the throw: nothing reached the
    // drawer, and the stranger cannot read the history either.
    const log = await owner.as.query(api.changeLog.forEntity, {
      entityType: 'pilot',
      entityId: 'p-owner',
    })
    expect(log.map((r) => r.after)).not.toContain('Planted')
    expect(log).toHaveLength(0)
    await expect(
      stranger.as.query(api.changeLog.forEntity, { entityType: 'pilot', entityId: 'p-owner' })
    ).rejects.toThrow(/not yours to read/)
  })

  test('nor by naming its row id instead of its app id', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    const stranger = await makeUser(t, 'Stranger')
    await addPilot(owner, 'p-owner', null)
    const rowId = await t.run(async (ctx) => {
      const row = await ctx.db
        .query('pilots')
        .withIndex('by_app_id', (q) => q.eq('appId', 'p-owner'))
        .unique()
      if (row === null) throw new Error('expected the pilot')
      return row._id
    })

    await expect(
      stranger.as.mutation(api.changeLog.appendChangeLog, {
        entries: [entry(null, { entityId: rowId })],
      })
    ).rejects.toThrow(/not yours to write/)
    const rows = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(rows).toHaveLength(0)
  })

  test('nor into an in-Game build, from outside that Game', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    const stranger = await makeUser(t, 'Stranger')
    await addPilot(player, 'p-crew', gameId)

    await expect(
      stranger.as.mutation(api.changeLog.appendChangeLog, {
        entries: [entry(null, { entityId: 'p-crew' })],
      })
    ).rejects.toThrow(/Not a member of this game/)
    const rows = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(rows).toHaveLength(0)
  })

  test("a crewmate may log against the Game's builds, and its communal crawler", async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await addPilot(player, 'p-crew', gameId)
    await addCrawler(organizer, 'c-crew', gameId)

    await organizer.as.mutation(api.changeLog.appendChangeLog, {
      entries: [entry(gameId, { entityId: 'p-crew' })],
    })
    await player.as.mutation(api.changeLog.appendChangeLog, {
      entries: [entry(gameId, { entityType: 'crawler', entityId: 'c-crew' })],
    })

    const log = await player.as.query(api.changeLog.forEntity, {
      entityType: 'pilot',
      entityId: 'p-crew',
    })
    expect(log).toHaveLength(1)
  })

  test('an entity the server has no row for is refused', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Solo')

    await expect(
      user.as.mutation(api.changeLog.appendChangeLog, {
        entries: [entry(null, { entityId: 'not-yet' })],
      })
    ).rejects.toThrow(/no such entity/)
  })
})
