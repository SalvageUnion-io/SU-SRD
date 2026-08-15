#!/usr/bin/env bun

/**
 * Bun-version drift check (audit item 8).
 *
 * `.bun-version` drives CI (setup-bun reads it via bun-version-file), but the
 * three Netlify sites pin BUN_VERSION independently and root devDeps pin
 * bun-types — these HAD drifted (CI tested 1.3.10 while ITUN production
 * built on 1.3.14), which breaks "test what you ship". This script fails
 * `bun run check` whenever any surface disagrees with .bun-version.
 *
 * su-assets was the third site and had no BUN_VERSION at all, so it silently
 * built on whatever Netlify's default Bun happened to be — invisible to this
 * check, which only knew about two files. It serves the artwork for BOTH
 * production sites, so a Bun it was never tested against is a live risk, not a
 * hygiene point. A site with no pin now fails as `(missing)` rather than being
 * absent from the list.
 *
 * ## Surfaces are OPTIONAL BY FILE, mandatory by content (ADR-033)
 *
 * The Cloudflare cutover deletes these files one deploy target at a time, and
 * this guard has to keep working across that — before, during and after —
 * without ever being switched off. So each surface is resolved by two distinct
 * questions, and conflating them is what would break it:
 *
 *   - **The file does not exist** → that deploy target is retired. Skip it.
 *   - **The file exists but carries no pin** → misconfiguration. Fail as
 *     `(missing)`, exactly as before.
 *
 * The second rule is the one with an incident behind it (su-assets, above), and
 * it is untouched. Only the first is new. A retired surface is reported in the
 * summary rather than silently dropped, so "0 Netlify sites" has to be read and
 * agreed with rather than passing unnoticed.
 *
 * After the cutover, builds run in GitHub Actions, which reads `.bun-version`
 * directly via setup-bun — so CI cannot drift from it by construction, and
 * `bun-types` becomes the only surface that can.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const expected = readFileSync(join(root, '.bun-version'), 'utf-8').trim()

type Surface = { label: string; actual: string | undefined }

/**
 * A surface backed by a deploy-config file that the cutover may delete.
 *
 * Returns `null` when the file is gone (target retired), and a Surface with
 * `actual: undefined` when the file is present but unpinned (misconfigured) —
 * the distinction this guard now turns on.
 */
function fileSurface(
  label: string,
  relPath: string,
  extract: (contents: string) => string | undefined
): Surface | null {
  const abs = join(root, relPath)
  if (!existsSync(abs)) return null
  return { label, actual: extract(readFileSync(abs, 'utf-8')) }
}

function netlifyBunVersion(contents: string): string | undefined {
  return contents.match(/BUN_VERSION\s*=\s*"([^"]+)"/)?.[1]
}

/** render.yaml's `- key: BUN_VERSION` / `value:` pair (YAML, so no quotes). */
function renderBunVersion(contents: string): string | undefined {
  return contents.match(/-\s*key:\s*BUN_VERSION\s*\n\s*value:\s*["']?([^"'\s]+)["']?/)?.[1]
}

const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as {
  devDependencies?: Record<string, string>
}

const retirable: Array<Surface | null> = [
  fileSurface('apps/srd/netlify.toml BUN_VERSION', 'apps/srd/netlify.toml', netlifyBunVersion),
  fileSurface('apps/itun/netlify.toml BUN_VERSION', 'apps/itun/netlify.toml', netlifyBunVersion),
  fileSurface(
    'apps/su-assets/netlify.toml BUN_VERSION',
    'apps/su-assets/netlify.toml',
    netlifyBunVersion
  ),
  // Render builds the Discord bot's shipped bundle with `bun build`, so it is
  // the one deploy target whose Bun version affects an ARTIFACT rather than
  // just a static build — and it was the only one this check did not cover.
  // Same failure mode the su-assets note above describes: unpinned means
  // "whatever the image ships", silently.
  fileSurface('render.yaml BUN_VERSION', 'render.yaml', renderBunVersion),
]

const retiredCount = retirable.filter((s) => s === null).length

const surfaces: Surface[] = [
  ...retirable.filter((s): s is Surface => s !== null),
  {
    // Not retirable: this repository always has a root manifest, so `bun-types`
    // is the one surface that survives the cutover and can still drift.
    label: 'root package.json devDependencies.bun-types',
    actual: rootPkg.devDependencies?.['bun-types'],
  },
]

const drifted = surfaces.filter((s) => s.actual !== expected)

if (drifted.length > 0) {
  console.error(`✗ Bun version drift — .bun-version pins ${expected}, but:`)
  for (const s of drifted) console.error(`    ${s.label} = ${s.actual ?? '(missing)'}`)
  console.error('  → update the drifted surface(s) or bump .bun-version everywhere together.')
  process.exit(1)
}

// Counted from the surface list rather than hard-coded, so adding a surface
// above cannot silently make this sentence wrong (it previously derived the
// Netlify-site count from `surfaces.length`, which broke the moment a
// non-Netlify surface joined the list).
const netlifySites = surfaces.filter((s) => s.label.includes('netlify.toml')).length
const retired = retiredCount > 0 ? ` (${retiredCount} deploy surface(s) retired)` : ''
console.log(
  `✓ Bun ${expected} pinned consistently across CI, ${netlifySites} Netlify site(s), ` +
    `${surfaces.length} surface(s) total${retired}.`
)
