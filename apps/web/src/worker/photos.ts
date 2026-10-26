/**
 * Entity photos in R2 (`PHOTOS`): the `upload` kind of `PhotoSchema`
 * (`game-domain/schemas/photo`).
 *
 *   - `POST /__photos` → a signed-in player's photo, its body the file. One
 *     the client prepared (`lib/photos/uploadPhoto.ts`) is a WebP or JPEG far
 *     under the ceiling; anything else is refused before it is stored. The
 *     answer is `{ storageId, url }`, the key and where it is served.
 *   - `GET /__photos/:key` → the file, cached for a year: a key is never
 *     reused, so a new photo is a new address.
 *
 * Nothing here writes an entity: the body change goes through the entity's
 * own write. Nothing yet deletes a file no entity holds.
 */

import { PHOTOS_PATH } from '../lib/sharing/paths'
import type { Identity } from './auth/index'
import { identityOf } from './auth/index'
import type { SharedDb } from './shared/db'
import { crossOrigin, decodeSegment, IMMUTABLE, REFUSALS } from './shared/refusals'

/** The slice of an R2 binding this uses. */
export type PhotoBucket = {
  put(
    key: string,
    value: ArrayBuffer,
    options: {
      httpMetadata: { contentType: string }
      customMetadata: Record<string, string>
    }
  ): Promise<unknown>
  get(key: string): Promise<{
    body: ReadableStream
    httpMetadata?: { contentType?: string }
    httpEtag: string
  } | null>
}

export type PhotosEnv = { SHARED: SharedDb; ADMIN_DISCORD_IDS?: string; PHOTOS?: PhotoBucket }

/** The image types an upload may be, each with the extension its key takes. */
const PHOTO_TYPES: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

/** A photo's ceiling. The client scales to 1600px first, which lands far under it. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024

/** A key this route minted: a UUID and its type's extension, nothing a path could escape with. */
const KEY = /^[0-9a-f-]{36}\.(webp|jpg|png)$/

type Identify = (request: Request, env: PhotosEnv) => Promise<Identity | null>

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json;charset=UTF-8', 'cache-control': 'no-store' },
  })
}

export function isPhotosPath(pathname: string): boolean {
  return pathname === PHOTOS_PATH || pathname.startsWith(`${PHOTOS_PATH}/`)
}

export async function servePhotos(
  request: Request,
  env: PhotosEnv,
  identify: Identify = identityOf,
  newKey: () => string = () => crypto.randomUUID()
): Promise<Response> {
  const bucket = env.PHOTOS
  if (bucket === undefined) return json(503, { refusal: REFUSALS.photosUnset })
  const url = new URL(request.url)

  if (request.method === 'POST' && url.pathname === PHOTOS_PATH) {
    if (crossOrigin(request)) return json(403, { refusal: REFUSALS.crossOrigin })
    const who = await identify(request, env)
    if (who === null) return json(401, { refusal: REFUSALS.signIn })
    const type = (request.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
    const extension = PHOTO_TYPES[type]
    const declared = Number(request.headers.get('content-length') ?? '0')
    if (extension === undefined || declared > MAX_PHOTO_BYTES) return refusedPhoto()
    const file = await request.arrayBuffer()
    if (file.byteLength === 0 || file.byteLength > MAX_PHOTO_BYTES) return refusedPhoto()
    const key = `${newKey()}.${extension}`
    await bucket.put(key, file, {
      httpMetadata: { contentType: type },
      customMetadata: { owner: who.discordId },
    })
    return json(200, { storageId: key, url: new URL(`${PHOTOS_PATH}/${key}`, url).href })
  }

  const key = decodeSegment(url.pathname.slice(PHOTOS_PATH.length + 1))
  if (request.method !== 'GET' || key === null || !KEY.test(key))
    return json(404, { refusal: REFUSALS.notFound })
  const object = await bucket.get(key)
  if (object === null) return json(404, { refusal: REFUSALS.notFound })
  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': IMMUTABLE,
      etag: object.httpEtag,
    },
  })
}

/** What the player reads when the file is not one the site takes. */
function refusedPhoto(): Response {
  return json(415, { refusal: REFUSALS.notAPhoto })
}
