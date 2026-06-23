/**
 * Minimal, zero-dependency QR Code encoder (byte mode, EC level M).
 *
 * Vendored in-tree rather than pulling a runtime dependency — the share-URL QR
 * is the only QR surface in the app and the URLs are short (`{origin}/s/{8}`),
 * so a focused byte-mode encoder is all that is needed. Honors the "no
 * heavyweight dependency / prefer tiny or zero-dep" constraint.
 *
 * Implements the subset of ISO/IEC 18004 (QR Code) required for byte-mode
 * payloads up to version 10 at EC level M (~213 bytes), which comfortably
 * covers any snapshot share URL. Public API:
 *   - `encodeQrMatrix(text)` → square `boolean[][]` (`true` = dark module)
 *   - `qrMatrixToSvgPath(matrix)` → an SVG `<path>` `d` string for crisp,
 *     resolution-independent rendering.
 *
 * Algorithm references: ISO/IEC 18004, Thonky's QR Code tutorial.
 */

// ---------------------------------------------------------------------------
// Galois field GF(256) arithmetic for Reed–Solomon error correction
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)

{
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d // primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

/**
 * Builds the generator polynomial for `degree` error-correction codewords,
 * with coefficients in leading-term-first order (index 0 is the x^degree
 * coefficient, always 1). It is the product of (x − α^i) for i = 0..degree-1.
 */
function rsGeneratorPoly(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    // Multiply by (x + α^i): shift up (×x) then add α^i × current.
    const next = new Array<number>(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j] // ×x term
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]) // ×α^i term
    }
    poly = next
  }
  return poly
}

/** Computes `ecCount` Reed–Solomon codewords for the given data codewords. */
function rsEncode(data: number[], ecCount: number): number[] {
  const gen = rsGeneratorPoly(ecCount)
  const res = new Array<number>(ecCount).fill(0)
  for (const byte of data) {
    const factor = byte ^ res[0]
    res.shift()
    res.push(0)
    if (factor !== 0) {
      for (let i = 0; i < gen.length - 1; i++) {
        res[i] ^= gfMul(gen[i + 1], factor)
      }
    }
  }
  return res
}

// ---------------------------------------------------------------------------
// Version capacity tables (EC level M only)
// ---------------------------------------------------------------------------

type VersionSpec = {
  version: number
  /** Total data codewords (across all blocks). */
  dataCodewords: number
  /** EC codewords per block. */
  ecPerBlock: number
  /** Block group definitions: [blockCount, dataCodewordsPerBlock][]. */
  groups: Array<[number, number]>
  /** Alignment-pattern centre coordinates (empty for v1). */
  alignment: number[]
}

// EC level M, versions 1–10. Capacity at v1 is 14 data bytes, ~213 at v10.
const VERSIONS: VersionSpec[] = [
  { version: 1, dataCodewords: 16, ecPerBlock: 10, groups: [[1, 16]], alignment: [] },
  { version: 2, dataCodewords: 28, ecPerBlock: 16, groups: [[1, 28]], alignment: [6, 18] },
  { version: 3, dataCodewords: 44, ecPerBlock: 26, groups: [[1, 44]], alignment: [6, 22] },
  { version: 4, dataCodewords: 64, ecPerBlock: 18, groups: [[2, 32]], alignment: [6, 26] },
  { version: 5, dataCodewords: 86, ecPerBlock: 24, groups: [[2, 43]], alignment: [6, 30] },
  { version: 6, dataCodewords: 108, ecPerBlock: 16, groups: [[4, 27]], alignment: [6, 34] },
  {
    version: 7,
    dataCodewords: 124,
    ecPerBlock: 18,
    groups: [[4, 31]],
    alignment: [6, 22, 38],
  },
  {
    version: 8,
    dataCodewords: 154,
    ecPerBlock: 22,
    groups: [
      [2, 38],
      [2, 39],
    ],
    alignment: [6, 24, 42],
  },
  {
    version: 9,
    dataCodewords: 182,
    ecPerBlock: 22,
    groups: [
      [3, 36],
      [2, 37],
    ],
    alignment: [6, 26, 46],
  },
  {
    version: 10,
    dataCodewords: 216,
    ecPerBlock: 26,
    groups: [
      [4, 43],
      [1, 44],
    ],
    alignment: [6, 28, 50],
  },
]

