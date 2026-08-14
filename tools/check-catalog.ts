#!/usr/bin/env bun
/**
 * Catalog ratchet — `bun run check:catalog`.
 *
 * `workspaces.catalog` in the root manifest is this repo's single source of
 * truth for the version of any dependency more than one workspace uses: declare
 * it once, reference it everywhere as `"react": "catalog:"`. CLAUDE.md states
 * the rule and calls a version literal for a catalogued package "a bug".
 *
 * Nothing enforced it. The repo is currently clean on all three conditions
 * below — 19 catalog entries, 44 `catalog:` references, zero violations — and
 * that held by hand-discipline alone. The next contributor or agent who adds
 * `"zod": "^4.4.3"` to a second workspace instead of cataloguing it would have
 * got a green CI, and the catalog would quietly stop being the source of truth
 * for that package.
 *
 * Three conditions, each a different way the property breaks:
 *
 *   1. UNCATALOGUED DUPLICATE — the same package pinned in 2+ manifests with a
 *      literal. This is the version written twice.
 *   2. STRAY LITERAL — a package that IS in the catalog, but some workspace
 *      pins it directly anyway. Silently un-shares that dependency, and is the
 *      one a reader is least likely to spot: the catalog still looks correct.
 *   3. ORPHAN ENTRY — a catalog entry with fewer than 2 consumers. Not a
 *      correctness bug, but the catalog is meant to describe SHARED versions,
 *      and an entry nothing shares is a claim that has stopped being true.
 *
 * Deliberately NOT checked here: `overrides` (a separate mechanism that BEATS
 * the catalog — see CLAUDE.md on `@vitejs/plugin-react-swc`, the one package in
 * both), and runtime version pins like `.bun-version`, which
 * `tools/check-bun-version.ts` already reconciles across CI and every deploy
 * target.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertScanFloor } from './lib/scanFloor'

const ROOT = join(import.meta.dir, '..')

/**
 * Every manifest in the workspace, DISCOVERED rather than listed.
 *
 * A hardcoded list is the same defect this repo has been removing elsewhere: a
 * new workspace would silently escape the check while it kept reporting
 * success. (That is not hypothetical — `packages/observability` was added in
 * the same change that made this dynamic.)
 *
 * The floor below is the catastrophe detector for the glob itself, in the shape
 * `tools/lib/scanFloor.ts` documents.
 */
function discoverManifests(): string[] {
  const found = ['package.json']
  for (const dir of ['apps', 'packages']) {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const rel = `${dir}/${entry.name}/package.json`
      if (existsSync(join(ROOT, rel))) found.push(rel)
    }
  }
  return found.sort()
}

const MANIFESTS = discoverManifests()

assertScanFloor('catalog (workspace manifests)', MANIFESTS.length, 6)

type Manifest = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  workspaces?: { catalog?: Record<string, string> }
}

const read = (rel: string): Manifest =>
  JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Manifest

const root = read('package.json')
const catalog = root.workspaces?.catalog ?? {}

if (Object.keys(catalog).length === 0) {
  console.error('✗ catalog: root package.json declares no `workspaces.catalog`.')
  console.error('  Either the field moved or this check is pointed at the wrong file.')
  process.exit(1)
}

/** package name -> manifests that reference it (any dependency block). */
const consumers = new Map<string, string[]>()
/** package name -> manifests that pin it with a literal (not `catalog:`). */
const literals = new Map<string, string[]>()

for (const rel of MANIFESTS) {
  const m = read(rel)
  // peerDependencies are deliberately excluded: a peer RANGE is a compatibility
  // statement rather than a resolved version, so it is a different kind of
  // claim from a dependency pin. (component-lib restates several catalogued
  // versions there; that is tracked separately, not by this rule.)
  for (const block of [m.dependencies, m.devDependencies]) {
    for (const [name, spec] of Object.entries(block ?? {})) {
      // `workspace:*` is the correct form for an internal package and is not a
      // version literal at all.
      if (spec.startsWith('workspace:')) continue
      consumers.set(name, [...(consumers.get(name) ?? []), rel])
      if (!spec.startsWith('catalog:')) {
        literals.set(name, [...(literals.get(name) ?? []), rel])
      }
    }
  }
}

const problems: string[] = []

// 1. Duplicated version literal across manifests, not catalogued.
for (const [name, where] of literals) {
  if (name in catalog) continue
  if (where.length < 2) continue
  problems.push(
    `  ${name} — pinned with a literal in ${where.length} manifests, not in the catalog:\n` +
      where.map((w) => `      ${w}`).join('\n') +
      `\n    Fix: add "${name}" to workspaces.catalog in the root package.json and` +
      ' replace each literal with "catalog:".'
  )
}

// 2. A catalogued package pinned directly anyway.
for (const [name, where] of literals) {
  if (!(name in catalog)) continue
  problems.push(
    `  ${name} — IS catalogued (${catalog[name]}) but pinned with a literal in:\n` +
      where.map((w) => `      ${w}`).join('\n') +
      '\n    Fix: replace the literal with "catalog:". A literal here silently' +
      ' un-shares this dependency while the catalog still looks correct.'
  )
}

// 3. Catalog entry with fewer than two consumers.
for (const name of Object.keys(catalog)) {
  const count = consumers.get(name)?.length ?? 0
  if (count >= 2) continue
  problems.push(
    `  ${name} — in the catalog but referenced by ${count} manifest(s).\n` +
      '    The catalog describes versions that are SHARED. Either a consumer was' +
      ' removed (drop the entry) or one should be referencing it.'
  )
}

if (problems.length > 0) {
  console.error('\n✗ catalog is no longer the single source of truth for these versions:\n')
  console.error(problems.join('\n\n'))
  console.error('\n  See CLAUDE.md, "Shared versions live in the catalog".')
  process.exit(1)
}

const refCount = [...consumers.entries()]
  .filter(([name]) => name in catalog)
  .reduce((n, [, where]) => n + where.length, 0)

console.log(
  `✓ catalog: ${Object.keys(catalog).length} entries, ${refCount} references, no version written twice`
)
