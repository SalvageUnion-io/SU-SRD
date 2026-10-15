import { describe, expect, test } from 'bun:test'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { npcFixture } from '../../../src/cantina/components/__tests__/fixtures'
import type { User } from '../fixtures'
import { addPilot, makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * A built NPC shares exactly as a pilot does (ADR-032, ADR-044): private until
 * its owner sets "Anyone with the link", then readable with no account at
 * `/p/npc/:appId`, credited to its maker, and previewed by an unfurl. Only its
 * owner may change it, and a private NPC reads as nothing at all.
 */

async function addNpc(user: User, id: string, gameId: Id<'games'> | null = null) {
  await user.as.mutation(api.entities.upsertByAppId, {
    table: 'npcs',
    appId: id,
    gameId,
    body: { ...npcFixture({ id, name: 'Old Mags' }), position: 'Medic', gameId },
    expectedUpdatedAt: null,
  })
}

describe('a built NPC is private until its owner shares it by link', () => {
  test('a private NPC reads as nothing, signed out', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Rosa')
    await addNpc(owner, 'npc-1')

    expect(await t.query(api.publicSheet.get, { kind: 'npc', appId: 'npc-1' })).toBeNull()
    expect(await t.query(api.publicSheet.preview, { kind: 'npc', appId: 'npc-1' })).toBeNull()
  })

  test('shared by link, it is readable with no account and credits its maker', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Rosa')
    await addNpc(owner, 'npc-1')

    await owner.as.mutation(api.publicSheet.setPublic, {
      kind: 'npc',
      appId: 'npc-1',
      isPublic: true,
    })

    const page = await t.query(api.publicSheet.get, { kind: 'npc', appId: 'npc-1' })
    expect(page).toMatchObject({ kind: 'npc', madeBy: 'Rosa' })
    expect((page?.body as { name?: string } | undefined)?.name).toBe('Old Mags')

    const preview = await t.query(api.publicSheet.preview, { kind: 'npc', appId: 'npc-1' })
    expect(preview).toMatchObject({ kind: 'npc', ownerName: 'Rosa', gameName: null })
  })

  test('going back to Only me revokes the link at once', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Rosa')
    await addNpc(owner, 'npc-1')

    await owner.as.mutation(api.publicSheet.setPublic, {
      kind: 'npc',
      appId: 'npc-1',
      isPublic: true,
    })
    await owner.as.mutation(api.publicSheet.setPublic, {
      kind: 'npc',
      appId: 'npc-1',
      isPublic: false,
    })

    expect(await t.query(api.publicSheet.get, { kind: 'npc', appId: 'npc-1' })).toBeNull()
  })

  test('nobody but its owner may share it', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Rosa')
    const stranger = await makeUser(t, 'Stranger')
    await addNpc(owner, 'npc-1')

    await expect(
      stranger.as.mutation(api.publicSheet.setPublic, {
        kind: 'npc',
        appId: 'npc-1',
        isPublic: true,
      })
    ).rejects.toThrow()
    expect(await t.query(api.publicSheet.get, { kind: 'npc', appId: 'npc-1' })).toBeNull()
  })
})

describe('shelf.sharedByLink', () => {
  test('lists the caller’s own sheets anyone with the link may read, and nothing else', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Rosa')
    const other = await makeUser(t, 'Other')
    await addNpc(owner, 'npc-1')
    await addNpc(owner, 'npc-2')
    await addPilot(owner, 'pilot-1', null)

    await owner.as.mutation(api.publicSheet.setPublic, {
      kind: 'npc',
      appId: 'npc-1',
      isPublic: true,
    })
    await owner.as.mutation(api.publicSheet.setPublic, {
      kind: 'pilot',
      appId: 'pilot-1',
      isPublic: true,
    })

    const shared = await owner.as.query(api.shelf.sharedByLink, {})
    expect([...shared].sort()).toEqual(['npc-1', 'pilot-1'])
    // Nobody else's, and nothing signed out.
    expect(await other.as.query(api.shelf.sharedByLink, {})).toEqual([])
    expect(await t.query(api.shelf.sharedByLink, {})).toEqual([])
  })
})
