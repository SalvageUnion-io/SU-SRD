import { describe, expect, test } from 'bun:test'
import type { PhotoUploader } from '../uploadPhoto'
import { fitWithin, MAX_PHOTO_EDGE, uploadPhoto } from '../uploadPhoto'

const PHOTO = {
  kind: 'upload',
  storageId: 's1',
  url: 'https://x.convex.cloud/api/storage/1',
} as const

function uploader(over: Partial<PhotoUploader> = {}): PhotoUploader & { posted: string[] } {
  const posted: string[] = []
  return {
    posted,
    generateUploadUrl: async () => 'https://x.convex.cloud/upload',
    post: async (url) => {
      posted.push(url)
      return Response.json({ storageId: 's1' })
    },
    claim: async () => PHOTO,
    ...over,
  }
}

describe('fitWithin', () => {
  test('scales the longest edge down to the cap, keeping the aspect', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: MAX_PHOTO_EDGE, height: 1200 })
    expect(fitWithin(900, 3600)).toEqual({ width: 400, height: MAX_PHOTO_EDGE })
  })

  test('never scales a small image up', () => {
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 })
  })
})

describe('uploadPhoto', () => {
  test('posts to the upload url and returns the claimed photo', async () => {
    const u = uploader()
    expect(await uploadPhoto(new Blob(['x'], { type: 'image/webp' }), u)).toEqual(PHOTO)
    expect(u.posted).toEqual(['https://x.convex.cloud/upload'])
  })

  test('says so when the upload fails, the answer has no id, or the server refuses the file', async () => {
    const blob = new Blob(['x'], { type: 'image/webp' })
    await expect(
      uploadPhoto(blob, uploader({ post: async () => new Response('', { status: 500 }) }))
    ).rejects.toThrow('(500)')
    await expect(
      uploadPhoto(blob, uploader({ post: async () => Response.json({}) }))
    ).rejects.toThrow('no file id')
    await expect(uploadPhoto(blob, uploader({ claim: async () => null }))).rejects.toThrow(
      'under 4 MB'
    )
  })
})
