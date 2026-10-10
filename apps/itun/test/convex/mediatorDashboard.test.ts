import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { FIXTURE_NOW } from '../../src/components/__tests__/fixtures'
import { MechSchema } from '../../src/lib/schemas/mech'
import type { Ctx } from './fixtures'
import { makeUser, mechBody } from './fixtures'
import { testConvex } from './harness'

/**
 * The three server additions the Mediator Dashboard brings (issue 1278,
 * docs/architecture/mediator-dashboard.md §4): a proposal's reason, the
 * Mediator's `proposals.sent`, and `mediator.updateNpc`.
 *
 * None of them adds an authority. A reason rides a proposal the Mediator could
 * already make; `sent` reads rows the Mediator wrote; `updateNpc` writes the
 * tray only the Mediator could already write. The tests hold those lines.
 */

/** A Game the Mediator runs, a player in it, and the player's mech. */
async function seedTable(t: Ctx) {
  const gm = await makeUser(t, 'Mediator')
  const player = await makeUser(t, 'Player')
  const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await gm.as.mutation(api.invites.create, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  await gm.as.mutation(api.games.setMediator, { gameId, userId: gm.userId, mediator: true })
  const mechId = await t.run(
    async (ctx) =>
      await ctx.db.insert('mechs', {
        gameId,
        ownerId: player.userId,
        body: MechSchema.parse(
          mechBody({ name: 'Mule', chassisRef: 'mule', currentSP: 10, currentHeat: 0 })
        ),
        updatedAt: 1,
      })
  )
  return { gm, player, gameId, mechId }
}

describe('a proposal may say why', () => {
  test('the reason is trimmed, stored, and shown to the player', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 4,
      reason: '  Rifle Squad volley  ',
    })

    const [pending] = await player.as.query(api.proposals.pending, { gameId })
    expect(pending?.reason).toBe('Rifle Squad volley')
  })

  test('a blank reason is no reason, and a long one is refused rather than cut', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 4,
      reason: '   ',
    })
    const [pending] = await player.as.query(api.proposals.pending, { gameId })
    expect(pending?.reason).toBeNull()

    await expect(
      gm.as.mutation(api.proposals.propose, {
        entityId: mechId,
        entityType: 'mech',
        field: 'currentSP',
        after: 3,
        reason: 'x'.repeat(141),
      })
    ).rejects.toThrow(/140/)
  })
})

describe('sent: what the Mediator has asked, in every state', () => {
  test('newest first, with the target named, the state, and no before', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    const first = await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 8,
    })
    await player.as.mutation(api.proposals.apply, { proposalId: first })
    await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentHeat',
      after: 2,
      reason: 'Overcharge',
    })

    const rows = await gm.as.query(api.proposals.sent, { gameId })
    expect(rows.map((r) => [r.field, r.state])).toEqual([
      ['currentHeat', 'proposed'],
      ['currentSP', 'applied'],
    ])
    expect(rows[0]).toMatchObject({ targetName: 'Mule', reason: 'Overcharge', mine: true })
    expect(rows[0]?.actorName).toBeNull()
    expect('before' in (rows[0] ?? {})).toBe(false)
  })

  test('a superseded proposal stays on the list, marked so', async () => {
    const t = testConvex()
    const { gm, gameId, mechId } = await seedTable(t)
    for (const after of [6, 4]) {
      await gm.as.mutation(api.proposals.propose, {
        entityId: mechId,
        entityType: 'mech',
        field: 'currentSP',
        after,
      })
    }
    const rows = await gm.as.query(api.proposals.sent, { gameId })
    expect(rows.map((r) => r.state)).toEqual(['proposed', 'superseded'])
  })

  test('a Mediator handed the table inherits what is pending, with its sender named', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 6,
    })
    // Hand over: appoint the player, then stand the old Mediator down.
    await gm.as.mutation(api.games.setMediator, { gameId, userId: player.userId, mediator: true })
    await gm.as.mutation(api.games.setMediator, { gameId, userId: gm.userId, mediator: false })

    const [row] = await player.as.query(api.proposals.sent, { gameId })
    expect(row).toMatchObject({ state: 'proposed', mine: false, actorName: 'Mediator' })
  })

  test('the limit caps the read, and alerts are not proposals', async () => {
    const t = testConvex()
    const { gm, gameId, mechId } = await seedTable(t)
    await gm.as.mutation(api.proposals.broadcast, { gameId, message: 'Contact front' })
    for (const field of ['currentSP', 'currentHeat']) {
      await gm.as.mutation(api.proposals.propose, {
        entityId: mechId,
        entityType: 'mech',
        field,
        after: 1,
      })
    }
    expect(await gm.as.query(api.proposals.sent, { gameId, limit: 1 })).toHaveLength(1)
    expect(await gm.as.query(api.proposals.sent, { gameId })).toHaveLength(2)
  })

  test('a player cannot read it', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await expect(player.as.query(api.proposals.sent, { gameId })).rejects.toThrow(/mediator/i)
  })
})

