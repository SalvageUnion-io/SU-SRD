import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { api } from '../../../convex/_generated/api'
import { FIXTURE_NOW } from '../../../src/components/__tests__/fixtures'
import type { Ctx, User } from '../fixtures'
import { makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * Homebrew (ADR-059): a saved pattern its maker shares with "Anyone with the
 * link" and then with everyone on the Reference is on the SRD, read with no
 * account; a signed-in reader reports one; a site admin hides one. Never more
 * public than the link.
 */

const PATTERN_ID = 'pat-tow-rig'
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

async function savePattern(maker: User, over: Record<string, unknown> = {}) {
  await maker.as.mutation(api.shelf.upsertMechPattern, { body: patternBody(over) })
}

async function share(maker: User, patternId = PATTERN_ID, visibility = 'link' as const) {
  await maker.as.mutation(api.shelf.setPatternVisibility, { patternId, visibility })
}

/** Both opt-ins: the link, then the Reference. */
async function list(maker: User, patternId = PATTERN_ID) {
  await share(maker, patternId)
  await maker.as.mutation(api.homebrew.setShared, { patternId, shared: true })
}

async function shownIds(t: Ctx, chassisRef?: string) {
  return (await t.query(api.homebrew.patterns, chassisRef ? { chassisRef } : {})).map(
    (row) => row.appId
  )
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

describe('what is homebrew', () => {
  test('every pattern shared on the Reference, newest share first, credited, with no account', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'Rosa')
    await savePattern(maker)
    await savePattern(maker, { id: 'pat-two', name: 'Two', chassisRef: 'mule' })
    await list(maker)
    await list(maker, 'pat-two')

    const rows = await t.query(api.homebrew.patterns, {})
    expect(rows.map((r) => [r.appId, r.madeBy])).toEqual([
      ['pat-two', 'Rosa'],
      [PATTERN_ID, 'Rosa'],
    ])
    expect(await shownIds(t, 'scrapper')).toEqual([PATTERN_ID])
    expect(await t.query(api.homebrew.status, { appId: PATTERN_ID })).toMatchObject({
      listed: true,
      hidden: false,
    })
  })

  test('the link alone is not homebrew; the Reference needs the link; withdrawing the link takes it off', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'Rosa')
    const stranger = await makeUser(t, 'Ash')
    await savePattern(maker)
    const setShared = (who: User, shared: boolean) =>
      who.as.mutation(api.homebrew.setShared, { patternId: PATTERN_ID, shared })
    await expect(setShared(maker, true)).rejects.toThrow(/link first/)

    await share(maker)
    expect(await shownIds(t)).toEqual([])
    await expect(setShared(stranger, true)).rejects.toThrow(/no longer exists/)
    await setShared(maker, true)
    expect(await shownIds(t)).toEqual([PATTERN_ID])
    const sharing = async () =>
      (await maker.as.query(api.shelf.patternSharing, {})).map((row) => row.homebrew)
    expect(await sharing()).toEqual([true])
    await setShared(maker, false)
    expect(await shownIds(t)).toEqual([])
    await setShared(maker, true)

    await maker.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'private',
    })
    expect(await shownIds(t)).toEqual([])
    expect(await sharing()).toEqual([false])
    expect(await t.query(api.homebrew.status, { appId: PATTERN_ID })).toMatchObject({
      listed: false,
    })
    // Sharing the link again does not put it back on the Reference.
    await share(maker)
    expect(await shownIds(t)).toEqual([])
  })
})

