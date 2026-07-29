import { describe, expect, test } from 'bun:test'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { testConvex } from './harness'

/**
 * The invite scheme past a bare code (ADR-030 §2–4).
 *
 * The three things worth defending here are the ones a UI cannot enforce:
 * an invite grants exactly the seat it was minted for, a grant that has gone
 * stale must not strand the joiner outside the Game, and a knock must not be
 * a membership until someone says so.
 */

type Ctx = ReturnType<typeof testConvex>

/**
 * The first row, or a failure that says so.
 *
 * Destructuring and then asserting non-null hides the interesting case: when a
 * query unexpectedly returns nothing, the test should fail on "expected a row"
 * rather than on a property access against `undefined` several lines later.
 */
function firstRow<T>(rows: T[]): T {
  const row = rows[0]
  if (row === undefined) throw new Error('expected at least one row, got none')
  return row
}

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert('users', { name, displayName: name })
  })
  return { userId, as: t.withIdentity({ subject: userId }) }
}

async function seedGame(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  return { organizer, gameId }
}

async function seedPilot(t: Ctx, gameId: Id<'games'>, ownerId: Id<'users'> | null) {
  return await t.run(async (ctx) =>
    ctx.db.insert('pilots', {
      gameId,
      ownerId,
      body: { callsign: 'Roach-Boy' },
      updatedAt: Date.now(),
    })
  )
}

describe('invite management', () => {
  test('list reports derived status and who redeemed', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const joiner = await makeUser(t, 'Sam')

    const code = await organizer.as.mutation(api.invites.create, {
      gameId,
      label: 'for Sam',
      usesRemaining: 1,
    })
    await joiner.as.mutation(api.invites.redeem, { code })

    const invite = firstRow(await organizer.as.query(api.invites.list, { gameId }))
    expect(invite.label).toBe('for Sam')
    // One use, spent — so the code is exhausted rather than merely used.
    expect(invite.status).toBe('exhausted')
    expect(invite.redeemers).toEqual(['Sam'])
  })

  test('revoke is a soft delete that keeps the audit trail', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const joiner = await makeUser(t, 'Sam')

    const code = await organizer.as.mutation(api.invites.create, { gameId })
    await joiner.as.mutation(api.invites.redeem, { code })

    const before = firstRow(await organizer.as.query(api.invites.list, { gameId }))
    await organizer.as.mutation(api.invites.revoke, { inviteId: before._id })

    const [after] = await organizer.as.query(api.invites.list, { gameId })
    expect(after?.status).toBe('revoked')
    // The row survived, so "who joined via which code" is still answerable.
    expect(after?.redeemers).toEqual(['Sam'])
  })

  test('a revoked code is refused, but does not evict whoever already joined', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const early = await makeUser(t, 'Early')
    const late = await makeUser(t, 'Late')

    const code = await organizer.as.mutation(api.invites.create, { gameId })
    await early.as.mutation(api.invites.redeem, { code })

    const invite = firstRow(await organizer.as.query(api.invites.list, { gameId }))
    await organizer.as.mutation(api.invites.revoke, { inviteId: invite._id })

    await expect(late.as.mutation(api.invites.redeem, { code })).rejects.toThrow(/revoked/i)
    // Early is still seated — revocation closes the door, it does not sweep the room.
    const games = await early.as.query(api.games.listMine, {})
    expect(games).toHaveLength(1)
  })

  test('a non-organizer can neither list nor revoke', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const player = await makeUser(t, 'Player')
    const code = await organizer.as.mutation(api.invites.create, { gameId })
    await player.as.mutation(api.invites.redeem, { code })

    await expect(player.as.query(api.invites.list, { gameId })).rejects.toThrow()

    const invite = firstRow(await organizer.as.query(api.invites.list, { gameId }))
    await expect(player.as.mutation(api.invites.revoke, { inviteId: invite._id })).rejects.toThrow()
  })
})

