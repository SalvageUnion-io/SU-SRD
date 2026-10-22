import { uploadedPhotoId } from 'game-domain/schemas/photo'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

/**
 * Reference counting for entity photos (`photos` table, `../photos.ts`).
 *
 * A photo file is held from inside entity bodies, which Convex cannot index,
 * so the count lives on the file's `photos` row and moves with the entity
 * rows themselves: the triggers in `entities.ts` call `trackPhoto` on every
 * write and delete of a table that carries `body.photo`. That makes every path
 * that drops a photo — removing it, replacing it, deleting the entity, a
 * Game's teardown, an account's deletion — release the file the same way, and
 * a copy that shares a file (an imported bundle) keeps it alive until the last
 * holder lets go.
 */

/** The tables whose bodies may carry a photo. */
export const PHOTO_TABLES = ['pilots', 'mechs', 'crawlers', 'npcs', 'mechPatterns'] as const

/** The `photos` row of a storage id a body names, or null when it names none we know. */
export async function photoRow(ctx: MutationCtx, storageId: string): Promise<Doc<'photos'> | null> {
  const id = ctx.db.system.normalizeId('_storage', storageId)
  if (id === null) return null
  return await ctx.db
    .query('photos')
    .withIndex('by_storage', (q) => q.eq('storageId', id))
    .unique()
}

/** The `url` of a body's uploaded photo, if it has one. */
function uploadUrlOf(body: unknown): string | undefined {
  if (uploadedPhotoId(body) === undefined) return undefined
  return (body as { photo: { url: string } }).photo.url
}

/** Delete a photo's file and its row. */
async function deletePhoto(ctx: MutationCtx, row: Doc<'photos'>): Promise<void> {
  await ctx.storage.delete(row.storageId)
  await ctx.db.delete(row._id)
}

/**
 * Move the reference counts for one entity row's change from `oldBody` to
 * `newBody`. Throws — refusing the whole write — when the new body names an
 * upload that was never claimed, or a `url` other than the file's own.
 */
export async function trackPhoto(
  ctx: MutationCtx,
  oldBody: unknown,
  newBody: unknown
): Promise<void> {
  const before = uploadedPhotoId(oldBody)
  const after = uploadedPhotoId(newBody)

  // Most writes (an HP tick, a heat check) leave the photo as it was; only a
  // changed photo needs the reads below.
  if (after !== undefined && (after !== before || uploadUrlOf(newBody) !== uploadUrlOf(oldBody))) {
    const row = await photoRow(ctx, after)
    if (row === null) throw new Error('[photos] a body names an upload that was never claimed')
    const url = await ctx.storage.getUrl(row.storageId)
    if (url === null || uploadUrlOf(newBody) !== url) {
      throw new Error('[photos] a body names a photo url that is not its file')
    }
    if (after !== before) await ctx.db.patch(row._id, { refs: row.refs + 1 })
  }

  if (before !== undefined && before !== after) {
    const row = await photoRow(ctx, before)
    if (row === null) return
    if (row.refs <= 1) await deletePhoto(ctx, row)
    else await ctx.db.patch(row._id, { refs: row.refs - 1 })
  }
}

/** A claimed file nobody took up is kept this long before the sweep deletes it. */
export const UNUSED_PHOTO_TTL_MS = 24 * 60 * 60 * 1000

/** The sweep's per-run cap, so one run stays well inside a mutation's limits. */
const SWEEP_BATCH = 100

/**
 * Delete files claimed more than a day ago that no entity holds — an upload
 * whose entity write never landed, or whose photo was swapped before it did.
 */
export async function sweepUnusedPhotos(ctx: MutationCtx, now: number): Promise<number> {
  const cutoff = now - UNUSED_PHOTO_TTL_MS
  let deleted = 0

  const unused = await ctx.db
    .query('photos')
    .withIndex('by_refs_claimed', (q) => q.eq('refs', 0).lt('claimedAt', cutoff))
    .take(SWEEP_BATCH)
  for (const row of unused) {
    await deletePhoto(ctx, row)
    deleted++
  }

  return deleted
}
