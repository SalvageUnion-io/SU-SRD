import { describe, expect, test } from 'bun:test'
import { ConvexError } from 'convex/values'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { crawlerFixture, npcFixture } from '../../src/components/__tests__/fixtures'
import type { CrewSlot } from '../../src/lib/schemas/softLink'
import type { Ctx, User } from './fixtures'
import { makeUser, seedTable } from './fixtures'
import { testConvex } from './harness'

/**
 * Built NPCs and the `npc-to-crawler` link (ADR-043).
 *
 * An NPC is owned like a pilot: written whole by its owner through
 * `upsertByAppId`, listed back by `listMine`, read by a Game's members through
 * `listForGame`, moved by its owner. Its crew link is the one link authorised
 * by its `to` end — whoever may write the crawler draws and deletes it — and
 * neither drawing nor deleting it writes the crawler, so a bay falls back to
 * the book's crew line exactly as it was.
 */

const MED_BAY: CrewSlot = { kind: 'bay', bayRef: 'med-bay' }
const MECH_BAY: CrewSlot = { kind: 'bay', bayRef: 'mech-bay' }

/** A crawler with two bays, its Med Bay crew already named inline. */
function crawlerBody(id: string, gameId: Id<'games'> | null) {
  return {
    ...crawlerFixture({ id, name: `Crawler ${id}` }),
    gameId,
    type: 'augmented',
    crawlerBays: [
      { bayRef: 'med-bay', npcName: 'Old Mags', npcCurrentHP: 3 },
      { bayRef: 'mech-bay' },
    ],
  }
}

async function addCrawler(user: User, id: string, gameId: Id<'games'> | null) {
  await user.as.mutation(api.entities.createCrawler, {
    gameId,
    appId: id,
    body: crawlerBody(id, gameId),
  })
}

async function addNpc(user: User, id: string, gameId: Id<'games'> | null) {
  await user.as.mutation(api.entities.upsertByAppId, {
    table: 'npcs',
    appId: id,
    gameId,
    body: { ...npcFixture({ id, name: `NPC ${id}` }), gameId },
    expectedUpdatedAt: null,
  })
}

async function moveNpc(user: User, id: string, gameId: Id<'games'> | null) {
  await user.as.mutation(api.entities.upsertByAppId, {
    table: 'npcs',
    appId: id,
    gameId,
    body: { ...npcFixture({ id, name: `NPC ${id}` }), gameId },
    expectedUpdatedAt: null,
  })
}

async function crew(user: User, npcId: string, crawlerId: string, slot: CrewSlot) {
  await user.as.mutation(api.entities.upsertSoftLink, {
    from: { type: 'npc', id: npcId },
    to: { type: 'crawler', id: crawlerId },
    type: 'npc-to-crawler',
    slot,
  })
}

async function uncrew(user: User, npcId: string, crawlerId: string, slot: CrewSlot) {
  await user.as.mutation(api.entities.removeSoftLink, {
    from: { type: 'npc', id: npcId },
    to: { type: 'crawler', id: crawlerId },
    type: 'npc-to-crawler',
    slot,
  })
}

async function crewLinks(t: Ctx) {
  const rows = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
  return rows.map((l) => ({ from: l.from.id, to: l.to.id, slot: l.slot, gameId: l.gameId }))
}

async function crawlerBodyOf(t: Ctx, appId: string) {
  return await t.run(async (ctx) => {
    const row = await ctx.db
      .query('crawlers')
      .withIndex('by_app_id', (q) => q.eq('appId', appId))
      .first()
    return row?.body
  })
}

describe('a built NPC is owned like a pilot', () => {
  test('it is written to the shelf, listed back, and versioned', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await addNpc(me, 'n1', null)

    const mine = await me.as.query(api.entities.listMine, {})
    expect(mine.npcs).toHaveLength(1)
    expect((mine.npcs[0]?.body as { name?: string } | undefined)?.name).toBe('NPC n1')
    expect(mine.npcs[0]?.appId).toBe('n1')
    // The Mediator's tray is a separate thing and is not touched.
    expect(mine.encounterNpcs).toEqual([])
  })

  test('a malformed body is refused at the edge', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await expect(
      me.as.mutation(api.entities.upsertByAppId, {
        table: 'npcs',
        appId: 'n1',
        gameId: null,
        body: { id: 'n1', name: 'No stat block' },
        expectedUpdatedAt: null,
      })
    ).rejects.toThrow(/Invalid npcs payload/)
  })

  test('nobody else writes it', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await addNpc(player, 'n1', gameId)

    await expect(moveNpc(organizer, 'n1', gameId)).rejects.toThrow(ConvexError)
  })

  test("a Game's members read it through listForGame", async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await addNpc(player, 'n1', gameId)

    const listing = await organizer.as.query(api.entities.listForGame, { gameId })
    expect(listing.npcs.map((n) => n.appId)).toEqual(['n1'])
  })

  test('it moves into a Game and back, and its owner deletes it', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await addNpc(player, 'n1', null)
    await moveNpc(player, 'n1', gameId)
    expect((await player.as.query(api.entities.locate, { kind: 'npc', id: 'n1' }))?.gameId).toBe(
      gameId
    )

    await player.as.mutation(api.entities.removeByAppId, { table: 'npcs', appId: 'n1' })
    expect((await player.as.query(api.entities.listMine, {})).npcs).toEqual([])
  })

  test('destroying the Game shelves it with its owner', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await addNpc(player, 'n1', gameId)

    await organizer.as.mutation(api.games.destroy, { gameId })

    const row = await t.run(async (ctx) => await ctx.db.query('npcs').first())
    expect(row?.gameId).toBeNull()
    expect(row?.ownerId).toBe(player.userId)
  })
})