describe('invites carry a seat and a hand-out', () => {
  test('a mediator invite seats the joiner as Mediator', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const gm = await makeUser(t, 'Vex')

    const code = await organizer.as.mutation(api.invites.create, { gameId, role: 'mediator' })
    await gm.as.mutation(api.invites.redeem, { code })

    const [game] = await gm.as.query(api.games.listMine, {})
    expect(game?.mediator).toBe(true)
  })

  test('a mediator invite defaults to single use', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const first = await makeUser(t, 'First')
    const second = await makeUser(t, 'Second')

    const code = await organizer.as.mutation(api.invites.create, { gameId, role: 'mediator' })
    await first.as.mutation(api.invites.redeem, { code })

    // The schema permits several Mediators; the UI is built for one, so an
    // unlimited mediator code would quietly seat a second.
    await expect(second.as.mutation(api.invites.redeem, { code })).rejects.toThrow(/used up/i)
  })

  test('a grant assigns the pilot and logs the ORGANIZER as the actor', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const joiner = await makeUser(t, 'Sam')
    const pilotId = await seedPilot(t, gameId, null)

    const code = await organizer.as.mutation(api.invites.create, {
      gameId,
      grants: [{ table: 'pilots', entityId: pilotId }],
    })
    const result = await joiner.as.mutation(api.invites.redeem, { code })

    expect(result).toMatchObject({ kind: 'joined', granted: 1 })

    const pilot = await t.run(async (ctx) => ctx.db.get(pilotId))
    expect(pilot?.ownerId).toBe(joiner.userId)

    // ADR-030 §4: ownership is ASSIGNED, never self-claimed. The Organizer made
    // this call when they minted the invite, so the log must name them — not the
    // person who happened to walk through the door.
    const entry = await t.run(async (ctx) =>
      (await ctx.db.query('changeLog').collect()).find(
        (row) => row.entityId === pilotId && row.field === 'ownerId'
      )
    )
    expect(entry?.actorId).toBe(organizer.userId)
    expect(entry?.after).toBe(joiner.userId)
  })

  test('a stale grant is skipped and the joiner still gets in', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const claimer = await makeUser(t, 'Claimer')
    const joiner = await makeUser(t, 'Sam')
    const pilotId = await seedPilot(t, gameId, null)

    const code = await organizer.as.mutation(api.invites.create, {
      gameId,
      grants: [{ table: 'pilots', entityId: pilotId }],
      usesRemaining: 5,
    })

    // Somebody else takes the pilot between minting and redeeming.
    await t.run(async (ctx) => ctx.db.patch(pilotId, { ownerId: claimer.userId }))

    const result = await joiner.as.mutation(api.invites.redeem, { code })

    // Arriving without the promised pilot is a notice. Failing the join over a
    // stale pointer would strand someone outside a Game they were invited to.
    expect(result).toMatchObject({ kind: 'joined', granted: 0 })
    const games = await joiner.as.query(api.games.listMine, {})
    expect(games).toHaveLength(1)
    const pilot = await t.run(async (ctx) => ctx.db.get(pilotId))
    expect(pilot?.ownerId).toBe(claimer.userId)
  })

  test('redeeming twice is idempotent and consumes no second use', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const joiner = await makeUser(t, 'Sam')
    const code = await organizer.as.mutation(api.invites.create, { gameId, usesRemaining: 2 })

    await joiner.as.mutation(api.invites.redeem, { code })
    const second = await joiner.as.mutation(api.invites.redeem, { code })

    expect(second).toMatchObject({ kind: 'already' })
    const invite = firstRow(await organizer.as.query(api.invites.list, { gameId }))
    expect(invite.usesRemaining).toBe(1)
  })
})

