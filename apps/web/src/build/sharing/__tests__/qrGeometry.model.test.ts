import { describe, expect, test } from 'bun:test'
import QRCode from 'qrcode'
import { qrGeometry } from '../qrGeometry.model'

/** The modules a path of `M x y h w v1 h -w z` runs paints, as `row,col`. */
function painted(path: string): Set<string> {
  const cells = new Set<string>()
  for (const [, x, y, w] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(w); i++) cells.add(`${Number(y) - 1},${Number(x) + i - 1}`)
  }
  return cells
}

describe('qrGeometry', () => {
  test('paints exactly the dark modules, inside a one-module quiet zone', () => {
    const url = 'https://salvageunion.io/build/p/pilot/pilot-1'
    const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' })
    const dark = new Set<string>()
    for (let row = 0; row < modules.size; row++)
      for (let col = 0; col < modules.size; col++)
        if (modules.get(row, col)) dark.add(`${row},${col}`)

    const { size, path } = qrGeometry(url)
    expect(size).toBe(modules.size + 2)
    expect(painted(path)).toEqual(dark)
  })
})
