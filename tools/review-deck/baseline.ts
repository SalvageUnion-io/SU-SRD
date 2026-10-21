#!/usr/bin/env bun
/**
 * bun tools/review-deck/baseline.ts <published-dir> <baseline-dir>
 *
 * Turns the deck as published (its manifest.json and shots/sheet-NNN.jpg,
 * fetched with the Artifact tool's read) back into a shoot folder, one JPEG
 * per slide and a manifest.jsonl, so `stage.ts` can mark what changed since
 * the last round without the earlier shoot's own files.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const [src, dst] = process.argv.slice(2)
if (!src || !dst) throw new Error('usage: baseline.ts <published-dir> <baseline-dir>')
type Slide = { file: string; w: number; h: number; sheet: number; cell: number }
const { slides } = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8')) as {
  slides: Slide[]
}
mkdirSync(dst, { recursive: true })
const lines: string[] = []
for (const s of slides) {
  const sheet = join(src, 'shots', `sheet-${String(s.sheet).padStart(3, '0')}.jpg`)
  await sharp(sheet)
    .extract({ left: 0, top: s.cell * s.h, width: s.w, height: s.h })
    .jpeg({ quality: 90 })
    .toFile(join(dst, s.file))
  lines.push(JSON.stringify(s))
}
writeFileSync(join(dst, 'manifest.jsonl'), `${lines.join('\n')}\n`)
console.log(`baseline: ${slides.length} slides in ${dst}`)
