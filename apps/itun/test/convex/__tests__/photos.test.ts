import { describe, expect, test } from 'bun:test'
import { ConvexError } from 'convex/values'
import { api, internal } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { UNUSED_PHOTO_TTL_MS } from '../../../convex/model/photos'
import type { Ctx, User } from '../fixtures'
import { makeUser, pilotBody } from '../fixtures'
import { testConvex } from '../harness'

/**
 * Entity photos (`convex/photos.ts`, `convex/model/photos.ts`).
 *
 * A file is claimed, then held from inside entity bodies; the entity triggers
 * count its holders on every write and delete, and the last one letting go —
 * a removed photo, a replaced one, a deleted entity — deletes the file. A
 * copy that shares the file keeps it until it lets go too.
 */

const PNG = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })

/**
 * A file as an upload leaves it. A real upload POST records its Content-Type
 * on the `_storage` row; convex-test's `store` does not, so it is set here.
 */
async function upload(t: Ctx, blob: Blob = PNG): Promise<Id<'_storage'>> {
  return await t.run(async (ctx) => {
    const id = await ctx.storage.store(blob)
    await ctx.db.patch(id as never, { contentType: blob.type } as never)
    return id
  })
}

async function claimed(t: Ctx, user: User) {
  const photo = await user.as.mutation(api.photos.claim, { storageId: await upload(t) })
  if (photo === null) throw new Error('the fixture PNG was refused')
  return photo
}

async function writePilot(user: User, id: string, photo?: unknown) {
  await user.as.mutation(api.entities.upsertByAppId, {
    table: 'pilots',
    appId: id,
    gameId: null,
    body: pilotBody({ id, gameId: null, ...(photo === undefined ? {} : { photo }) }),
    expectedUpdatedAt: null,
  })
}

async function fileExists(t: Ctx, storageId: string) {
  return await t.run(
    async (ctx) => (await ctx.storage.getUrl(storageId as Id<'_storage'>)) !== null
  )
}

async function refsOf(t: Ctx, storageId: string) {
  return await t.run(async (ctx) => {
    const row = await ctx.db
      .query('photos')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId as Id<'_storage'>))
      .unique()
    return row?.refs ?? null
  })
}

describe('claim', () => {
  test('returns the photo a body stores, and records the file with no holders', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Maker')
    const photo = await claimed(t, user)
    expect(photo.kind).toBe('upload')
    expect(photo.url).toStartWith('http')
    expect(await refsOf(t, photo.storageId)).toBe(0)
  })

  test('refuses and deletes a file that is not an accepted image', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Maker')
    const storageId = await upload(t, new Blob(['hello'], { type: 'text/plain' }))
    expect(await user.as.mutation(api.photos.claim, { storageId })).toBeNull()
    expect(await fileExists(t, storageId)).toBe(false)
  })

  test("refuses someone else's file", async () => {
    const t = testConvex()
    const maker = await makeUser(t, 'Maker')
    const other = await makeUser(t, 'Other')
    const photo = await claimed(t, maker)
    await expect(
      other.as.mutation(api.photos.claim, { storageId: photo.storageId as Id<'_storage'> })
    ).rejects.toBeInstanceOf(ConvexError)
  })
})

describe('holding a photo', () => {
  test('a body holding it counts once, however often it is written', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Maker')
    const photo = await claimed(t, user)
    await writePilot(user, 'p1', photo)
    await writePilot(user, 'p1', photo)
    expect(await refsOf(t, photo.storageId)).toBe(1)
  })

  test('removing the photo deletes the file', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Maker')
    const photo = await claimed(t, user)
    await writePilot(user, 'p1', photo)
    await writePilot(user, 'p1')
    expect(await fileExists(t, photo.storageId)).toBe(false)
    expect(await refsOf(t, photo.storageId)).toBeNull()
  })

  test('replacing the photo deletes the old file and holds the new one', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Maker')
    const first = await claimed(t, user)
    const second = await claimed(t, user)
    await writePilot(user, 'p1', first)
    await writePilot(user, 'p1', second)
    expect(await fileExists(t, first.storageId)).toBe(false)
    expect(await refsOf(t, second.storageId)).toBe(1)
  })

  test('deleting the entity deletes its photo', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Maker')
    const photo = await claimed(t, user)
    await writePilot(user, 'p1', photo)
    await user.as.mutation(api.entities.removeByAppId, { table: 'pilots', appId: 'p1' })
    expect(await fileExists(t, photo.storageId)).toBe(false)
  })

  test('a copy sharing the file keeps it until the last holder lets go', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Maker')
    const photo = await claimed(t, user)
    await writePilot(user, 'p1', photo)
    await writePilot(user, 'p2', photo)
    expect(await refsOf(t, photo.storageId)).toBe(2)

    await user.as.mutation(api.entities.removeByAppId, { table: 'pilots', appId: 'p1' })
    expect(await fileExists(t, photo.storageId)).toBe(true)
    await user.as.mutation(api.entities.removeByAppId, { table: 'pilots', appId: 'p2' })
    expect(await fileExists(t, photo.storageId)).toBe(false)
  })

  test('refuses a body naming an unclaimed file', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Maker')
    const storageId = await upload(t)
    const url = await t.run(async (ctx) => await ctx.storage.getUrl(storageId))
    await expect(writePilot(user, 'p1', { kind: 'upload', storageId, url })).rejects.toThrow()
  })

  test('refuses a body pointing the photo at another url', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Maker')
    const photo = await claimed(t, user)
    await expect(
      writePilot(user, 'p1', { ...photo, url: 'https://example.com/elsewhere.webp' })
    ).rejects.toThrow()
    expect(await refsOf(t, photo.storageId)).toBe(0)
  })

  test('an artwork photo is no file and counts nothing', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Maker')
    await writePilot(user, 'p1', { kind: 'asset', path: 'starter-set/pilots/bonesaw.webp' })
    const rows = await t.run(async (ctx) => await ctx.db.query('photos').collect())
    expect(rows).toHaveLength(0)
  })
})

describe('sweep', () => {
  test('deletes a claimed file no entity took up once it is a day old, and nothing younger', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Maker')
    const stale = await claimed(t, user)
    const held = await claimed(t, user)
    await writePilot(user, 'p1', held)
    await t.run(async (ctx) => {
      for (const id of [stale.storageId, held.storageId]) {
        const row = await ctx.db
          .query('photos')
          .withIndex('by_storage', (q) => q.eq('storageId', id as Id<'_storage'>))
          .unique()
        if (row) await ctx.db.patch(row._id, { claimedAt: row.claimedAt - UNUSED_PHOTO_TTL_MS - 1 })
      }
    })
    const fresh = await claimed(t, user)

    await t.mutation(internal.photos.sweep, {})
    expect(await fileExists(t, stale.storageId)).toBe(false)
    expect(await fileExists(t, held.storageId)).toBe(true)
    expect(await fileExists(t, fresh.storageId)).toBe(true)
  })
})
