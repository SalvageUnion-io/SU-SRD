#!/usr/bin/env bun
/**
 * Generated-file drift — `bun run check generated`.
 *
 * Several committed files are machine output: the reference package's JSON
 * schemas, docs, registry and API report (`bun run build:package`), the VS Code
 * schema map, and ITUN's `src/routeTree.gen.ts`. Each is regenerated here and
 * then compared with what is committed. A stale one fails.
 *
 * ## Why one tool
 *
 * This used to be checked three different ways. Local `check:schemas` ran
 * `git diff` only, so a generator that emitted a NEW file passed locally and
 * failed in CI, whose inline step also listed untracked files. And the route
 * tree was checked only inline in CI's `build-itun` job, after a full Vite
 * build — never by `bun run check`, never on pre-push. Three spellings of one
 * question answered it three ways. CI, lefthook and `bun run check` now all run
 * this file.
 *
 * ## What it does, in order
 *
 *   1. `bun run build` in packages/salvageunion-reference (every generator).
 *   2. `bun apps/itun/scripts/generate-route-tree.ts` — the router plugin's own
 *      generator with the Vite config's options, without a build.
 *   3. Fails on any tracked change OR untracked file under GENERATED_PATHS.
 *
 * It WRITES those files — that is how the diff is produced — so it must run
 * before anything that reads them (`tools/check.ts` runs it first, alone).
 *
 * Usage: bun tools/check-generated.ts
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

/** Every committed path a generator below writes. */
export const GENERATED_PATHS = [
  'packages/salvageunion-reference/schemas',
  'packages/salvageunion-reference/docs',
  'packages/salvageunion-reference/lib/generated',
  'packages/salvageunion-reference/lib/index.ts',
  'packages/salvageunion-reference/etc',
  '.vscode/settings.json',
  'apps/itun/src/routeTree.gen.ts',
] as const

const GENERATORS: { label: string; cmd: string[]; cwd: string }[] = [
  {
    label: 'salvageunion-reference build',
    cmd: ['bun', 'run', 'build'],
    cwd: 'packages/salvageunion-reference',
  },
  {
    label: 'itun route tree',
    cmd: ['bun', 'scripts/generate-route-tree.ts'],
    cwd: 'apps/itun',
  },
]

export type Drift = { changed: string[]; untracked: string[] }

/** Parse `git status --porcelain` output into changed and untracked paths. */
export function parsePorcelain(output: string): Drift {
  const changed: string[] = []
  const untracked: string[] = []
  for (const line of output.split('\n')) {
    if (line.length < 4) continue
    const path = line.slice(3)
    if (line.startsWith('??')) untracked.push(path)
    else changed.push(path)
  }
  return { changed, untracked }
}

function run(cmd: string[], cwd: string): { status: number; output: string } {
  const [bin, ...args] = cmd
  const r = spawnSync(bin as string, args, { cwd: join(ROOT, cwd), encoding: 'utf8' })
  return { status: r.status ?? 1, output: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

function main(): void {
  for (const gen of GENERATORS) {
    const r = run(gen.cmd, gen.cwd)
    if (r.status !== 0) {
      console.error(`✗ generated files: the ${gen.label} generator failed (exit ${r.status})\n`)
      console.error(r.output)
      process.exit(1)
    }
  }
  const status = run(
    ['git', 'status', '--porcelain', '--untracked-files=all', '--', ...GENERATED_PATHS],
    '.'
  )
  if (status.status !== 0) {
    console.error(`✗ generated files: git status failed\n${status.output}`)
    process.exit(1)
  }
  const { changed, untracked } = parsePorcelain(status.output)
  if (changed.length === 0 && untracked.length === 0) {
    console.log(
      `✓ generated files: ${GENERATORS.length} generators re-run, ${GENERATED_PATHS.length} paths match what is committed`
    )
    return
  }
  console.error('✗ generated files are stale — the generators produced a different tree:\n')
  for (const p of changed) console.error(`    changed    ${p}`)
  for (const p of untracked) console.error(`    untracked  ${p}   (a new file nothing committed)`)
  console.error(
    '\n  They were regenerated in place just now; review the diff and commit it.\n' +
      '  Never hand-edit these — change the generator or its source instead.'
  )
  process.exit(1)
}

if (import.meta.main) main()
