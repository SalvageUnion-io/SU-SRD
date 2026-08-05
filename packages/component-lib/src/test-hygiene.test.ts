import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'
import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * Test-hygiene guard — the executable half of the "don't re-declare what a
 * shared layer already gives you" rules in `.claude/rules/testing-patterns.md`.
 *
 * Every rule here exists because the drift was invisible: the fix landed once,
 * in one shared place, and nothing stopped test files from re-declaring the
 * same thing per-file afterwards. This test is what stops it.
 *
 * 1. `afterEach(cleanup)` — `test/testing-library.ts` already registers an
 *    `act()`-wrapped one for every preload-covered workspace. A bare re-
 *    declaration is a strictly worse duplicate: no `act()` wrap, so it unmounts
 *    without flushing pending React updates.
 * 2. `SalvageUnionReference.preload(...)` — `test/reference-preload.ts` already
 *    loads every schema. `ModelFactory`'s loaded-schema set is module-global and
 *    never reset, so a per-file narrow list can pass purely because a sibling
 *    file loaded everything first.
 * 3. `new Date().toISOString()` in a fixture — `FIXTURE_NOW` already pins one
 *    frozen instant. A live clock in a fixture is a free variable that makes
 *    entities built microseconds apart differ and hides real "did this write
 *    bump `updatedAt`?" bugs.
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
  // The bot has no DOM, so the cleanup rule is vacuous for it — but it reads
  // reference data and had the same per-file `preload('all')` drift (8 files),
  // so it is policed here too.
  'apps/discord-bot',
] as const

/**
 * Files exempt from the `preload(...)` ban, with the reason.
 *
 * Every entry asserts on load behaviour itself: it calls `resetAllForTesting()`
 * and re-preloads on purpose, so the shared preload is the thing under test
 * rather than the thing being duplicated.
 */
const PRELOAD_CALL_ALLOWLIST = new Map<string, string>([
  [
    'apps/srd/src/lib/__tests__/schemaPreloadDeps.test.tsx',
    'resets the ORM and re-preloads to prove narrow schema lists render identically',
  ],
  ['packages/salvageunion-reference/lib/preload.test.ts', 'the preload API is the unit under test'],
  [
    'packages/salvageunion-reference/lib/search.test.ts',
    'resets the ORM to prove preload() invalidates the search index and result cache',
  ],
])

type TestFile = { rel: string; source: string }

/** This guard's own source states both banned patterns literally. */
const SELF = relative(REPO_ROOT, import.meta.path)

const testFiles: TestFile[] = []
for (const workspace of PRELOADED_WORKSPACES) {
  const dir = join(REPO_ROOT, workspace)
  if (!existsSync(dir)) continue
  for (const pattern of ['**/*.test.ts', '**/*.test.tsx']) {
    for (const hit of new Glob(pattern).scanSync({ cwd: dir })) {
      if (hit.includes('node_modules')) continue
      const abs = join(dir, hit)
      const rel = relative(REPO_ROOT, abs)
      if (rel === SELF) continue
      testFiles.push({ rel, source: readFileSync(abs, 'utf8') })
    }
  }
}

/** Strip block and line comments so prose about a rule never trips the rule. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

/**
 * Assigning a single accessor on a `SalvageUnionReference` model, e.g.
 * `Model.all = mock(...)`. Matches the accessor set `BaseModel` exposes.
 */
const PARTIAL_MODEL_PATCH =
  /SalvageUnionReference\.(\w+)\.(all|getById|getByName|getBySlug|find|findAll)\s*=/g

