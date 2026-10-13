/**
 * Turn a picked image file into the `upload` photo an entity body stores
 * (`itun-domain/schemas/photo`), through `convex/photos.ts`.
 *
 * The file is scaled and re-encoded here first. A phone photo is 4–12 MB and
 * 4000px wide; a sheet shows it at a few hundred pixels. Re-encoding also
 * strips the EXIF block (location included) a camera writes into the original,
 * which matters because a photo on a shared or public sheet is seen by people
 * other than its uploader.
 *
 * The entity write is the caller's: this returns the photo and stops, so the
 * field goes through the entity's own store write like any other.
 */

import type { Photo } from 'itun-domain/schemas/photo'

/**
 * A photo the browser or the server would not take, in words for the player:
 * the file is theirs to change. `EntityPhoto` shows the message; any other
 * failure is a defect, and gets a generic line and a report.
 */
export class PhotoRefused extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PhotoRefused'
  }
}

/** The longest edge a stored photo keeps. */
export const MAX_PHOTO_EDGE = 1600

/** Re-encoding quality for the lossy formats. */
const QUALITY = 0.85

/** The upload steps, injected so a test can stand in for Convex. */
export type PhotoUploader = {
  generateUploadUrl: () => Promise<string>
  /** `null` when the server refused the file (and deleted it). */
  claim: (args: { storageId: string }) => Promise<Extract<Photo, { kind: 'upload' }> | null>
  post: (url: string, body: Blob) => Promise<Response>
}

/** The size a `width` × `height` image scales to so its longest edge fits `max`. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_EDGE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * Scale a picked file and re-encode it: WebP where the browser can write it,
 * JPEG where it cannot (Safari's canvas writes PNG for an unsupported type
 * rather than failing, so the result's type is checked, not assumed).
 */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch (cause) {
    throw new PhotoRefused('That file is not an image this browser can read.', { cause })
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context === null) throw new PhotoRefused('This browser cannot prepare the photo.')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY))
  const webp = await encode('image/webp')
  if (webp?.type === 'image/webp') return webp
  const jpeg = await encode('image/jpeg')
  if (jpeg === null) throw new PhotoRefused('This browser cannot prepare the photo.')
  return jpeg
}

/** Upload one prepared photo and claim it. */
export async function uploadPhoto(blob: Blob, uploader: PhotoUploader): Promise<Photo> {
  const url = await uploader.generateUploadUrl()
  const response = await uploader.post(url, blob)
  if (!response.ok)
    throw new PhotoRefused(`The photo upload failed (${response.status}). Try again.`)
  const { storageId } = (await response.json()) as { storageId?: unknown }
  if (typeof storageId !== 'string') throw new Error('The photo upload returned no file id.')
  const photo = await uploader.claim({ storageId })
  if (photo === null)
    throw new PhotoRefused('A photo must be a WebP, JPEG or PNG image under 4 MB.')
  return photo
}

/** The browser's POST of a photo to a Convex upload URL. */
export function postPhoto(url: string, body: Blob): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': body.type }, body })
}
