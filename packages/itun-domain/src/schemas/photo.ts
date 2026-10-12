import { assetUrl } from 'salvageunion-reference'
import { z } from 'salvageunion-reference/zod'

/**
 * A player entity's own picture — the `photo` field every entity a player
 * builds carries (pilot, mech, mech pattern, crawler, built NPC).
 *
 * A photo REPLACES the entity's default art where it has one (a mech's
 * chassis, a pattern's chassis, a built NPC's template) and makes room for a
 * picture where it has none. Removing it removes the field; the server then
 * deletes the file once no entity still points at it (`convex/photos.ts`).
 *
 * Two kinds, because two things put a picture on an entity:
 *
 *   - `upload` — the player's own image, in Convex file storage. `url` is the
 *     storage URL the server handed back when the upload was claimed; it stays
 *     valid until the file is deleted, so every reader (the sheet, a crewmate's
 *     view, the public sheet) renders it without a query. The server checks it
 *     against `storageId` on every write, so a body cannot point an `<img>`
 *     anywhere else.
 *   - `asset` — licensed artwork on the CDN, by object key. The Starter Set
 *     crew carry their portraits this way, and a copy keeps it.
 *
 * Additive-optional on every schema that takes it: records written before it
 * still validate (no version bump / migration).
 */
export const PhotoSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('upload'),
      /** The Convex `_storage` id of the file. */
      storageId: z.string().min(1),
      /** Its serving URL, as `ctx.storage.getUrl` returned it. */
      url: z.string().url(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('asset'),
      /** An artwork CDN object key, e.g. `starter-set/pilots/bonesaw.webp`. */
      path: z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)*\.webp$/),
    })
    .strict(),
])

export type Photo = z.infer<typeof PhotoSchema>

/** The `photo` field, spread into each schema that carries one. */
export const photoFields = {
  photo: PhotoSchema.optional(),
}

/** Where a photo is served from. */
export function photoUrl(photo: Photo): string {
  return photo.kind === 'upload' ? photo.url : assetUrl(photo.path)
}

/** The storage id a body's photo holds, if it is an upload — what the server counts references by. */
export function uploadedPhotoId(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('photo' in body)) return undefined
  const parsed = PhotoSchema.safeParse(body.photo)
  return parsed.success && parsed.data.kind === 'upload' ? parsed.data.storageId : undefined
}
