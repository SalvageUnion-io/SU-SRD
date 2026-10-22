import { describe, expect, test } from 'bun:test'
import { api } from '../../../convex/_generated/api'
import { FIXTURE_NOW } from '../../../src/components/__tests__/fixtures'
import type { User } from '../fixtures'
import { makeUser, mechBody, seedTable } from '../fixtures'
import { testConvex } from '../harness'

/**
 * Shared mech patterns: a pattern stays its maker's, and the maker
 * chooses who reads it — only them, anyone with the link (ADR-032's
 * `publicRead`), or one Game's crew. Whatever a reader may not read is the same
 * `null` as a pattern that does not exist.
 */

const PATTERN_ID = 'pat-tow-rig'

function patternBody(over: Record<string, unknown> = {}) {
  return {
    id: PATTERN_ID,
    schemaVersion: 1,
    name: 'Tow Rig',
    chassisRef: 'scrapper',
    systems: ['rigging-arm', 'transport-hold'],
    modules: ['comms-module'],
    cargoLots: [],
    notes: 'Hauls wrecks back to the crawler.',
    createdAt: FIXTURE_NOW,
    ...over,
  }
}

async function savePattern(user: User, over: Record<string, unknown> = {}) {
  await user.as.mutation(api.shelf.upsertMechPattern, { body: patternBody(over) })
}

describe('a pattern is its maker’s alone until they share it', () => {
  test('nobody else reads a private pattern, signed in or not', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'alxjrvs')
    const stranger = await makeUser(t, 'Stranger')
    await savePattern(maker)

    expect(await t.query(api.publicSheet.pattern, { appId: PATTERN_ID })).toBeNull()
    expect(await stranger.as.query(api.publicSheet.pattern, { appId: PATTERN_ID })).toBeNull()
    // A private pattern and a missing one are the same answer.
    expect(await t.query(api.publicSheet.pattern, { appId: 'nope' })).toBeNull()
  })

  test('its maker reads it, credited, and is told who else can', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'alxjrvs')
    await savePattern(maker)

    const answer = await maker.as.query(api.publicSheet.pattern, { appId: PATTERN_ID })
    expect(answer).toMatchObject({
      madeBy: 'alxjrvs',
      mine: true,
      visibility: 'private',
      builtCount: 0,
      sharedAt: null,
    })
  })
})

describe('anyone with the link', () => {
  test('reads it with no account, and is not told its visibility', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'alxjrvs')
    await savePattern(maker)
    await maker.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'link',
    })

    const answer = await t.query(api.publicSheet.pattern, { appId: PATTERN_ID })
    expect(answer).toMatchObject({ madeBy: 'alxjrvs', mine: false, visibility: null })
    expect(answer?.body).toMatchObject({ name: 'Tow Rig' })
    expect(answer?.sharedAt).toBeNumber()
  })

  test('going back to Only me revokes it everywhere at once', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'alxjrvs')
    await savePattern(maker)
    await maker.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'link',
    })
    await maker.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'private',
    })

    expect(await t.query(api.publicSheet.pattern, { appId: PATTERN_ID })).toBeNull()
  })

  test('only its maker may share it', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'alxjrvs')
    const stranger = await makeUser(t, 'Stranger')
    await savePattern(maker)

    await expect(
      stranger.as.mutation(api.shelf.setPatternVisibility, {
        patternId: PATTERN_ID,
        visibility: 'link',
      })
    ).rejects.toThrow(/no longer exists/i)
    expect(await t.query(api.publicSheet.pattern, { appId: PATTERN_ID })).toBeNull()
  })
})

describe('my Game’s crew', () => {
  test('every member of that Game reads it, and nobody outside it', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    const outsider = await makeUser(t, 'Outsider')
    await savePattern(player)
    await player.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'game',
      gameId,
    })

    expect(await organizer.as.query(api.publicSheet.pattern, { appId: PATTERN_ID })).toMatchObject({
      madeBy: 'Player',
      mine: false,
    })
    expect(await outsider.as.query(api.publicSheet.pattern, { appId: PATTERN_ID })).toBeNull()
    expect(await t.query(api.publicSheet.pattern, { appId: PATTERN_ID })).toBeNull()

    // And it is listed for the crew, never for its maker (it is on their shelf).
    const forCrew = await organizer.as.query(api.shelf.crewPatterns, {})
    expect(forCrew).toEqual([
      expect.objectContaining({ appId: PATTERN_ID, madeBy: 'Player', gameName: 'Tenacity' }),
    ])
    expect(await player.as.query(api.shelf.crewPatterns, {})).toEqual([])
    expect(await t.query(api.shelf.crewPatterns, {})).toEqual([])
  })

  test('the maker can share only with a crew they are in', async () => {
    const t = testConvex()
    const { gameId } = await seedTable(t)
    const outsider = await makeUser(t, 'Outsider')
    await savePattern(outsider)

    await expect(
      outsider.as.mutation(api.shelf.setPatternVisibility, {
        patternId: PATTERN_ID,
        visibility: 'game',
        gameId,
      })
    ).rejects.toThrow(/not a member/i)
  })

  test('destroying the Game falls the pattern back to Only me', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await savePattern(player)
    await player.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'game',
      gameId,
    })

    await organizer.as.mutation(api.games.destroy, { gameId })

    expect(await player.as.query(api.publicSheet.pattern, { appId: PATTERN_ID })).toMatchObject({
      visibility: 'private',
    })
  })
})