describe('updateNpc moves a tray NPC through the fight', () => {
  async function seedNpc(t: Ctx) {
    const seeded = await seedTable(t)
    const npcId = await seeded.gm.as.mutation(api.mediator.addNpc, {
      gameId: seeded.gameId,
      body: {
        schemaVersion: 1,
        refSchema: 'squads',
        refSlug: 'rifle-squad',
        refName: 'Rifle Squad',
        name: 'Rifle Squad',
        currentHp: 10,
        maxHp: 10,
        statKind: 'hp',
        conditions: [],
        createdAt: FIXTURE_NOW,
        updatedAt: FIXTURE_NOW,
      },
    })
    return { ...seeded, npcId }
  }

  async function bodyOf(seeded: Awaited<ReturnType<typeof seedNpc>>) {
    const [row] = await seeded.gm.as.query(api.mediator.npcs, { gameId: seeded.gameId })
    return row?.body as {
      name: string
      currentHp: number
      lastMediatorRoll?: { roll: number; label?: string }
    }
  }

  test('the Mediator steps its HP, clamped to 0 and its maximum', async () => {
    const t = testConvex()
    const seeded = await seedNpc(t)
    const { gm, npcId } = seeded

    await gm.as.mutation(api.mediator.updateNpc, { npcId, patch: { currentHp: 7 } })
    expect((await bodyOf(seeded)).currentHp).toBe(7)

    await gm.as.mutation(api.mediator.updateNpc, { npcId, patch: { currentHp: 99 } })
    expect((await bodyOf(seeded)).currentHp).toBe(10)

    await gm.as.mutation(api.mediator.updateNpc, { npcId, patch: { currentHp: -4 } })
    expect((await bodyOf(seeded)).currentHp).toBe(0)
  })

  test('a Morale result stays on the NPC, and nothing reaches the crew-readable log', async () => {
    const t = testConvex()
    const seeded = await seedNpc(t)
    const { gm, player, gameId, npcId } = seeded

    await gm.as.mutation(api.mediator.updateNpc, {
      npcId,
      patch: {
        lastMediatorRoll: {
          table: 'morale',
          roll: 7,
          label: 'Fighting Retreat',
          value: 'They retreat, fighting.',
          rolledAt: FIXTURE_NOW,
        },
      },
    })
    expect((await bodyOf(seeded)).lastMediatorRoll).toMatchObject({
      roll: 7,
      label: 'Fighting Retreat',
    })

    // The tray is the one thing ADR-030 §5 hides: the crew sees no roll.
    expect(await player.as.query(api.changeLog.rolls, { gameId, limit: 10 })).toHaveLength(0)
  })

  test('a malformed roll or a blank name is refused, and nothing is written', async () => {
    const t = testConvex()
    const seeded = await seedNpc(t)
    const { gm, npcId } = seeded

    await expect(
      gm.as.mutation(api.mediator.updateNpc, {
        npcId,
        patch: { lastMediatorRoll: { table: 'morale', roll: 40, value: 'x', rolledAt: 'now' } },
      })
    ).rejects.toThrow()
    await expect(
      gm.as.mutation(api.mediator.updateNpc, { npcId, patch: { name: '   ' } })
    ).rejects.toThrow(/name/i)

    expect((await bodyOf(seeded)).name).toBe('Rifle Squad')
  })

  test('a player cannot change one', async () => {
    const t = testConvex()
    const { player, npcId } = await seedNpc(t)
    await expect(
      player.as.mutation(api.mediator.updateNpc, { npcId, patch: { currentHp: 1 } })
    ).rejects.toThrow(/mediator/i)
  })
})
