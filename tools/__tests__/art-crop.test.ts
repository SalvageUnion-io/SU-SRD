import { expect, test } from 'bun:test'
import { inkBox } from 'gates/lib/inkBox'
import sharp from 'sharp'

/** A `width` × `height` RGBA canvas of paper with an ink rectangle at [x, y, w, h]. */
function canvas(width: number, height: number, ink?: [number, number, number, number]) {
  const px = new Uint8Array(width * height * 4).fill(255)
  if (ink) {
    const [ix, iy, iw, ih] = ink
    for (let y = iy; y < iy + ih; y++) {
      for (let x = ix; x < ix + iw; x++) px.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3)
    }
  }
  return px
}

test("art-crop's sharp decode feeds inkBox raw RGBA", async () => {
  const png = await sharp(canvas(8, 8, [0, 0, 4, 2]), {
    raw: { width: 8, height: 8, channels: 4 },
  })
    .png()
    .toBuffer()
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  expect(inkBox(data, info.width, info.height)).toEqual([0, 0, 0.5, 0.25, 2])
})
