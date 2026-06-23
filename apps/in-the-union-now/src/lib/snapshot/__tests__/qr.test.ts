/**
 * Tests for the in-tree QR encoder (lib/snapshot/qr.ts).
 *
 * Correctness is verified two ways:
 *   1. Structural invariants of the produced module matrix (finder patterns,
 *      timing patterns, dark module, quiet-zone-free square size).
 *   2. A full encode→decode roundtrip for representative share URLs across the
 *      single-block (v1–3/6) and multi-block (v4+) layouts — re-reading the
 *      modules along the same zig-zag, un-applying the chosen mask, and parsing
 *      the byte-mode payload back to the original string.
 */

import { describe, expect, test } from 'bun:test'

import { encodeQrMatrix, qrMatrixToSvgPath } from '../qr'

// Mirror of the encoder's mask functions / format words, used by the decoder.
const FORMAT_BITS: Record<number, number> = {
  0: 0x5412,
  1: 0x5125,
  2: 0x5e7c,
  3: 0x5b4b,
  4: 0x45f9,
  5: 0x40ce,
  6: 0x4f97,
  7: 0x4aa0,
}

const MASK_FNS: Array<(r: number, c: number) => boolean> = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

// Alignment-pattern centres + data-block layout (EC level M) per version,
// keyed by symbol size — just enough for the decoder to de-interleave.
const LAYOUTS: Record<
  number,
  { centres: number[]; blocks: Array<{ count: number; data: number; ec: number }> }
> = {
  21: { centres: [], blocks: [{ count: 1, data: 16, ec: 10 }] }, // v1
  25: { centres: [6, 18], blocks: [{ count: 1, data: 28, ec: 16 }] }, // v2
  29: { centres: [6, 22], blocks: [{ count: 1, data: 44, ec: 26 }] }, // v3
  33: { centres: [6, 26], blocks: [{ count: 2, data: 32, ec: 18 }] }, // v4
  37: { centres: [6, 30], blocks: [{ count: 2, data: 43, ec: 24 }] }, // v5
}

/** Reverses encodeQrMatrix to recover the byte-mode payload string. */
function decode(m: boolean[][]): string {
  const n = m.length
  const layout = LAYOUTS[n]
  if (!layout) throw new Error(`No decoder layout for size ${n}`)

  // Recover the mask from format-info copy 1.
  let fmt = 0
  const get = (r: number, c: number) => (m[r][c] ? 1 : 0)
  const fb: number[] = []
  for (let i = 0; i <= 5; i++) fb[i] = get(8, i)
  fb[6] = get(8, 7)
  fb[7] = get(8, 8)
  fb[8] = get(7, 8)
  for (let i = 9; i <= 14; i++) fb[i] = get(14 - i, 8)
  for (let i = 0; i < 15; i++) fmt |= fb[i] << i
  let mask = -1
  for (let k = 0; k < 8; k++) if (FORMAT_BITS[k] === fmt) mask = k
  if (mask < 0) throw new Error('format info not recognised')

  // Rebuild the reserved (function-pattern) mask.
  const reserved = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const mark = (r: number, c: number) => {
    if (r >= 0 && r < n && c >= 0 && c < n) reserved[r][c] = true
  }
  const finder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) mark(row + r, col + c)
  }
  finder(0, 0)
  finder(0, n - 7)
  finder(n - 7, 0)
  for (let i = 0; i < n; i++) {
    mark(6, i)
    mark(i, 6)
  }
  for (const r of layout.centres) {
    for (const c of layout.centres) {
      if ((r === 6 && c === 6) || (r === 6 && c === n - 7) || (r === n - 7 && c === 6)) continue
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) mark(r + dr, c + dc)
    }
  }
  for (let i = 0; i <= 8; i++) {
    mark(8, i)
    mark(i, 8)
  }
  for (let i = 0; i < 8; i++) {
    mark(8, n - 1 - i)
    mark(n - 1 - i, 8)
  }
  mark(n - 8, 8)

  // Walk the zig-zag, un-mask, collect data bits.
  const bits: number[] = []
  let upward = true
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--
    for (let i = 0; i < n; i++) {
      const row = upward ? n - 1 - i : i
      for (let c = 0; c < 2; c++) {
        const cc = col - c
        if (reserved[row][cc]) continue
        let bit = m[row][cc] ? 1 : 0
        if (MASK_FNS[mask](row, cc)) bit ^= 1
        bits.push(bit)
      }
    }
    upward = !upward
  }

  // Bits → codewords, then de-interleave the data codewords back into blocks.
  const cw: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]
    cw.push(byte)
  }
  const block = layout.blocks[0]
  const totalData = block.count * block.data
  const interleaved = cw.slice(0, totalData)
  const blocks: number[][] = Array.from({ length: block.count }, () => [])
  for (let i = 0; i < totalData; i++) blocks[i % block.count].push(interleaved[i])
  const data = blocks.flat()

  // Parse the byte-mode payload from the reassembled data stream.
  let bp = 0
  const readBits = (count: number) => {
    let v = 0
    for (let k = 0; k < count; k++) {
      const byteIndex = bp >> 3
      const bitIndex = 7 - (bp & 7)
      v = (v << 1) | ((data[byteIndex] >> bitIndex) & 1)
      bp++
    }
    return v
  }
  const mode = readBits(4)
  expect(mode).toBe(0b0100) // byte mode
  const len = readBits(8)
  let out = ''
  for (let i = 0; i < len; i++) out += String.fromCharCode(readBits(8))
  return out
}

describe('encodeQrMatrix — structure', () => {
  test('produces a square matrix with the canonical finder/timing/dark patterns', () => {
    const m = encodeQrMatrix('https://example.com/s/AB12CD34')
    const n = m.length
    expect(n).toBe(29) // version 3

    // Finder patterns: outer ring dark, inner ring light, 3x3 core dark.
    for (const [r0, c0] of [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ]) {
      expect(m[r0][c0]).toBe(true)
      expect(m[r0 + 1][c0 + 1]).toBe(false)
      expect(m[r0 + 3][c0 + 3]).toBe(true)
    }

    // Timing patterns alternate along row/col 6.
    expect(m[6][8]).toBe(true)
    expect(m[6][9]).toBe(false)

    // Dark module is always set.
    expect(m[n - 8][8]).toBe(true)
  })

  test('throws on an empty payload', () => {
    expect(() => encodeQrMatrix('')).toThrow()
  })
})

describe('encodeQrMatrix — encode/decode roundtrip', () => {
  const urls = [
    'https://x.io/s/AB12CD34', // short → low version (single block)
    'https://example.com/s/AB12CD34',
    'http://localhost:5173/s/00000000',
    'https://in-the-union-now.netlify.app/s/Z9Y8X7W6', // multi-block (v4)
    'https://in-the-union-now.netlify.app/s/Z9Y8X7W6?ref=share-card', // larger
  ]
  for (const url of urls) {
    test(`roundtrips ${url}`, () => {
      const m = encodeQrMatrix(url)
      expect(decode(m)).toBe(url)
    })
  }
})

describe('qrMatrixToSvgPath', () => {
  test('emits one 1x1 square sub-path per dark module', () => {
    const matrix = [
      [true, false],
      [false, true],
    ]
    const d = qrMatrixToSvgPath(matrix)
    expect(d).toBe('M0 0h1v1h-1zM1 1h1v1h-1z')
  })
})
