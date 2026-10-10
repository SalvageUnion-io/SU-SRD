import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { FIXTURE_NOW } from '../../src/components/__tests__/fixtures'
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
