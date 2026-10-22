import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { api } from '../../../convex/_generated/api'
import { FIXTURE_NOW, npcFixture } from '../../../src/components/__tests__/fixtures'
import type { Ctx, User } from '../fixtures'
import { makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * The Homebrew library (ADR-056): a maker lists a pattern or NPC they already
 * share by link; anyone reads the gallery with no account; a signed-in reader
 * reports; a site admin hides. A listing is never more public than its source.
 */

const PATTERN_ID = 'pat-tow-rig'
const NPC_ID = 'npc-mags'
const ADMIN_DISCORD = 'd-admin'

function patternBody(over: Record<string, unknown> = {}) {
  return {
    id: PATTERN_ID,
    schemaVersion: 1,
    name: 'Tow Rig',
    chassisRef: 'scrapper',
    systems: ['rigging-arm'],
    modules: [],
    cargoLots: [],
    createdAt: FIXTURE_NOW,
    ...over,
  }
}

async function sharedPattern(maker: User) {
  await maker.as.mutation(api.shelf.upsertMechPattern, { body: patternBody() })
  await maker.as.mutation(api.shelf.setPatternVisibility, {
    patternId: PATTERN_ID,
    visibility: 'link',
  })
}

async function sharedNpc(maker: User) {
  await maker.as.mutation(api.entities.upsertByAppId, {
    table: 'npcs',
    appId: NPC_ID,
    gameId: null,
    body: { ...npcFixture({ id: NPC_ID, name: 'Old Mags' }), gameId: null },
    expectedUpdatedAt: null,
  })
  await maker.as.mutation(api.publicSheet.setPublic, { kind: 'npc', appId: NPC_ID, isPublic: true })
}

async function listedIds(t: Ctx) {
  return (await t.query(api.library.list, {})).map((row) => row.appId)
}

let savedAdmins: string | undefined
beforeEach(() => {
  savedAdmins = process.env.ADMIN_DISCORD_IDS
  process.env.ADMIN_DISCORD_IDS = ADMIN_DISCORD
})
afterEach(() => {
  if (savedAdmins === undefined) delete process.env.ADMIN_DISCORD_IDS
  else process.env.ADMIN_DISCORD_IDS = savedAdmins
})

describe('listing', () => {
  test('a maker lists a shared pattern and NPC; anyone reads them, credited', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'Rosa')
    await sharedPattern(maker)
    await sharedNpc(maker)

    await maker.as.mutation(api.library.setListed, {
      kind: 'pattern',
      appId: PATTERN_ID,
      listed: true,
    })
    await maker.as.mutation(api.library.setListed, { kind: 'npc', appId: NPC_ID, listed: true })

    const rows = await t.query(api.library.list, {})
    expect(rows.map((r) => [r.kind, r.appId, r.madeBy, r.mine])).toEqual([
      ['npc', NPC_ID, 'Rosa', false],
      ['pattern', PATTERN_ID, 'Rosa', false],
    ])
    expect((await t.query(api.library.list, { kind: 'pattern' })).map((r) => r.appId)).toEqual([
      PATTERN_ID,
    ])
    expect((await maker.as.query(api.library.list, {})).every((r) => r.mine)).toBe(true)
    expect(await t.query(api.library.status, { kind: 'pattern', appId: PATTERN_ID })).toMatchObject(
      { listed: true, hidden: false }
    )
  })

  test('only what is shared by link can be listed', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'Rosa')
    await maker.as.mutation(api.shelf.upsertMechPattern, { body: patternBody() })

    await expect(
      maker.as.mutation(api.library.setListed, { kind: 'pattern', appId: PATTERN_ID, listed: true })
    ).rejects.toThrow(/anyone with the link/)
    expect(await listedIds(t)).toEqual([])
  })

  test('nobody lists another player’s homebrew', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'Rosa')
    const other = await makeUser(t, 'Other')
    await sharedPattern(maker)
    await sharedNpc(maker)

    await expect(
      other.as.mutation(api.library.setListed, { kind: 'pattern', appId: PATTERN_ID, listed: true })
    ).rejects.toThrow()
    await expect(
      other.as.mutation(api.library.setListed, { kind: 'npc', appId: NPC_ID, listed: true })
    ).rejects.toThrow()
    expect(await listedIds(t)).toEqual([])
  })

  test('withdrawing the link, or deleting the thing, delists it', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'Rosa')
    await sharedPattern(maker)
    await sharedNpc(maker)
    await maker.as.mutation(api.library.setListed, {
      kind: 'pattern',
      appId: PATTERN_ID,
      listed: true,
    })
    await maker.as.mutation(api.library.setListed, { kind: 'npc', appId: NPC_ID, listed: true })

    await maker.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'private',
    })
    await maker.as.mutation(api.entities.removeByAppId, { table: 'npcs', appId: NPC_ID })

    expect(await listedIds(t)).toEqual([])
    const entries = await t.run(async (ctx) => await ctx.db.query('libraryEntries').collect())
    expect(entries).toEqual([])
  })

  test('another account’s row under the same app id never touches the listing', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'Rosa')
    const other = await makeUser(t, 'Other')
    await sharedNpc(maker)
    await maker.as.mutation(api.library.setListed, { kind: 'npc', appId: NPC_ID, listed: true })
    // Writes refuse a second owner's row, but rows older than that rule can hold one.
    await t.run(async (ctx) => {
      const { _id, _creationTime, ...row } = (await ctx.db.query('npcs').first())!
      await ctx.db.insert('npcs', { ...row, ownerId: other.userId })
    })

    await other.as.mutation(api.library.setListed, { kind: 'npc', appId: NPC_ID, listed: false })
    await other.as.mutation(api.account.deleteAccount, {})
    expect(await t.run(async (ctx) => (await ctx.db.query('npcs').collect()).length)).toBe(1)

    expect(await listedIds(t)).toEqual([NPC_ID])
    expect(await maker.as.query(api.library.status, { kind: 'npc', appId: NPC_ID })).toMatchObject({
      listed: true,
      mine: true,
    })
  })

  test('delisting takes it out at once', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'Rosa')
    await sharedPattern(maker)
    await maker.as.mutation(api.library.setListed, {
      kind: 'pattern',
      appId: PATTERN_ID,
      listed: true,
    })
    await maker.as.mutation(api.library.setListed, {
      kind: 'pattern',
      appId: PATTERN_ID,
      listed: false,
    })
    expect(await listedIds(t)).toEqual([])
    // Still shared by link: delisting narrows nothing else.
    expect(await t.query(api.publicSheet.pattern, { appId: PATTERN_ID })).not.toBeNull()
  })
})