describe('reports and takedown', () => {
  async function sharedTable() {
    const t = testConvex()
    const maker = await makeUser(t, 'Rosa')
    const reader = await makeUser(t, 'Reader')
    const admin = await makeUser(t, 'Admin', ADMIN_DISCORD)
    await savePattern(maker)
    await list(maker)
    return { t, maker, reader, admin }
  }

  test('a signed-in reader reports once; the admin reads the reasons', async () => {
    const { t, maker, reader, admin } = await sharedTable()
    const target = { appId: PATTERN_ID }

    await expect(t.mutation(api.homebrew.report, { ...target, reason: 'spam' })).rejects.toThrow()
    await expect(
      maker.as.mutation(api.homebrew.report, { ...target, reason: 'mine' })
    ).rejects.toThrow(/your own/)
    await expect(
      reader.as.mutation(api.homebrew.report, { ...target, reason: '  ' })
    ).rejects.toThrow(/wrong with it/)
    await reader.as.mutation(api.homebrew.report, { ...target, reason: 'Copied text' })
    await reader.as.mutation(api.homebrew.report, { ...target, reason: 'Copied book text' })

    expect(await reader.as.query(api.homebrew.status, target)).toMatchObject({ reported: true })
    expect(await reader.as.query(api.homebrew.moderation, {})).toBeNull()
    const queue = await admin.as.query(api.homebrew.moderation, {})
    expect(queue?.reported).toEqual([
      {
        appId: PATTERN_ID,
        name: 'Tow Rig',
        madeBy: 'Rosa',
        reportCount: 1,
        reasons: ['Copied book text'],
        hiddenAt: null,
      },
    ])

    await admin.as.mutation(api.homebrew.dismissReports, target)
    expect((await admin.as.query(api.homebrew.moderation, {}))?.reported).toEqual([])
  })

  test('only an admin hides; hidden, it leaves the SRD and sharing again does not undo it', async () => {
    const { t, maker, reader, admin } = await sharedTable()
    const target = { appId: PATTERN_ID }

    await expect(
      reader.as.mutation(api.homebrew.setHidden, { ...target, hidden: true })
    ).rejects.toThrow(/Admins only/)
    await reader.as.mutation(api.homebrew.report, { ...target, reason: 'spam' })
    await admin.as.mutation(api.homebrew.setHidden, { ...target, hidden: true })

    expect(await shownIds(t)).toEqual([])
    expect(await maker.as.query(api.homebrew.status, target)).toMatchObject({
      listed: false,
      hidden: true,
    })
    // A stranger is not told it was taken down.
    expect(await t.query(api.homebrew.status, target)).toMatchObject({ hidden: false })
    // Hiding settled the report.
    const queue = await admin.as.query(api.homebrew.moderation, {})
    expect(queue?.reported).toEqual([])
    expect(queue?.hidden.map((row) => row.appId)).toEqual([PATTERN_ID])

    await share(maker, PATTERN_ID, 'private' as 'link')
    await list(maker)
    expect(await shownIds(t)).toEqual([])

    await admin.as.mutation(api.homebrew.setHidden, { ...target, hidden: false })
    expect(await shownIds(t)).toEqual([PATTERN_ID])
  })

  test('with no admin configured, nobody is one', async () => {
    const { admin } = await sharedTable()
    delete process.env.ADMIN_DISCORD_IDS
    expect(await admin.as.query(api.homebrew.moderation, {})).toBeNull()
    await expect(
      admin.as.mutation(api.homebrew.setHidden, { appId: PATTERN_ID, hidden: true })
    ).rejects.toThrow(/Admins only/)
  })

  test('a deleted pattern takes its reports with it; a deleted account takes its reports', async () => {
    const { t, maker, reader, admin } = await sharedTable()
    await reader.as.mutation(api.homebrew.report, { appId: PATTERN_ID, reason: 'spam' })
    expect((await reader.as.query(api.account.exportMine, {})).homebrewReports).toHaveLength(1)

    await reader.as.mutation(api.account.deleteAccount, {})
    expect((await admin.as.query(api.homebrew.moderation, {}))?.reported).toEqual([])

    const other = await makeUser(t, 'Other')
    await other.as.mutation(api.homebrew.report, { appId: PATTERN_ID, reason: 'spam' })
    await maker.as.mutation(api.shelf.removeMechPattern, { patternId: PATTERN_ID })
    const left = await t.run(async (ctx) => ({
      reports: (await ctx.db.query('homebrewReports').collect()).length,
      moderation: (await ctx.db.query('homebrewModeration').collect()).length,
    }))
    expect(left).toEqual({ reports: 0, moderation: 0 })
  })
})