describe('test hygiene', () => {
  test('the guard actually found the test files it is meant to police', () => {
    // A broken glob or a moved workspace would otherwise make this file pass
    // vacuously — the exact failure mode the two rules already suffered.
    expect(testFiles.length).toBeGreaterThan(200)
  })

  test('no test file re-declares afterEach(cleanup)', () => {
    const offenders = testFiles
      .filter(({ source }) =>
        /afterEach\(\s*(cleanup\s*\)|\(\)\s*=>\s*cleanup\(\)\s*\))/.test(stripComments(source))
      )
      .map(({ rel }) => rel)

    expect(
      offenders,
      `${offenders.length} file(s) re-declare afterEach(cleanup). ` +
        'test/testing-library.ts already registers an act()-wrapped one for every ' +
        'preloaded workspace — delete the local hook. See .claude/rules/testing-patterns.md.'
    ).toEqual([])
  })

  test('no test file calls SalvageUnionReference.preload()', () => {
    const offenders = testFiles
      .filter(({ rel }) => !PRELOAD_CALL_ALLOWLIST.has(rel))
      .filter(({ source }) => /SalvageUnionReference\.preload\(/.test(stripComments(source)))
      .map(({ rel }) => rel)

    expect(
      offenders,
      `${offenders.length} file(s) call preload() themselves. ` +
        'test/reference-preload.ts already loads every schema — delete the local call. ' +
        'See .claude/rules/testing-patterns.md.'
    ).toEqual([])
  })

  test('the preload allowlist has no stale entries', () => {
    const known = new Set(testFiles.map(({ rel }) => rel))
    const stale = [...PRELOAD_CALL_ALLOWLIST.keys()].filter((rel) => !known.has(rel))
    expect(stale, 'allowlisted files that no longer exist — drop them').toEqual([])
  })

  test('no test file stamps a live clock into a fixture', () => {
    // Scoped to itun because that is where `FIXTURE_NOW` and the entity
    // factories live; the other workspaces build no persisted entities.
    const offenders = testFiles
      .filter(({ rel }) => rel.startsWith('apps/itun/'))
      .filter(({ source }) => /new Date\(\)\.toISOString\(\)/.test(stripComments(source)))
      .map(({ rel }) => rel)

    expect(
      offenders,
      `${offenders.length} file(s) stamp a live clock into a fixture. ` +
        'Use FIXTURE_NOW from apps/itun/src/components/__tests__/fixtures.ts, or pass an ' +
        'explicit timestamp via overrides when a test genuinely needs a distinct one.'
    ).toEqual([])
  })

  test('every preloaded workspace really does preload the shared scripts', () => {
    const missing: string[] = []
    for (const workspace of PRELOADED_WORKSPACES) {
      const bunfig = join(REPO_ROOT, workspace, 'bunfig.toml')
      const text = existsSync(bunfig) ? readFileSync(bunfig, 'utf8') : ''
      if (!text.includes('../../test/reference-preload.ts')) missing.push(workspace)
    }
    expect(
      missing,
      'these workspaces are policed above but do not preload test/reference-preload.ts'
    ).toEqual([])
  })

  test('no test file patches a single accessor on a reference model', () => {
    // A model is reachable four ways — `all()`, `getById`, `getByName`,
    // `getBySlug` — and the last three read `BaseModel`'s lazily-built index
    // rather than calling `all()`. So patching `all` alone does not replace the
    // model's rows; it replaces ONE route to them. Production code that reaches
    // rows the other way gets the real dataset while the test asserts on
    // fixtures, and the resulting failure reads as a component bug rather than
    // a mocking gap.
    //
    // That is not hypothetical. Converting the crawler lookups from a linear
    // `find(b => b.id === ref || b.name === ref)` to the indexed resolver broke
    // 17 tests across five suites at once, all of which had patched `all` only.
    // Nothing about the production change was wrong — the seam was.
    //
    // `patchModelRows` (test/patchModel.ts, shared across workspaces)
    // patches every accessor, so the seam means "this model contains exactly
    // these rows" rather than "this one method returns this array".
    const offenders: string[] = []
    for (const { rel, source } of testFiles) {
      for (const match of stripComments(source).matchAll(PARTIAL_MODEL_PATCH)) {
        offenders.push(`${rel} — SalvageUnionReference.${match[1]}.${match[2]} =`)
      }
    }
    expect(
      offenders,
      'patch reference-model rows with patchModelRows(model, rows), which covers every accessor'
    ).toEqual([])
  })
})
