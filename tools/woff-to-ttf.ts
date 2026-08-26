/**
 * woff-to-ttf — unwrap the `.woff` files `@fontsource` ships into plain TTF.
 *
 * ## Why this is needed
 *
 * The og:image renderer is resvg, which resolves fonts through `fontdb` /
 * `ttf-parser`. Those read **TTF and OTF**. They do not read WOFF, which is a
 * zlib-compressed container around the same sfnt tables — and the failure is
 * silent: resvg loads nothing, finds no family, and renders every glyph as
 * nothing. The result is a valid PNG of the correct size containing only the
 * background. It returns 200. Measured before this existed: a card with text
 * came back byte-identical to a card with none.
 *
 * `@fontsource` publishes `.woff` and `.woff2` and no TTF, so the bytes have to
 * be unwrapped from what is already installed rather than fetched from
 * somewhere new. Barlow is OFL-1.1 and already vendored as a dependency; this
 * changes the container, not the licence or the source.
 *
 * ## The format
 *
 * WOFF is an sfnt with a different header and per-table zlib compression:
 *
 *   header (44 bytes)        signature 'wOFF', flavor, numTables, …
 *   directory (20/table)     tag, offset, compLength, origLength, checksum
 *   table data               zlib-deflated when compLength < origLength
 *
 * Rebuilding the TTF is the inverse: an sfnt header, 16-byte table records, and
 * the inflated data padded to a 4-byte boundary. Offsets are recomputed because
 * the record size differs from WOFF's.
 *
 * Usage:  bun tools/woff-to-ttf.ts <in.woff> <out.ttf>
 */
import { inflateSync } from 'node:zlib'

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error('Usage: bun tools/woff-to-ttf.ts <in.woff> <out.ttf>')
  process.exit(1)
}

const woff = new DataView((await Bun.file(input).arrayBuffer()) as ArrayBuffer)
const bytes = new Uint8Array(woff.buffer)

const signature = String.fromCharCode(...bytes.subarray(0, 4))
if (signature !== 'wOFF') {
  console.error(`${input} is not a WOFF file (signature: ${signature})`)
  process.exit(2)
}

const flavor = woff.getUint32(4)
const numTables = woff.getUint16(12)

type Table = { tag: Uint8Array; checksum: number; data: Uint8Array }
const tables: Table[] = []

for (let i = 0; i < numTables; i++) {
  const entry = 44 + i * 20
  const tag = bytes.subarray(entry, entry + 4)
  const offset = woff.getUint32(entry + 4)
  const compLength = woff.getUint32(entry + 8)
  const origLength = woff.getUint32(entry + 12)
  const checksum = woff.getUint32(entry + 16)

  const raw = bytes.subarray(offset, offset + compLength)
  // Equal lengths mean the table was stored uncompressed.
  const data = compLength === origLength ? raw : new Uint8Array(inflateSync(raw))
  if (data.byteLength !== origLength) {
    console.error(
      `table ${String.fromCharCode(...tag)}: inflated to ${data.byteLength}, expected ${origLength}`
    )
    process.exit(3)
  }
  tables.push({ tag, checksum, data })
}

// sfnt: 12-byte header + 16 bytes per table record, then 4-byte-aligned data.
const headerSize = 12 + numTables * 16
const total = headerSize + tables.reduce((sum, t) => sum + Math.ceil(t.data.byteLength / 4) * 4, 0)

const out = new Uint8Array(total)
const view = new DataView(out.buffer)

// The binary-search hints the sfnt header carries. Wrong values are tolerated by
// most parsers, but they are cheap to get right.
const maxPow2 = 2 ** Math.floor(Math.log2(numTables))
view.setUint32(0, flavor)
view.setUint16(4, numTables)
view.setUint16(6, maxPow2 * 16)
view.setUint16(8, Math.floor(Math.log2(numTables)))
view.setUint16(10, numTables * 16 - maxPow2 * 16)

let dataOffset = headerSize
for (const [i, table] of tables.entries()) {
  const record = 12 + i * 16
  out.set(table.tag, record)
  view.setUint32(record + 4, table.checksum)
  view.setUint32(record + 8, dataOffset)
  view.setUint32(record + 12, table.data.byteLength)
  out.set(table.data, dataOffset)
  dataOffset += Math.ceil(table.data.byteLength / 4) * 4
}

await Bun.write(output, out)
console.log(`${input} -> ${output}  (${numTables} tables, ${bytes.byteLength} -> ${total} bytes)`)
