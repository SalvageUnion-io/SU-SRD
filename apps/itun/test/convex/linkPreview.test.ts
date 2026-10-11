import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { FIXTURE_NOW } from '../../src/components/__tests__/fixtures'
import type { Ctx } from './fixtures'
import { addPilot, makeUser, seedTable } from './fixtures'
import { testConvex } from './harness'

/**
 * Link previews (issue 1280): `publicSheet.preview` and `invitePreview` say
 * what an unfurl may show a STRANGER, and nothing more. A thing not shared by
 * link is the same `null` as a missing one, whoever asks.
 */

const PATTERN_ID = 'pat-tow-rig'

function patternBody() {
  return {
    id: PATTERN_ID,
    schemaVersion: 1,
    name: 'Tow Rig',
    chassisRef: 'scrapper',
    systems: [],
    modules: [],
    cargoLots: [],
    createdAt: FIXTURE_NOW,
  }
}

describe('publicSheet.preview', () => {
  test('a private sheet previews as nothing, even to its owner', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await addPilot(player, 'p-bonesaw', gameId)

    expect(await t.query(api.publicSheet.preview, { kind: 'pilot', appId: 'p-bonesaw' })).toBeNull()
    expect(
      await player.as.query(api.publicSheet.preview, { kind: 'pilot', appId: 'p-bonesaw' })
    ).toBeNull()
    expect(await t.query(api.publicSheet.preview, { kind: 'pilot', appId: 'nope' })).toBeNull()
  })

  test('a shared sheet names its player and its Game', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await addPilot(player, 'p-bonesaw', gameId)
    await player.as.mutation(api.publicSheet.setPublic, {
      kind: 'pilot',
      appId: 'p-bonesaw',
      isPublic: true,
    })

    const answer = await t.query(api.publicSheet.preview, { kind: 'pilot', appId: 'p-bonesaw' })
    expect(answer).toMatchObject({ kind: 'pilot', ownerName: 'Player', gameName: 'Tenacity' })
    expect(answer?.body).toMatchObject({ callsign: 'p-bonesaw' })
  })

  test('a pattern previews only when shared by link, never to its crew', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await organizer.as.mutation(api.shelf.upsertMechPattern, { body: patternBody() })
    await organizer.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'game',
      gameId,
    })
    // The crew may read the page; an unfurl is posted where strangers read it.
    expect(
      await player.as.query(api.publicSheet.preview, { kind: 'pattern', appId: PATTERN_ID })
    ).toBeNull()

    await organizer.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'link',
    })
    expect(
      await t.query(api.publicSheet.preview, { kind: 'pattern', appId: PATTERN_ID })
    ).toMatchObject({ kind: 'pattern', ownerName: 'Organizer', gameName: null })
  })
})

/** Where a row sits: a Game, or one user's shelf. */
type Container = { gameId: Id<'games'> | null; ownerId: Id<'users'> }

/**
 * A published pilot and, optionally, a mech assigned to it, written as rows so
 * a test can place the mech in another container (a stale or forged link that
 * the client's own write path would refuse).
 */
async function seedPilotAndMech(
  t: Ctx,
  pilot: Container,
  mech?: Container & { publicRead: boolean }
) {
  await t.run(async (ctx) => {
    await ctx.db.insert('pilots', {
      gameId: pilot.gameId,
      ownerId: pilot.ownerId,
      appId: 'p-vex',
      publicRead: true,
      body: { callsign: 'Vex', classRef: 'engineer' },
      updatedAt: Date.now(),
    })
    if (mech === undefined) return
    await ctx.db.insert('mechs', {
      gameId: mech.gameId,
      ownerId: mech.ownerId,
      appId: 'm-rustjaw',
      publicRead: mech.publicRead,
      body: { name: 'Rustjaw', chassisRef: 'mule' },
      updatedAt: Date.now(),
    })
    await ctx.db.insert('softLinks', {
      gameId: pilot.gameId,
      from: { type: 'mech', id: 'm-rustjaw' },
      to: { type: 'pilot', id: 'p-vex' },
      type: 'mech-to-pilot',
    })
  })
}

async function mechOfPilot(t: Ctx) {
  const answer = await t.query(api.publicSheet.preview, { kind: 'pilot', appId: 'p-vex' })
  expect(answer).not.toBeNull()
  return answer?.mechChassisRef
}

describe("publicSheet.preview names a pilot's mech only when the page would", () => {
  test('a published mech in the same container gives its chassis', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    const shelf = { gameId: null, ownerId: owner.userId }
    await seedPilotAndMech(t, shelf, { ...shelf, publicRead: true })
    expect(await mechOfPilot(t)).toBe('mule')
  })

  test('a private mech is not named', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    const shelf = { gameId: null, ownerId: owner.userId }
    await seedPilotAndMech(t, shelf, { ...shelf, publicRead: false })
    expect(await mechOfPilot(t)).toBeNull()
  })

  test('a published mech in another Game is not named', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    const here = await owner.as.mutation(api.games.create, { name: 'Tenacity' })
    const there = await owner.as.mutation(api.games.create, { name: 'Elsewhere' })
    await seedPilotAndMech(
      t,
      { gameId: here, ownerId: owner.userId },
      { gameId: there, ownerId: owner.userId, publicRead: true }
    )
    expect(await mechOfPilot(t)).toBeNull()
  })

  test("a published mech on another player's shelf is not named", async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    const stranger = await makeUser(t, 'Stranger')
    await seedPilotAndMech(
      t,
      { gameId: null, ownerId: owner.userId },
      { gameId: null, ownerId: stranger.userId, publicRead: true }
    )
    expect(await mechOfPilot(t)).toBeNull()
  })

  test('a pilot with no mech names none', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    await seedPilotAndMech(t, { gameId: null, ownerId: owner.userId })
    expect(await mechOfPilot(t)).toBeNull()
  })
})

describe('publicSheet.invitePreview', () => {
  test('names the Game and its Mediator, never the code', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedTable(t)
    const mediator = await makeUser(t, 'alxjrvs')
    await t.run(async (ctx) => {
      await ctx.db.insert('memberships', {
        gameId,
        userId: mediator.userId,
        mediator: true,
        organizer: false,
        joinedAt: Date.now(),
      })
    })
    const code = await organizer.as.mutation(api.invites.create, { gameId })

    const answer = await t.query(api.publicSheet.invitePreview, { code })
    expect(answer).toMatchObject({ gameName: 'Tenacity', mediatedBy: 'alxjrvs', role: 'player' })
    expect(JSON.stringify(answer)).not.toContain(code)
  })

  test('a dead code previews as nothing', async () => {
    const t = testConvex()
    expect(await t.query(api.publicSheet.invitePreview, { code: 'NOPE1234' })).toBeNull()
    expect(await t.query(api.publicSheet.invitePreview, { code: '  ' })).toBeNull()
  })
})
