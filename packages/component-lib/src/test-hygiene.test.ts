import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * The shared test preload is wired into every workspace that depends on it.
 *
 * The bans on re-declaring what that layer gives (a per-file
 * `SalvageUnionReference.preload(...)`, a live clock in an ITUN fixture, a
 * single patched model accessor, a bare `afterEach(cleanup)`) are Biome
 * plugins in `tools/biome/`, matched on the syntax tree rather than by regex.
 * They assume the preload runs; this checks it does.
 *
 * Deliberately lives in component-lib rather than the repo root: `bun run test`
 * runs per workspace, so a root-level test file would never execute.
 */

const REPO_ROOT = resolve(import.meta.dir, '../../..')

/** Workspaces whose `bunfig.toml` preloads the shared root scripts. */
const PRELOADED_WORKSPACES = [
  'apps/itun',
  'apps/srd',
  'packages/component-lib',
  'packages/salvageunion-reference',
  // The bot has no DOM, but it reads reference data.
  'apps/discord-bot',
] as const

describe('test hygiene', () => {
  test('every preloaded workspace really does preload the shared scripts', () => {
    const missing: string[] = []
    for (const workspace of PRELOADED_WORKSPACES) {
      const bunfig = join(REPO_ROOT, workspace, 'bunfig.toml')
      const text = existsSync(bunfig) ? readFileSync(bunfig, 'utf8') : ''
      if (!text.includes('../../test/reference-preload.ts')) missing.push(workspace)
    }
    expect(
      missing,
      'these workspaces do not preload test/reference-preload.ts, which the preload ban assumes'
    ).toEqual([])
  })
})
