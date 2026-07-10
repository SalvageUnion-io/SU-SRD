#!/usr/bin/env bun

/**
 * Bun-version drift check (audit item 8).
 *
 * `.bun-version` drives CI (setup-bun reads it via bun-version-file), but the
 * two Netlify sites pin BUN_VERSION independently and root devDeps pin
 * bun-types — these HAD drifted (CI tested 1.3.10 while ITUN production
 * built on 1.3.14), which breaks "test what you ship". This script fails
 * check:all whenever any surface disagrees with .bun-version.
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
    label: 'apps/suref-web/netlify.toml BUN_VERSION',
    actual: netlifyBunVersion('apps/suref-web/netlify.toml'),
  },
  {
    label: 'apps/in-the-union-now/netlify.toml BUN_VERSION',
    actual: netlifyBunVersion('apps/in-the-union-now/netlify.toml'),
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

console.log(`✓ Bun ${expected} pinned consistently across CI, both Netlify sites, and bun-types.`)
