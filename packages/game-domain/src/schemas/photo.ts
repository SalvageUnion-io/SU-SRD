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
 *   - `upload` — the player's own image, in R2 under `storageId`. Every
 *     reader (the sheet, a crewmate's view, the public sheet) renders it from
 *     the Worker by that key (`photoPath`), never from the stored `url`, so a
 *     `url` naming another host shows nothing from it. A photo uploaded before
 *     4.5 keeps its Convex `url`; its file was copied into R2 under its Convex
 *     `_storage` id.
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

/** Where the Worker uploads (`POST`) and serves (`GET <path>/<key>`) photos, from R2. */
export const PHOTOS_PATH = '/__photos'

/** A photo's address under `PHOTOS_PATH`. */
export function photoPath(key: string): string {
  return `${PHOTOS_PATH}/${encodeURIComponent(key)}`
}

/** Where a photo is served from: an upload by its key, whatever `url` it stored. */
export function photoUrl(photo: Photo): string {
  return photo.kind === 'upload' ? photoPath(photo.storageId) : assetUrl(photo.path)
}

/** The storage id a body's photo holds, if it is an upload — what the server counts references by. */
export function uploadedPhotoId(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('photo' in body)) return undefined
  const parsed = PhotoSchema.safeParse(body.photo)
  return parsed.success && parsed.data.kind === 'upload' ? parsed.data.storageId : undefined
}
