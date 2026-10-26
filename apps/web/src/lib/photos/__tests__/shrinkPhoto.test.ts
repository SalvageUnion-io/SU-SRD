/**
 * `shrinkPhoto` and `postPhoto`: a picked file is scaled to fit and
 * re-encoded — WebP where the browser writes it, JPEG where its canvas quietly
 * hands back something else — and a file the browser cannot read, or a canvas
 * it cannot draw on, is refused in words for the player.
 *
 * happy-dom has no image decoder or 2D canvas, so `createImageBitmap` and the
 * canvas's `getContext` / `toBlob` are stood in for here and put back after
 * each test.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { PhotoRefused, postPhoto, shrinkPhoto } from '../uploadPhoto'

type Encoder = (type: string) => Blob | null

const canvasProto = HTMLCanvasElement.prototype as unknown as {
  getContext: unknown
  toBlob: unknown
}
const real = {
  createImageBitmap: (globalThis as { createImageBitmap?: unknown }).createImageBitmap,
  getContext: canvasProto.getContext,
  toBlob: canvasProto.toBlob,
  fetch: globalThis.fetch,
}

let drawn: { width: number; height: number; canvas: { width: number; height: number } }[] = []
let closed = 0
let asked: string[] = []

function stubImage(width: number, height: number, readable = true) {
  ;(globalThis as { createImageBitmap?: unknown }).createImageBitmap = async () => {
    if (!readable) throw new Error('decode failed')
    return {
      width,
      height,
      close: () => {
        closed += 1
      },
    }
  }
}

function stubCanvas({ context = true, encode }: { context?: boolean; encode: Encoder }) {
  canvasProto.getContext = function (this: HTMLCanvasElement) {
    if (!context) return null
    return {
      drawImage: (_img: unknown, _x: number, _y: number, width: number, height: number) => {
        drawn.push({ width, height, canvas: { width: this.width, height: this.height } })
      },
    }
  }
  canvasProto.toBlob = (callback: (blob: Blob | null) => void, type: string) => {
    asked.push(type)
    callback(encode(type))
  }
}

const file = new Blob(['raw'], { type: 'image/jpeg' })

beforeEach(() => {
  drawn = []
  closed = 0
  asked = []
})

afterEach(() => {
  ;(globalThis as { createImageBitmap?: unknown }).createImageBitmap = real.createImageBitmap
  canvasProto.getContext = real.getContext
  canvasProto.toBlob = real.toBlob
  globalThis.fetch = real.fetch
})

describe('shrinkPhoto', () => {
  test('scales a large photo to the longest-edge cap and writes WebP', async () => {
    stubImage(4000, 3000)
    stubCanvas({ encode: (type) => new Blob(['w'], { type }) })
    const out = await shrinkPhoto(file)
    expect(out.type).toBe('image/webp')
    expect(drawn).toEqual([{ width: 1600, height: 1200, canvas: { width: 1600, height: 1200 } }])
    expect(closed).toBe(1)
    expect(asked).toEqual(['image/webp'])
  })

  test('falls back to JPEG when the canvas hands back another type for WebP', async () => {
    stubImage(800, 600)
    stubCanvas({
      encode: (type) => new Blob(['x'], { type: type === 'image/webp' ? 'image/png' : type }),
    })
    const out = await shrinkPhoto(file)
    expect(out.type).toBe('image/jpeg')
    expect(asked).toEqual(['image/webp', 'image/jpeg'])
    // A small photo is never scaled up.
    expect(drawn[0]?.canvas).toEqual({ width: 800, height: 600 })
  })

  test('a file the browser cannot read is refused in words', async () => {
    stubImage(0, 0, false)
    stubCanvas({ encode: () => null })
    const err = await shrinkPhoto(file).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PhotoRefused)
    expect((err as Error).message).toBe('That file is not an image this browser can read.')
  })

  test('no 2D canvas, or no encoder at all, is refused too', async () => {
    stubImage(100, 100)
    stubCanvas({ context: false, encode: () => null })
    await expect(shrinkPhoto(file)).rejects.toThrow('This browser cannot prepare the photo.')

    stubCanvas({ encode: () => null })
    const err = await shrinkPhoto(file).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PhotoRefused)
    expect(asked).toEqual(['image/webp', 'image/jpeg'])
  })
})

describe('postPhoto', () => {
  test('POSTs the blob to the upload URL with its own content type', async () => {
    const sent: { url: string; init: RequestInit | undefined }[] = []
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      sent.push({ url, init })
      return Response.json({ storageId: 's1' })
    }) as typeof fetch
    const blob = new Blob(['w'], { type: 'image/webp' })
    const response = await postPhoto('/__photos', blob)
    expect(await response.json()).toEqual({ storageId: 's1' })
    expect(sent).toHaveLength(1)
    expect(sent[0]?.url).toBe('/__photos')
    expect(sent[0]?.init?.method).toBe('POST')
    expect(sent[0]?.init?.headers).toEqual({ 'Content-Type': 'image/webp' })
    expect(sent[0]?.init?.body).toBe(blob)
  })
})
