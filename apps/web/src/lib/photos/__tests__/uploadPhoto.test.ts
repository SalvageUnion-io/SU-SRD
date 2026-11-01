import { describe, expect, test } from 'bun:test'
import { fitWithin, MAX_PHOTO_EDGE, uploadPhoto } from '../uploadPhoto'

const BLOB = new Blob(['x'], { type: 'image/webp' })

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
  test("posts to the Worker's photo route and returns the photo it stored", async () => {
    const posted: string[] = []
    const post = async (url: string) => {
      posted.push(url)
      return Response.json({ storageId: 's1.webp' })
    }
    expect(await uploadPhoto(BLOB, post)).toEqual({
      kind: 'upload',
      storageId: 's1.webp',
    })
    expect(posted).toEqual(['/__photos'])
  })

  test('says so when the Worker refuses the file, the upload fails, or the answer has no id', async () => {
    const answer = (response: Response) => async () => response
    await expect(uploadPhoto(BLOB, answer(new Response('', { status: 415 })))).rejects.toThrow(
      'under 4 MB'
    )
    await expect(uploadPhoto(BLOB, answer(new Response('', { status: 500 })))).rejects.toThrow(
      '(500)'
    )
    await expect(uploadPhoto(BLOB, answer(Response.json({})))).rejects.toThrow('no file id')
  })
})