describe('npc-to-crawler — the crew slot is on the link', () => {
  test('the owner of a shelf crawler crews a bay, and the inline crew is untouched', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await addCrawler(me, 'c1', null)
    await addNpc(me, 'n1', null)
    const before = await crawlerBodyOf(t, 'c1')

    await crew(me, 'n1', 'c1', MED_BAY)

    expect(await crewLinks(t)).toEqual([{ from: 'n1', to: 'c1', slot: MED_BAY, gameId: null }])
    expect(await crawlerBodyOf(t, 'c1')).toEqual(before)
  })

  test('unassigning deletes only the link: the book line is back byte for byte', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await addCrawler(me, 'c1', null)
    await addNpc(me, 'n1', null)
    const before = await crawlerBodyOf(t, 'c1')

    await crew(me, 'n1', 'c1', MED_BAY)
    await uncrew(me, 'n1', 'c1', MED_BAY)

    expect(await crewLinks(t)).toEqual([])
    expect(JSON.stringify(await crawlerBodyOf(t, 'c1'))).toBe(JSON.stringify(before))
  })

  test('an NPC fills one slot, and a slot holds one NPC', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await addCrawler(me, 'c1', null)
    await addNpc(me, 'n1', null)
    await addNpc(me, 'n2', null)

    await crew(me, 'n1', 'c1', MED_BAY)
    // n1 moves to the Mech Bay: its Med Bay link goes.
    await crew(me, 'n1', 'c1', MECH_BAY)
    expect(await crewLinks(t)).toEqual([{ from: 'n1', to: 'c1', slot: MECH_BAY, gameId: null }])

    // n2 takes the Mech Bay: n1 is bumped out of it.
    await crew(me, 'n2', 'c1', MECH_BAY)
    expect(await crewLinks(t)).toEqual([{ from: 'n2', to: 'c1', slot: MECH_BAY, gameId: null }])

    // Two different slots hold two NPCs.
    await crew(me, 'n1', 'c1', MED_BAY)
    expect(await crewLinks(t)).toHaveLength(2)
  })

  test('the type slot needs a typed crawler; a bay slot needs that bay', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await addCrawler(me, 'c1', null)
    await addNpc(me, 'n1', null)

    await crew(me, 'n1', 'c1', { kind: 'type' })
    expect((await crewLinks(t))[0]?.slot).toEqual({ kind: 'type' })

    await expect(crew(me, 'n1', 'c1', { kind: 'bay', bayRef: 'cantina' })).rejects.toThrow(
      /no such crew slot/
    )
  })

  test('a crew link names its slot, and no other link may', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await addCrawler(me, 'c1', null)
    await addNpc(me, 'n1', null)

    await expect(
      me.as.mutation(api.entities.upsertSoftLink, {
        from: { type: 'npc', id: 'n1' },
        to: { type: 'crawler', id: 'c1' },
        type: 'npc-to-crawler',
      })
    ).rejects.toThrow(/names the crew slot/)
    await expect(
      me.as.mutation(api.entities.upsertSoftLink, {
        from: { type: 'pilot', id: 'p1' },
        to: { type: 'crawler', id: 'c1' },
        type: 'pilot-to-crawler',
        slot: MED_BAY,
      })
    ).rejects.toThrow(/has no crew slot/)
  })

  test('a shelf NPC cannot crew a Game crawler', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedTable(t)
    await addCrawler(organizer, 'c1', gameId)
    await addNpc(organizer, 'n1', null)

    await expect(crew(organizer, 'n1', 'c1', MED_BAY)).rejects.toThrow(ConvexError)
    expect(await crewLinks(t)).toEqual([])
  })
})

describe('in a Game, only the table runner assigns crew (ADR-043)', () => {
  test('a player offers an NPC by moving it in; the table runner assigns it', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await addCrawler(organizer, 'c1', gameId)
    await addNpc(player, 'n1', null)
    await moveNpc(player, 'n1', gameId)

    // The player owns the NPC, but the crawler is the table's.
    await expect(crew(player, 'n1', 'c1', MED_BAY)).rejects.toThrow(/Only whoever runs the table/)

    await crew(organizer, 'n1', 'c1', MED_BAY)
    expect(await crewLinks(t)).toEqual([{ from: 'n1', to: 'c1', slot: MED_BAY, gameId }])

    // Nor may the player unassign it…
    await expect(uncrew(player, 'n1', 'c1', MED_BAY)).rejects.toThrow(/Only whoever runs the table/)
    // …but the table runner may.
    await uncrew(organizer, 'n1', 'c1', MED_BAY)
    expect(await crewLinks(t)).toEqual([])
  })

  test('moving the NPC out of the Game prunes its slot', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await addCrawler(organizer, 'c1', gameId)
    await addNpc(player, 'n1', gameId)
    await crew(organizer, 'n1', 'c1', MED_BAY)

    await moveNpc(player, 'n1', null)

    expect(await crewLinks(t)).toEqual([])
  })

  test("deleting the NPC cascades to its slot, whoever's crawler it was", async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await addCrawler(organizer, 'c1', gameId)
    await addNpc(player, 'n1', gameId)
    await crew(organizer, 'n1', 'c1', MED_BAY)

    await player.as.mutation(api.entities.removeByAppId, { table: 'npcs', appId: 'n1' })

    expect(await crewLinks(t)).toEqual([])
  })

  test('the crew link syncs down with its slot', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await addCrawler(organizer, 'c1', gameId)
    await addNpc(player, 'n1', gameId)
    await crew(organizer, 'n1', 'c1', MED_BAY)

    const wiring = await player.as.query(api.entities.listWiring, {})
    expect(wiring.softLinks.map((l) => ({ type: l.type, slot: l.slot }))).toEqual([
      { type: 'npc-to-crawler', slot: MED_BAY },
    ])
  })
})