/** Picks the smallest version that fits `byteLength` data bytes (byte mode). */
function selectVersion(byteLength: number): VersionSpec {
  for (const spec of VERSIONS) {
    // Byte-mode overhead: 4-bit mode indicator + char-count indicator
    // (8 bits for v1–9, 16 bits for v10+), then 8 bits per data byte.
    const charCountBits = spec.version >= 10 ? 16 : 8
    const requiredBits = 4 + charCountBits + byteLength * 8
    if (requiredBits <= spec.dataCodewords * 8) return spec
  }
  throw new Error('QR payload too large for supported versions (max ~213 bytes)')
}

// ---------------------------------------------------------------------------
// Bit buffer + codeword assembly
// ---------------------------------------------------------------------------

class BitBuffer {
  private bits: number[] = []
  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1)
  }
  get length(): number {
    return this.bits.length
  }
  toBytes(): number[] {
    const bytes: number[] = []
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0
      for (let j = 0; j < 8; j++) byte = (byte << 1) | (this.bits[i + j] ?? 0)
      bytes.push(byte)
    }
    return bytes
  }
}

const PAD_BYTES = [0xec, 0x11]

/** Encodes `text` (UTF-8) into the final interleaved codeword stream. */
function buildCodewords(text: string, spec: VersionSpec): number[] {
  const utf8 = new TextEncoder().encode(text)
  const buffer = new BitBuffer()

  buffer.put(0b0100, 4) // byte-mode indicator
  buffer.put(utf8.length, spec.version >= 10 ? 16 : 8) // character count
  for (const byte of utf8) buffer.put(byte, 8)

  const capacityBits = spec.dataCodewords * 8
  const terminator = Math.min(4, capacityBits - buffer.length)
  if (terminator > 0) buffer.put(0, terminator)
  if (buffer.length % 8 !== 0) buffer.put(0, 8 - (buffer.length % 8))

  const dataBytes = buffer.toBytes()
  for (let i = 0; dataBytes.length < spec.dataCodewords; i++) {
    dataBytes.push(PAD_BYTES[i % 2])
  }

  // Split into blocks, compute EC per block, then interleave data then EC.
  const dataBlocks: number[][] = []
  const ecBlocks: number[][] = []
  let offset = 0
  for (const [count, perBlock] of spec.groups) {
    for (let b = 0; b < count; b++) {
      const block = dataBytes.slice(offset, offset + perBlock)
      offset += perBlock
      dataBlocks.push(block)
      ecBlocks.push(rsEncode(block, spec.ecPerBlock))
    }
  }

  const result: number[] = []
  const maxData = Math.max(...dataBlocks.map((b) => b.length))
  for (let i = 0; i < maxData; i++) {
    for (const block of dataBlocks) if (i < block.length) result.push(block[i])
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const block of ecBlocks) result.push(block[i])
  }
  return result
}

// ---------------------------------------------------------------------------
// Matrix construction (boolean grid + a parallel "reserved" mask)
// ---------------------------------------------------------------------------

type Grid = { dark: boolean[][]; reserved: boolean[][]; size: number }

function newGrid(size: number): Grid {
  return {
    dark: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    reserved: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    size,
  }
}

function set(grid: Grid, r: number, c: number, dark: boolean): void {
  grid.dark[r][c] = dark
  grid.reserved[r][c] = true
}

function placeFinder(grid: Grid, row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r
      const cc = col + c
      if (rr < 0 || rr >= grid.size || cc < 0 || cc >= grid.size) continue
      if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6
        const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4
        set(grid, rr, cc, isBorder || isCore)
      } else {
        set(grid, rr, cc, false) // separator
      }
    }
  }
}

function placeAlignment(grid: Grid, centres: number[]): void {
  for (const r of centres) {
    for (const c of centres) {
      if (
        (r === 6 && c === 6) ||
        (r === 6 && c === grid.size - 7) ||
        (r === grid.size - 7 && c === 6)
      ) {
        continue // overlaps a finder pattern
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBorder = Math.max(Math.abs(dr), Math.abs(dc)) === 2
          const isCentre = dr === 0 && dc === 0
          set(grid, r + dr, c + dc, isBorder || isCentre)
        }
      }
    }
  }
}

