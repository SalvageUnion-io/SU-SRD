import { describe, expect, test } from 'bun:test'
import { api } from '../_generated/api'
import { testConvex } from './harness'

/**
 * Crew visibility (D12).
 *
 * The privacy boundary is what these tests are for. "Every member sees every
 * crewmate" is easy to get right; the cases that matter are the two things that
 * must stay *out* — a non-member seeing anything at all, and a shelved entity
 * (which belongs to one person and to no crew) being reachable through a
 * Game-scoped read.
 */

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

async function seedGame(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer')
  const player = await makeUser(t, 'Beefcake')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await organizer.as.mutation(api.invites.create, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  return { organizer, player, gameId }
}

describe('vitals', () => {
  test('shows every crewmate, with owner names resolved', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('pilots', {
        gameId,
        ownerId: player.userId,
        // Casing is the point, not an incidental. `src/lib/schemas/` defines
        // `currentHP` / `currentAP`, and `crew.vitals` once read `currentHp` /
        // `currentAp` — so every pilot's HP came back null and the crew strip
        // rendered a row of em-dashes, which looks exactly like "nobody has
        // taken damage yet". The body is `v.any()` across the wire, so this
        // fixture is the only thing standing between that bug and production.
        body: { callsign: 'Roach-Boy', currentHP: 7, currentAP: 3 },
        updatedAt: 1,
      })
    })

    const crew = await organizer.as.query(api.crew.vitals, { gameId })
    expect(crew.pilots).toHaveLength(1)
    expect(crew.pilots[0]?.name).toBe('Roach-Boy')
    expect(crew.pilots[0]?.currentHP).toBe(7)
    // The chip needs a name, not just an id.
    expect(crew.pilots[0]?.ownerName).toBe('Beefcake')
  })

  test('an unclaimed pilot has a null owner name rather than a missing row', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('pilots', {
        gameId,
        ownerId: null,
        body: { callsign: 'Pre-gen' },
        updatedAt: 1,
      })
    })

    const crew = await organizer.as.query(api.crew.vitals, { gameId })
    // Unclaimed pre-gens must still appear — they are what the Mediator hands
    // out, so hiding them would hide the onboarding path.
    expect(crew.pilots).toHaveLength(1)
    expect(crew.pilots[0]?.ownerId).toBeNull()
    expect(crew.pilots[0]?.ownerName).toBeNull()
  })

  test('a missing numeric field reads as null, not NaN or zero', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('pilots', { gameId, ownerId: null, body: {}, updatedAt: 1 })
    })

    const crew = await organizer.as.query(api.crew.vitals, { gameId })
    // Bodies are opaque, so the projection must not trust their shape. Zero
    // would render as "dead" on a vitals strip, which is worse than blank.
    expect(crew.pilots[0]?.currentHP).toBeNull()
  })

  test('a non-member gets nothing', async () => {
    const t = testConvex()
    const { gameId } = await seedGame(t)
    const outsider = await makeUser(t, 'Outsider')

    await expect(outsider.as.query(api.crew.vitals, { gameId })).rejects.toThrow(/not a member/i)
  })
})

describe('readEntity', () => {
  test("a member can read a crewmate's sheet", async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    const pilotId = await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId,
          ownerId: player.userId,
          body: { callsign: 'Roach-Boy' },
          updatedAt: 1,
        })
    )

    // "Lean over and look at their sheet", which is what a table does.
    const seen = await organizer.as.query(api.crew.readEntity, {
      table: 'pilots',
      entityId: pilotId,
    })
    expect(seen).not.toBeNull()
    expect((seen?.body as { callsign: string } | undefined)?.callsign).toBe('Roach-Boy')
  })

  test('a non-member cannot', async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    const outsider = await makeUser(t, 'Outsider')
    const pilotId = await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId,
          ownerId: player.userId,
          body: {},
          updatedAt: 1,
        })
    )

    await expect(
      outsider.as.query(api.crew.readEntity, { table: 'pilots', entityId: pilotId })
    ).rejects.toThrow(/not a member/i)
  })

  test('a shelved entity is not reachable through this query at all', async () => {
    const t = testConvex()
    const { organizer, player } = await seedGame(t)
    const shelved = await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId: null,
          ownerId: player.userId,
          body: { callsign: 'Private draft' },
          updatedAt: 1,
        })
    )

    // A shelf belongs to one person and to no crew. There is no membership that
    // could grant access, so the answer is "nothing here" rather than a check
    // that might one day be loosened.
    const seen = await organizer.as.query(api.crew.readEntity, {
      table: 'pilots',
      entityId: shelved,
    })
    expect(seen).toBeNull()
  })
})