describe('preview', () => {
  test('describes the invite without spending it or leaking the crew', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const stranger = await makeUser(t, 'Stranger')
    const code = await organizer.as.mutation(api.invites.create, { gameId, role: 'mediator' })

    const preview = await stranger.as.query(api.invites.preview, { code })
    expect(preview).toMatchObject({
      gameName: 'Tenacity',
      invitedBy: 'Organizer',
      role: 'mediator',
      status: 'active',
    })
    // Looking is not joining.
    expect(await stranger.as.query(api.games.listMine, {})).toHaveLength(0)
    // Nothing about who is already at the table.
    expect(JSON.stringify(preview)).not.toContain('memberCount')
  })

  test('an unknown code is null rather than an error', async () => {
    const t = testConvex()
    const stranger = await makeUser(t, 'Stranger')
    expect(await stranger.as.query(api.invites.preview, { code: 'ZZZZZZZZ' })).toBeNull()
  })

  test('a revoked code previews as revoked, so the landing page can say so', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const stranger = await makeUser(t, 'Stranger')
    const code = await organizer.as.mutation(api.invites.create, { gameId })
    const invite = firstRow(await organizer.as.query(api.invites.list, { gameId }))
    await organizer.as.mutation(api.invites.revoke, { inviteId: invite._id })

    const preview = await stranger.as.query(api.invites.preview, { code })
    expect(preview?.status).toBe('revoked')
  })
})

describe('knock and approve', () => {
  test('a knock creates no membership and burns no use', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const knocker = await makeUser(t, 'Knocker')

    const code = await organizer.as.mutation(api.invites.create, {
      gameId,
      requiresApproval: true,
      usesRemaining: 1,
    })
    const result = await knocker.as.mutation(api.invites.redeem, { code })

    expect(result).toMatchObject({ kind: 'pending' })
    expect(await knocker.as.query(api.games.listMine, {})).toHaveLength(0)

    // A spam of knocks must not be able to burn a code before anyone joins.
    await knocker.as.mutation(api.invites.redeem, { code })
    const invite = firstRow(await organizer.as.query(api.invites.list, { gameId }))
    expect(invite.usesRemaining).toBe(1)
    expect(await organizer.as.query(api.invites.pendingRequests, { gameId })).toHaveLength(1)
  })

  test('approval seats them with the invite’s role and grants', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const knocker = await makeUser(t, 'Knocker')
    const pilotId = await seedPilot(t, gameId, null)

    const code = await organizer.as.mutation(api.invites.create, {
      gameId,
      requiresApproval: true,
      role: 'mediator',
      grants: [{ table: 'pilots', entityId: pilotId }],
    })
    await knocker.as.mutation(api.invites.redeem, { code })

    const request = firstRow(await organizer.as.query(api.invites.pendingRequests, { gameId }))
    await organizer.as.mutation(api.invites.decideRequest, {
      requestId: request._id,
      approve: true,
    })

    // Whichever door they came through, the seat is the same one.
    const [game] = await knocker.as.query(api.games.listMine, {})
    expect(game?.mediator).toBe(true)
    const pilot = await t.run(async (ctx) => ctx.db.get(pilotId))
    expect(pilot?.ownerId).toBe(knocker.userId)
    expect(await organizer.as.query(api.invites.pendingRequests, { gameId })).toHaveLength(0)
  })

  test('a decline leaves them out, and they may knock again', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const knocker = await makeUser(t, 'Knocker')

    const code = await organizer.as.mutation(api.invites.create, {
      gameId,
      requiresApproval: true,
    })
    await knocker.as.mutation(api.invites.redeem, { code })
    const request = firstRow(await organizer.as.query(api.invites.pendingRequests, { gameId }))
    await organizer.as.mutation(api.invites.decideRequest, {
      requestId: request._id,
      approve: false,
    })

    expect(await knocker.as.query(api.games.listMine, {})).toHaveLength(0)
    expect(await organizer.as.query(api.invites.pendingRequests, { gameId })).toHaveLength(0)

    // An Organizer who declined by mistake should not have to mint a fresh code.
    await knocker.as.mutation(api.invites.redeem, { code })
    expect(await organizer.as.query(api.invites.pendingRequests, { gameId })).toHaveLength(1)
  })

  test('only the organizer can see or answer knocks', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const player = await makeUser(t, 'Player')
    const knocker = await makeUser(t, 'Knocker')

    const open = await organizer.as.mutation(api.invites.create, { gameId })
    await player.as.mutation(api.invites.redeem, { code: open })

    const gated = await organizer.as.mutation(api.invites.create, {
      gameId,
      requiresApproval: true,
    })
    await knocker.as.mutation(api.invites.redeem, { code: gated })

    await expect(player.as.query(api.invites.pendingRequests, { gameId })).rejects.toThrow()
    const request = firstRow(await organizer.as.query(api.invites.pendingRequests, { gameId }))
    await expect(
      player.as.mutation(api.invites.decideRequest, { requestId: request._id, approve: true })
    ).rejects.toThrow()
  })

  test('approving a code that expired while pending is refused', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const knocker = await makeUser(t, 'Knocker')

    const code = await organizer.as.mutation(api.invites.create, {
      gameId,
      requiresApproval: true,
    })
    await knocker.as.mutation(api.invites.redeem, { code })

    await t.run(async (ctx) => {
      for (const row of await ctx.db.query('invites').collect()) {
        if (row.code === code) await ctx.db.patch(row._id, { expiresAt: Date.now() - 1000 })
      }
    })

    const request = firstRow(await organizer.as.query(api.invites.pendingRequests, { gameId }))
    await expect(
      organizer.as.mutation(api.invites.decideRequest, { requestId: request._id, approve: true })
    ).rejects.toThrow(/expired/i)
  })
})

