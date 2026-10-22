import { describe, expect, test } from 'bun:test'
import { MechSchema } from 'game-domain/schemas/mech'
import { PilotSchema } from 'game-domain/schemas/pilot'
import { api } from '../../../convex/_generated/api'
import { makeUser, mechBody, pilotBody, seedTable } from '../fixtures'
import { testConvex } from '../harness'

/**
 * Crew visibility (ADR-030 §5).
 *
 * The privacy boundary is what these tests are for. "Every member sees every
 * crewmate" is easy to get right; the cases that matter are the two things that
 * must stay *out* — a non-member seeing anything at all, and a shelved entity
 * (which belongs to one person and to no crew) being reachable through a
 * Game-scoped read.
 */

describe('vitals', () => {
  test('shows every crewmate, with owner names resolved', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('pilots', {
        gameId,
        ownerId: player.userId,
        body: { callsign: 'Roach-Boy', currentHP: 7, currentAP: 3 },
        updatedAt: 1,
      })
    })

    const crew = await organizer.as.query(api.crew.vitals, { gameId })
    expect(crew.pilots).toHaveLength(1)
    expect(crew.pilots[0]?.name).toBe('Roach-Boy')
    expect(crew.pilots[0]?.currentHP).toBe(7)
    // The chip needs a name, not just an id.
    expect(crew.pilots[0]?.ownerName).toBe('Player')
  })

  test('names a pilot by callsign, then by name, as every server surface does', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('pilots', {
        gameId,
        ownerId: player.userId,
        body: { callsign: '  Wrench ', name: 'Ada Kell' },
        updatedAt: 1,
      })
      await ctx.db.insert('pilots', {
        gameId,
        ownerId: player.userId,
        body: { callsign: ' ', name: 'Bo Lin' },
        updatedAt: 2,
      })
    })

    const crew = await organizer.as.query(api.crew.vitals, { gameId })
    expect(crew.pilots.map((p) => p.name).sort()).toEqual(['Bo Lin', 'Wrench'])
  })

  test('reads the field names the Zod schema actually defines', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)

    // The body is built by PARSING a real record rather than hand-written, so
    // the key names come from the schema instead of from this test's memory of
    // them. That is the whole point: a query reading `currentHp` where the
    // schema defines `currentHP` gets every vital back null, and the crew strip
    // renders em-dashes indistinguishable from an undamaged crew. A hand-written
    // fixture would agree with that bug and stay green.
    const pilot = PilotSchema.parse(pilotBody({ currentHP: 9, currentAP: 4 }))
    const mech = MechSchema.parse(mechBody({ name: 'Iron Mongrel', currentSP: 12, currentHeat: 2 }))

    await t.run(async (ctx) => {
      await ctx.db.insert('pilots', { gameId, ownerId: player.userId, body: pilot, updatedAt: 1 })
      await ctx.db.insert('mechs', { gameId, ownerId: player.userId, body: mech, updatedAt: 1 })
    })

    const crew = await organizer.as.query(api.crew.vitals, { gameId })
    expect(crew.pilots[0]?.currentHP).toBe(9)
    expect(crew.pilots[0]?.currentAP).toBe(4)
    expect(crew.mechs[0]?.currentSP).toBe(12)
    expect(crew.mechs[0]?.currentHeat).toBe(2)
  })

  test('an unassigned pilot has a null owner name rather than a missing row', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedTable(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('pilots', {
        gameId,
        ownerId: null,
        body: { callsign: 'Pre-gen' },
        updatedAt: 1,
      })
    })

    const crew = await organizer.as.query(api.crew.vitals, { gameId })
    // Unassigned pre-gens must still appear — they are what the Mediator hands
    // out, so hiding them would hide the onboarding path.
    expect(crew.pilots).toHaveLength(1)
    expect(crew.pilots[0]?.ownerId).toBeNull()
    expect(crew.pilots[0]?.ownerName).toBeNull()
  })

  test('a missing numeric field reads as null, not NaN or zero', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedTable(t)
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
    const { gameId } = await seedTable(t)
    const outsider = await makeUser(t, 'Outsider')

    expect(await outsider.as.query(api.crew.vitals, { gameId })).toEqual({
      viewerId: outsider.userId,
      pilots: [],
      mechs: [],
    })
  })
})
