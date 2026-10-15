import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation } from './model/entities'
import { NotAuthorized, requireUser } from './model/permissions'
import { photoRow, sweepUnusedPhotos } from './model/photos'

/**
 * Entity photos in Convex file storage — the `upload` kind of `PhotoSchema`
 * (`cantina-domain/schemas/photo`).
 *
 * The client uploads in three steps: `generateUploadUrl`, a POST of the file to
 * that URL, then `claim`, which checks the file and returns the photo the
 * entity body stores. Nothing here writes an entity: the body change goes
 * through the entity's own store write like any other field, and the triggers
 * in `model/entities.ts` count the file's holders from there (`model/photos.ts`).
 * Removing a photo is the same — drop the field, and the last holder letting go
 * deletes the file.
 */

/** The image types the upload accepts. The client re-encodes to WebP (or JPEG where the browser cannot). */
export const PHOTO_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const

/** A photo's ceiling. The client scales to 1600px first, which lands far under it. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024

/** A short-lived URL to POST one photo file to. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireUser(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Take ownership of an uploaded file and return the photo an entity body
 * stores. A file that is not an accepted image, or is too large, is deleted and
 * answered with `null` — not a throw, because a throw would roll the delete
 * back with the rest of the mutation and leave the file behind.
 */
export const claim = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (
    ctx,
    args
  ): Promise<{ kind: 'upload'; storageId: string; url: string } | null> => {
    const userId = await requireUser(ctx)
    const existing = await photoRow(ctx, args.storageId)
    if (existing !== null && existing.ownerId !== userId) {
      throw new NotAuthorized('That photo belongs to someone else')
    }

    const file = await ctx.db.system.get('_storage', args.storageId)
    if (file === null) throw new ConvexError('That upload did not arrive. Try again.')
    const type = file.contentType ?? ''
    if (!(PHOTO_TYPES as readonly string[]).includes(type) || file.size > MAX_PHOTO_BYTES) {
      await ctx.storage.delete(args.storageId)
      return null
    }

    if (existing === null) {
      await ctx.db.insert('photos', {
        storageId: args.storageId,
        ownerId: userId,
        refs: 0,
        claimedAt: Date.now(),
      })
    }
    const url = await ctx.storage.getUrl(args.storageId)
    if (url === null) throw new Error('[photos] a claimed file has no url')
    return { kind: 'upload', storageId: args.storageId, url }
  },
})

/** Hourly: delete claimed files no entity took up (`crons.ts`). */
export const sweep = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => await sweepUnusedPhotos(ctx, Date.now()),
})