describe('deleting a game', () => {
  test('sweeps redemptions and pending knocks along with the invites', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const joiner = await makeUser(t, 'Sam')
    const knocker = await makeUser(t, 'Knocker')

    const open = await organizer.as.mutation(api.invites.create, { gameId })
    await joiner.as.mutation(api.invites.redeem, { code: open })

    const gated = await organizer.as.mutation(api.invites.create, {
      gameId,
      requiresApproval: true,
    })
    await knocker.as.mutation(api.invites.redeem, { code: gated })

    await organizer.as.mutation(api.games.destroy, { gameId })

    // A knock at a door that no longer exists would otherwise sit pending
    // forever, and a redemption row would point at a deleted Game.
    const leftovers = await t.run(async (ctx) => ({
      invites: (await ctx.db.query('invites').collect()).length,
      redemptions: (await ctx.db.query('inviteRedemptions').collect()).length,
      requests: (await ctx.db.query('joinRequests').collect()).length,
    }))
    expect(leftovers).toEqual({ invites: 0, redemptions: 0, requests: 0 })
  })
})

describe('games.get and the row summary', () => {
  test('summarize carries the crawler name and the entity counts', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    await seedPilot(t, gameId, null)
    await seedPilot(t, gameId, null)
    await t.run(async (ctx) => {
      await ctx.db.insert('mechs', {
        gameId,
        ownerId: null,
        body: { name: 'Mule' },
        updatedAt: Date.now(),
      })
      await ctx.db.insert('crawlers', {
        gameId,
        body: { name: 'Hamlet' },
        updatedAt: Date.now(),
      })
    })

    const game = await organizer.as.query(api.games.get, { gameId })
    expect(game).toMatchObject({
      crawlerName: 'Hamlet',
      pilotCount: 2,
      mechCount: 1,
    })
  })

  test('a game with no crawler and nothing built degrades rather than breaking', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const game = await organizer.as.query(api.games.get, { gameId })
    // The badges need a null to render "No crawler", not an undefined to crash on.
    expect(game).toMatchObject({ crawlerName: null, pilotCount: 0, mechCount: 0 })
  })

  test('games.get is null for a non-member rather than an error', async () => {
    const t = testConvex()
    const { gameId } = await seedGame(t)
    const stranger = await makeUser(t, 'Stranger')
    // A bookmarked URL for a game you left is an ordinary thing to visit.
    expect(await stranger.as.query(api.games.get, { gameId })).toBeNull()
  })
})