function placeTiming(grid: Grid): void {
  for (let i = 8; i < grid.size - 8; i++) {
    const v = i % 2 === 0
    if (!grid.reserved[6][i]) set(grid, 6, i, v)
    if (!grid.reserved[i][6]) set(grid, i, 6, v)
  }
}

/** Reserves the format-info and (v7+) version-info regions, sets dark module. */
function reserveFormatAreas(grid: Grid, version: number): void {
  const n = grid.size
  for (let i = 0; i <= 8; i++) {
    if (!grid.reserved[8][i]) set(grid, 8, i, false)
    if (!grid.reserved[i][8]) set(grid, i, 8, false)
  }
  for (let i = 0; i < 8; i++) {
    if (!grid.reserved[8][n - 1 - i]) set(grid, 8, n - 1 - i, false)
    if (!grid.reserved[n - 1 - i][8]) set(grid, n - 1 - i, 8, false)
  }
  set(grid, n - 8, 8, true) // dark module — always set
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        set(grid, i, n - 11 + j, false)
        set(grid, n - 11 + j, i, false)
      }
    }
  }
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

/** Walks the zig-zag data path, writing codeword bits under `mask`. */
function placeData(grid: Grid, codewords: number[], mask: (r: number, c: number) => boolean): void {
  const n = grid.size
  let bitIndex = 0
  const totalBits = codewords.length * 8
  let upward = true
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col-- // skip the vertical timing column
    for (let i = 0; i < n; i++) {
      const row = upward ? n - 1 - i : i
      for (let c = 0; c < 2; c++) {
        const cc = col - c
        if (grid.reserved[row][cc]) continue
        let bit = false
        if (bitIndex < totalBits) {
          const byte = codewords[bitIndex >> 3]
          bit = ((byte >> (7 - (bitIndex & 7))) & 1) === 1
          bitIndex++
        }
        if (mask(row, cc)) bit = !bit
        grid.dark[row][cc] = bit
      }
    }
    upward = !upward
  }
}

// Format-info BCH(15,5) words for EC level M (bits 00), indexed by mask 0–7.
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

function placeFormatInfo(grid: Grid, mask: number): void {
  const n = grid.size
  const bits = FORMAT_BITS[mask]
  const get = (i: number) => ((bits >> i) & 1) === 1
  // Copy 1 — wraps the top-left finder.
  for (let i = 0; i <= 5; i++) grid.dark[8][i] = get(i)
  grid.dark[8][7] = get(6)
  grid.dark[8][8] = get(7)
  grid.dark[7][8] = get(8)
  for (let i = 9; i <= 14; i++) grid.dark[14 - i][8] = get(i)
  // Copy 2 — 7 bits up column 8 (rows n-1..n-7), 8 bits along row 8
  // (cols n-8..n-1). The dark module at (n-8, 8) is set separately below.
  for (let i = 0; i <= 6; i++) grid.dark[n - 1 - i][8] = get(i)
  for (let i = 7; i <= 14; i++) grid.dark[8][n - 8 + (i - 7)] = get(i)
  grid.dark[n - 8][8] = true // dark module — always set
}

// Version-info BCH(18,6) words for versions 7–10.
const VERSION_BITS: Record<number, number> = {
  7: 0x07c94,
  8: 0x085bc,
  9: 0x09a99,
  10: 0x0a4d3,
}

function placeVersionInfo(grid: Grid, version: number): void {
  if (version < 7) return
  const n = grid.size
  const bits = VERSION_BITS[version]
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >> i) & 1) === 1
    const r = Math.floor(i / 3)
    const c = i % 3
    grid.dark[r][n - 11 + c] = bit
    grid.dark[n - 11 + c][r] = bit
  }
}

// ---------------------------------------------------------------------------
// Mask-penalty scoring (ISO/IEC 18004 §8.8.2) — picks the lowest-penalty mask
// ---------------------------------------------------------------------------