describe('reports and takedown', () => {
  async function listedTable() {
    const t = testConvex()
    const maker = await makeUser(t, 'Rosa')
    const reader = await makeUser(t, 'Reader')
    const admin = await makeUser(t, 'Admin', ADMIN_DISCORD)
    await sharedPattern(maker)
    await maker.as.mutation(api.library.setListed, {
      kind: 'pattern',
      appId: PATTERN_ID,
      listed: true,
    })
    return { t, maker, reader, admin }
  }

  test('a signed-in reader reports once; the admin reads the reasons', async () => {
    const { t, maker, reader, admin } = await listedTable()
    const target = { kind: 'pattern' as const, appId: PATTERN_ID }

    await expect(t.mutation(api.library.report, { ...target, reason: 'spam' })).rejects.toThrow()
    await expect(
      maker.as.mutation(api.library.report, { ...target, reason: 'mine' })
    ).rejects.toThrow(/your own/)
    await reader.as.mutation(api.library.report, { ...target, reason: 'Copied text' })
    await reader.as.mutation(api.library.report, { ...target, reason: 'Copied book text' })

    expect(await reader.as.query(api.library.status, target)).toMatchObject({ reported: true })
    expect(await reader.as.query(api.library.moderation, {})).toBeNull()
    const queue = await admin.as.query(api.library.moderation, {})
    expect(queue?.reported).toEqual([
      {
        ...target,
        name: 'Tow Rig',
        madeBy: 'Rosa',
        reportCount: 1,
        reasons: ['Copied book text'],
        hiddenAt: null,
      },
    ])
  })

  test('only an admin hides; a hidden listing leaves the gallery and its maker cannot relist it', async () => {
    const { t, maker, reader, admin } = await listedTable()
    const target = { kind: 'pattern' as const, appId: PATTERN_ID }

    await expect(
      reader.as.mutation(api.library.setHidden, { ...target, hidden: true })
    ).rejects.toThrow(/Admins only/)
    await admin.as.mutation(api.library.setHidden, { ...target, hidden: true })

    expect(await listedIds(t)).toEqual([])
    expect(await maker.as.query(api.library.status, target)).toMatchObject({
      listed: false,
      hidden: true,
    })
    // A stranger is not told it was taken down.
    expect(await t.query(api.library.status, target)).toMatchObject({ hidden: false })
    await expect(
      maker.as.mutation(api.library.setListed, { ...target, listed: true })
    ).rejects.toThrow(/site admin/)
    // Withdrawing the link and sharing it again does not undo the takedown.
    await maker.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'private',
    })
    await maker.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'link',
    })
    await expect(
      maker.as.mutation(api.library.setListed, { ...target, listed: true })
    ).rejects.toThrow(/site admin/)

    await admin.as.mutation(api.library.setHidden, { ...target, hidden: false })
    expect(await listedIds(t)).toEqual([PATTERN_ID])
  })

  test('with no admin configured, nobody is one', async () => {
    const { admin } = await listedTable()
    delete process.env.ADMIN_DISCORD_IDS
    expect(await admin.as.query(api.library.moderation, {})).toBeNull()
    await expect(
      admin.as.mutation(api.library.setHidden, {
        kind: 'pattern',
        appId: PATTERN_ID,
        hidden: true,
      })
    ).rejects.toThrow(/Admins only/)
  })

  test('a deleted account takes its reports with it', async () => {
    const { reader, admin } = await listedTable()
    const target = { kind: 'pattern' as const, appId: PATTERN_ID }
    await reader.as.mutation(api.library.report, { ...target, reason: 'spam' })
    expect((await reader.as.query(api.account.exportMine, {})).libraryReports).toHaveLength(1)

    await reader.as.mutation(api.account.deleteAccount, {})
    const queue = await admin.as.query(api.library.moderation, {})
    expect(queue?.reported).toEqual([])
  })
})
