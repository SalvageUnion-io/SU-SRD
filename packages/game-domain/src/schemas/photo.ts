import { assetUrl } from 'salvageunion-reference'
import { z } from 'salvageunion-reference/zod'

/**
 * A player entity's own picture — the `photo` field every entity a player
 * builds carries (pilot, mech, mech pattern, crawler, built NPC).
 *
 * A photo REPLACES the entity's default art where it has one (a mech's
 * chassis, a pattern's chassis, a built NPC's template) and makes room for a
 * picture where it has none. Removing it removes the field; the file stays
 * in R2 (`worker/photos.ts`).
 *
 * Two kinds, because two things put a picture on an entity:
 *
 *   - `upload` — the player's own image, in R2. `url` is the
 *     address the Worker handed back for the upload; a key is never reused, so every reader (the sheet, a crewmate's
 *     view, the public sheet) renders it without a query. No room checks it
 *     against `storageId` on a write yet.
 *   - `asset` — licensed artwork on the CDN, by object key. The Starter Set
 *     crew carry their portraits this way, and a copy keeps it.
 *
 * Optional on every schema that takes it (`photoFields`): absent reads as no
 * photo.
 */
export const PhotoSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('upload'),
      /** The file's key (a copied Convex `_storage` id on older photos). */
      storageId: z.string().min(1),
      /** Its serving URL, as the upload answered it. */
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
