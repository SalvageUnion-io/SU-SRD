#!/usr/bin/env bun

/**
 * Bun-version drift check (audit item 8).
 *
 * `.bun-version` drives CI (setup-bun reads it via bun-version-file), but the
 * three Netlify sites pin BUN_VERSION independently and root devDeps pin
 * bun-types — these HAD drifted (CI tested 1.3.10 while ITUN production
 * built on 1.3.14), which breaks "test what you ship". This script fails
 * check:all whenever any surface disagrees with .bun-version.
 *
 * su-assets was the third site and had no BUN_VERSION at all, so it silently
 * built on whatever Netlify's default Bun happened to be — invisible to this
 * check, which only knew about two files. It serves the artwork for BOTH
 * production sites, so a Bun it was never tested against is a live risk, not a
 * hygiene point. A site with no pin now fails as `(missing)` rather than being
 * absent from the list.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const expected = readFileSync(join(root, '.bun-version'), 'utf-8').trim()

type Surface = { label: string; actual: string | undefined }

function netlifyBunVersion(tomlPath: string): string | undefined {
  const toml = readFileSync(join(root, tomlPath), 'utf-8')
  return toml.match(/BUN_VERSION\s*=\s*"([^"]+)"/)?.[1]
}

const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as {
  devDependencies?: Record<string, string>
}

const surfaces: Surface[] = [
  {
    label: 'apps/srd/netlify.toml BUN_VERSION',
    actual: netlifyBunVersion('apps/srd/netlify.toml'),
  },
  {
    label: 'apps/itun/netlify.toml BUN_VERSION',
    actual: netlifyBunVersion('apps/itun/netlify.toml'),
  },
  {
    label: 'apps/su-assets/netlify.toml BUN_VERSION',
    actual: netlifyBunVersion('apps/su-assets/netlify.toml'),
  },
  {
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

console.log(
  `✓ Bun ${expected} pinned consistently across CI, all ${surfaces.length - 1} Netlify sites, and bun-types.`
)