function maskPenalty(d: boolean[][]): number {
  const n = d.length
  let penalty = 0

  // Rule 1: runs of 5+ same-colour modules in rows and columns.
  for (let i = 0; i < n; i++) {
    let rowRun = 1
    let colRun = 1
    for (let j = 1; j < n; j++) {
      if (d[i][j] === d[i][j - 1]) rowRun++
      else {
        if (rowRun >= 5) penalty += 3 + (rowRun - 5)
        rowRun = 1
      }
      if (d[j][i] === d[j - 1][i]) colRun++
      else {
        if (colRun >= 5) penalty += 3 + (colRun - 5)
        colRun = 1
      }
    }
    if (rowRun >= 5) penalty += 3 + (rowRun - 5)
    if (colRun >= 5) penalty += 3 + (colRun - 5)
  }

  // Rule 2: 2x2 same-colour blocks.
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const v = d[i][j]
      if (v === d[i][j + 1] && v === d[i + 1][j] && v === d[i + 1][j + 1]) penalty += 3
    }
  }

  // Rule 3: finder-like 1:1:3:1:1 patterns (both orientations).
  const pat1 = [true, false, true, true, true, false, true, false, false, false, false]
  const pat2 = [false, false, false, false, true, false, true, true, true, false, true]
  const matches = (arr: boolean[], i: number, j: number, horizontal: boolean): boolean => {
    for (let k = 0; k < 11; k++) {
      const r = horizontal ? i : i + k
      const c = horizontal ? j + k : j
      if (d[r][c] !== arr[k]) return false
    }
    return true
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (j + 11 <= n && (matches(pat1, i, j, true) || matches(pat2, i, j, true))) penalty += 40
      if (i + 11 <= n && (matches(pat1, i, j, false) || matches(pat2, i, j, false))) penalty += 40
    }
  }

  // Rule 4: dark-module proportion deviation from 50%.
  let dark = 0
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (d[i][j]) dark++
  const ratio = (dark * 100) / (n * n)
  penalty += Math.floor(Math.abs(ratio - 50) / 5) * 10

  return penalty
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encodes `text` into a QR-code module matrix (byte mode, EC level M). Returns
 * a square `boolean[][]` where `true` is a dark module. Throws if the payload
 * is empty or exceeds the supported capacity (~213 bytes).
 */
export function encodeQrMatrix(text: string): boolean[][] {
  if (!text) throw new Error('Cannot encode an empty QR payload')
  const utf8Length = new TextEncoder().encode(text).length
  const spec = selectVersion(utf8Length)
  const size = 17 + spec.version * 4
  const codewords = buildCodewords(text, spec)

  // Build the function-pattern layer once; it is shared by every mask trial.
  const base = newGrid(size)
  placeFinder(base, 0, 0)
  placeFinder(base, 0, size - 7)
  placeFinder(base, size - 7, 0)
  placeAlignment(base, spec.alignment)
  placeTiming(base)
  reserveFormatAreas(base, spec.version)

  let best: boolean[][] | null = null
  let bestPenalty = Infinity
  for (let mask = 0; mask < MASK_FNS.length; mask++) {
    const grid: Grid = {
      dark: base.dark.map((row) => row.slice()),
      reserved: base.reserved,
      size,
    }
    placeData(grid, codewords, MASK_FNS[mask])
    placeFormatInfo(grid, mask)
    placeVersionInfo(grid, spec.version)
    const penalty = maskPenalty(grid.dark)
    if (penalty < bestPenalty) {
      bestPenalty = penalty
      best = grid.dark
    }
  }

  // `best` is always assigned — MASK_FNS is non-empty.
  return best as boolean[][]
}

/**
 * Converts a QR module matrix into an SVG `<path>` `d` string, each dark module
 * a 1x1 square in a coordinate space matching the matrix size. Pair with
 * `viewBox="0 0 {size} {size}"` for crisp scaling at any pixel size.
 */
export function qrMatrixToSvgPath(matrix: boolean[][]): string {
  const parts: string[] = []
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) parts.push(`M${c} ${r}h1v1h-1z`)
    }
  }
  return parts.join('')
}
