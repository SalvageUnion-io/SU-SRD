#!/usr/bin/env bun
/**
 * bun tools/review-deck/stage.ts <shots-dir> <stage-dir> <commit> [baseline-dir…]
 *
 * Lays out the "SalvageUnion.io 4.0 review" artifact folder: index.html (the
 * review page, deck.html), manifest.json, and the shots stacked four to a
 * JPEG in shots/sheet-NNN.jpg (a version holds at most 511 files; plain image
 * files load wherever the page is opened, inside Claude or in a browser).
 * Each slide whose screen has a shot in a baseline (same view, same depth) is
 * marked `changed` when the two differ by more than a hair.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const [src, dst, commit, ...baselines] = process.argv.slice(2)
if (!src || !dst || !commit) throw new Error('usage: stage.ts <shots> <stage> <commit> [baseline…]')
/** Shots per sheet: a version holds at most 511 files, the site ~900 shots. */
const CELLS = 4

type Slide = { file: string; key: string; changed?: boolean | null }
const slides = readFileSync(join(src, 'manifest.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Slide)

// The latest earlier shot of each screen at each scroll depth, a later
// baseline winning: the same view (its file name less the number and the
// shot index) scrolled to the same place.
const viewOf = (file: string) => file.replace(/^\d+-/, '').replace(/-\d+\.jpg$/, '')
const base = new Map<string, string>()
for (const dir of baselines) {
  for (const line of readFileSync(join(dir, 'manifest.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)) {
    const b = JSON.parse(line) as { file: string; scroll: number }
    base.set(`${viewOf(b.file)}@${b.scroll}`, join(dir, b.file))
  }
}

/** Mean absolute difference per channel (0-255) at an eighth of the size, where a dashed outline washes out. */
async function difference(a: string, b: string): Promise<number> {
  const metaA = await sharp(a).metadata()
  const metaB = await sharp(b).metadata()
  if (metaA.width !== metaB.width || metaA.height !== metaB.height) return 255
  const w = Math.max(1, Math.round((metaA.width ?? 1) / 8))
  const h = Math.max(1, Math.round((metaA.height ?? 1) / 8))
  const small = (p: string) => sharp(p).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer()
  const [ra, rb] = await Promise.all([small(a), small(b)])
  let sum = 0
  for (let i = 0; i < ra.length; i++) sum += Math.abs((ra[i] ?? 0) - (rb[i] ?? 0))
  return sum / ra.length
}

mkdirSync(join(dst, 'shots'), { recursive: true })
type Sized = Slide & { w: number; h: number; sheet?: number; cell?: number; cells?: number }
const sheets: Sized[][] = []
let changed = 0
for (const raw of slides) {
  const s = raw as Sized
  const file = join(src, s.file)
  const meta = await sharp(file).metadata()
  s.w = meta.width ?? 0
  s.h = meta.height ?? 0
  const was = base.get(`${viewOf(s.file)}@${(s as unknown as { scroll: number }).scroll}`)
  if (was && existsSync(was)) {
    const d = await difference(file, was)
    s.changed = d > 3
    if (s.changed) changed++
  } else s.changed = null
  const last = sheets[sheets.length - 1]
  const head = last?.[0]
  if (last && head && last.length < CELLS && head.w === s.w && head.h === s.h) last.push(s)
  else sheets.push([s])
}
// Each sheet: its shots stacked, one JPEG; the page shows one cell of it.
for (const [index, group] of sheets.entries()) {
  const head = group[0]
  if (!head) continue
  const { w, h } = head
  await sharp({
    create: { width: w, height: h * group.length, channels: 3, background: '#ffffff' },
  })
    .composite(group.map((g, i) => ({ input: join(src, g.file), top: i * h, left: 0 })))
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(join(dst, 'shots', `sheet-${String(index).padStart(3, '0')}.jpg`))
  group.forEach((g, i) => {
    g.sheet = index
    g.cell = i
    g.cells = group.length
  })
}
copyFileSync(join(import.meta.dir, 'deck.html'), join(dst, 'index.html'))
writeFileSync(
  join(dst, 'manifest.json'),
  JSON.stringify({ commit, shotAt: new Date().toISOString(), slides })
)
console.log(
  `slides ${slides.length} · sheets ${sheets.length} · changed ${changed} · baselined ${slides.filter((s) => s.changed !== null).length}`
)
