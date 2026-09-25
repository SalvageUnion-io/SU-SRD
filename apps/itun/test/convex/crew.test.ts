import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { MechSchema } from '../../src/lib/schemas/mech'
import { PilotSchema } from '../../src/lib/schemas/pilot'
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

  test('reads the field names the Zod schema actually defines', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)

    // The body is built by PARSING a real record rather than hand-written, so
    // the key names come from the schema instead of from this test's memory of
    // them. That is the whole point: this query used to read `currentHp` while
    // the schema defines `currentHP`, every vital came back null, and the crew
    // strip rendered em-dashes that were indistinguishable from an undamaged
    // crew. A hand-written fixture agreed with the bug and kept it green.
    const pilot = PilotSchema.parse({
      id: 'p1',
      schemaVersion: 1,
      name: 'Roach-Boy',
      callsign: 'Roach-Boy',
      classRef: 'salvager',
      abilities: [],
      equipment: [],
      motto: '',
      keepsake: '',
      appearance: '',
      conditions: [],
      currentHP: 9,
      currentAP: 4,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const mech = MechSchema.parse({
      id: 'm1',
      schemaVersion: 1,
      name: 'Iron Mongrel',
      chassisRef: 'iron-mongrel',
      systems: [],
      modules: [],
      cargoLots: [],
      conditions: [],
      currentSP: 12,
      currentHeat: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

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
