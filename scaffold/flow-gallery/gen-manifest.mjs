#!/usr/bin/env node
/*
 * THROWAWAY DEV SCAFFOLD — Slice H (#239).
 *
 * Generates `manifest.json` from the PNGs in `./shots/`. The gallery
 * (`index.html`) fetches that manifest to build the walkthrough. Run this after
 * copying the slice-G capture output into `./shots/` (see README.md).
 *
 * Zero dependencies — plain Node ESM. NOT a TypeScript file and NOT inside any
 * workspace, so it is invisible to the monorepo's typecheck / lint / knip.
 *
 * Usage:
 *   node scaffold/flow-gallery/gen-manifest.mjs
 *
 * >>> REMOVAL NOTE (delete before #239 merges): part of the throwaway scaffold;
 * >>> delete the whole scaffold/flow-gallery/ directory.
 */

import { readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS_DIR = join(HERE, 'shots')
const OUT = join(HERE, 'manifest.json')

// Slice-G shots are named "<NN>-<flow>-<step...>-<desktop-1440|mobile-375>.png".
// Examples: 00-dev-flow-index-desktop-1440.png, 05-pilot-sheet-mobile-375.png.
const VIEWPORTS = {
  'desktop-1440': 'Desktop (1440px)',
  'mobile-375': 'Mobile (375px)',
}

// Map the numeric prefix / keyword to a human flow group + ordering.
function classify(base) {
  const lower = base.toLowerCase()
  if (lower.includes('dashboard') || lower.startsWith('00') || lower.includes('dev-flow'))
    return { flow: 'Overview', order: 0 }
  if (lower.includes('pilot')) return { flow: 'Pilot', order: 1 }
  if (lower.includes('mech')) return { flow: 'Mech', order: 2 }
  if (lower.includes('crawler')) return { flow: 'Crawler', order: 3 }
  if (lower.includes('snapshot') || lower.startsWith('08')) return { flow: 'Snapshot', order: 4 }
  return { flow: 'Other', order: 9 }
}

function titleize(s) {
  return s
    .replace(/^\d+[-_]?/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

let files
try {
  files = readdirSync(SHOTS_DIR).filter((f) => f.toLowerCase().endsWith('.png'))
} catch {
  console.error(
    `[gen-manifest] No shots dir at ${SHOTS_DIR}.\n` +
      `Copy the slice-G capture output in first (see README.md), e.g.:\n` +
      `  cp ../../apps/in-the-union-now/.tmp-shots/flow-gallery/*.png shots/`
  )
  process.exit(1)
}

if (files.length === 0) {
  console.error(`[gen-manifest] ${SHOTS_DIR} is empty — nothing to build.`)
  process.exit(1)
}

// Group PNGs into steps keyed by the "<NN>-<flow>-<step>" stem, pairing the two
// viewports under one step entry.
const steps = new Map()
for (const file of files.sort()) {
  const noExt = file.replace(/\.png$/i, '')
  const vpKey = Object.keys(VIEWPORTS).find((vp) => noExt.endsWith(`-${vp}`))
  const stem = vpKey ? noExt.slice(0, -(vpKey.length + 1)) : noExt
  const viewport = vpKey ?? 'unknown'
  if (!steps.has(stem)) {
    const { flow, order } = classify(stem)
    steps.set(stem, { stem, flow, order, label: titleize(stem), shots: [] })
  }
  steps.get(stem).shots.push({
    file: `shots/${file}`,
    viewport,
    viewportLabel: VIEWPORTS[viewport] ?? viewport,
  })
}

// Assemble flows in display order, steps sorted by their numeric prefix / stem.
const byFlow = new Map()
for (const step of steps.values()) {
  if (!byFlow.has(step.flow))
    byFlow.set(step.flow, { flow: step.flow, order: step.order, steps: [] })
  // Order viewports desktop-first for a stable layout.
  step.shots.sort(
    (a, b) => (a.viewport === 'desktop-1440' ? -1 : 1) - (b.viewport === 'desktop-1440' ? -1 : 1)
  )
  byFlow.get(step.flow).steps.push(step)
}

const flows = [...byFlow.values()]
  .sort((a, b) => a.order - b.order)
  .map((f) => ({
    flow: f.flow,
    steps: f.steps.sort((a, b) => a.stem.localeCompare(b.stem)),
  }))

const manifest = {
  generatedAt: new Date().toISOString(),
  totalShots: files.length,
  flows,
}

writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n')
console.log(`[gen-manifest] Wrote ${OUT} (${files.length} shots, ${flows.length} flows).`)