describe('mechs built from it are counted', () => {
  test('a mech that names it as its source counts once, on its create', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'alxjrvs')
    const builder = await makeUser(t, 'Builder')
    await savePattern(maker)
    await maker.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'link',
    })

    const write = {
      table: 'mechs' as const,
      appId: 'm-built',
      gameId: null,
      body: mechBody({ id: 'm-built', chassisRef: 'scrapper', sourcePattern: PATTERN_ID }),
    }
    const { updatedAt } = await builder.as.mutation(api.entities.upsertByAppId, {
      ...write,
      expectedUpdatedAt: null,
    })
    // An edit to the same mech is not another build.
    await builder.as.mutation(api.entities.upsertByAppId, {
      ...write,
      expectedUpdatedAt: updatedAt,
    })

    const answer = await t.query(api.publicSheet.pattern, { appId: PATTERN_ID })
    expect(answer?.builtCount).toBe(1)
  })

  test('naming a pattern the builder cannot read counts nothing', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'alxjrvs')
    const builder = await makeUser(t, 'Builder')
    await savePattern(maker)

    await builder.as.mutation(api.entities.upsertByAppId, {
      table: 'mechs',
      appId: 'm-forged',
      gameId: null,
      body: mechBody({ id: 'm-forged', sourcePattern: PATTERN_ID }),
      expectedUpdatedAt: null,
    })

    const answer = await maker.as.query(api.publicSheet.pattern, { appId: PATTERN_ID })
    expect(answer?.builtCount).toBe(0)
  })
})

describe('the maker’s shelf reads who can see each pattern', () => {
  test('one row per pattern of theirs: its visibility, its crew and its build count', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await savePattern(player)
    await savePattern(player, { id: 'pat-quiet-hours', name: 'Quiet Hours' })
    await player.as.mutation(api.shelf.setPatternVisibility, {
      patternId: PATTERN_ID,
      visibility: 'game',
      gameId,
    })

    const facts = await player.as.query(api.shelf.patternSharing, {})
    expect(facts).toHaveLength(2)
    expect(facts).toEqual(
      expect.arrayContaining([
        {
          appId: PATTERN_ID,
          visibility: 'game',
          gameId,
          gameName: 'Tenacity',
          builtCount: 0,
          homebrew: false,
        },
        {
          appId: 'pat-quiet-hours',
          visibility: 'private',
          gameId: null,
          gameName: null,
          builtCount: 0,
          homebrew: false,
        },
      ])
    )
    // Nobody else's, and nothing signed out.
    expect(await organizer.as.query(api.shelf.patternSharing, {})).toEqual([])
    expect(await t.query(api.shelf.patternSharing, {})).toEqual([])
  })
})

describe('a shared pattern answers its short link', () => {
  const UUID_ID = '0a1b2c3d-4e5f-4789-abcd-ef0123456789'

  test('the name-and-short-id link and the old full-id link both reach it', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'alxjrvs')
    await savePattern(maker, { id: UUID_ID })
    await maker.as.mutation(api.shelf.setPatternVisibility, {
      patternId: UUID_ID,
      visibility: 'link',
    })

    for (const appId of ['tow-rig-0a1b2c3d4e5f', '0a1b2c3d4e5f', UUID_ID]) {
      expect(await t.query(api.publicSheet.pattern, { appId })).toMatchObject({ appId: UUID_ID })
      expect(await t.query(api.publicSheet.preview, { kind: 'pattern', appId })).toMatchObject({
        kind: 'pattern',
      })
    }
    // A short id of nobody's pattern is the same null as any other miss.
    expect(await t.query(api.publicSheet.pattern, { appId: 'tow-rig-ffffffffffff' })).toBeNull()
  })

  test('a private pattern is not reachable by its short link either', async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'alxjrvs')
    await savePattern(maker, { id: UUID_ID })

    expect(await t.query(api.publicSheet.pattern, { appId: '0a1b2c3d4e5f' })).toBeNull()
  })
})
