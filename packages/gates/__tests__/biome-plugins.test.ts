/**
 * The GritQL plugins in `packages/gates/biome/` and the app's function-size cap
 * are wired up by `includes` globs in biome.jsonc, and the real tree is clean.
 * A bad glob, or a Biome update that changes how plugins match, would make a
 * rule check nothing while `bun run check`
 * stays green. These lint fixture files and assert each rule still fires.
 *
 * The fixtures go in a throwaway copy of the repo's layout: biome.jsonc and the
 * .grit files copied byte for byte, with each fixture at the same relative path
 * it would have in the repo. Writing them into the real tree would put
 * deliberate violations in front of the `biome`, `typecheck` and `knip` gates
 * that `bun run check` and pre-push run alongside this suite. Biome's stdin
 * mode is not an option: it reports no plugin diagnostics.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const REPO = join(import.meta.dir, '..', '..', '..')
const BIOME = join(REPO, 'node_modules', '.bin', 'biome')
const CONFIG = readFileSync(join(REPO, 'biome.jsonc'), 'utf8')

/** The `noExcessiveLinesPerFunction` cap in the override whose `includes` opens with `glob`. */
function capFor(glob: string): number {
  const escaped = glob.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = CONFIG.match(
    new RegExp(
      `"includes":\\s*\\[\\s*"${escaped}"[^\\]]*\\][^{]*\\{[^{]*\\{[^{]*\\{\\s*"noExcessiveLinesPerFunction":\\s*\\{[^}]*"maxLines":\\s*(\\d+)`
    )
  )
  if (!match) throw new Error(`biome.jsonc no longer caps function length for ${glob}`)
  return Number(match[1])
}
const CAP = capFor('apps/web/**')

/** A function Biome counts as `lines` long: it counts the lines between the braces. */
const bigFunction = (lines: number) =>
  `export function big(f: () => void) {\n${'  f()\n'.repeat(lines)}}\n`

const SOURCE = 'apps/web/src/__biome_fixture__/x.ts'
const TEST_FILE = 'apps/web/src/__biome_fixture__/x.test.tsx'
/** A test file outside the app, where a live clock is not banned. */
const OTHER_TEST = 'tools/__biome_fixture__/y.test.ts'
/** A file that asserts on load behaviour, excluded from the preload ban by path. */
const EXEMPT_TEST = 'packages/salvageunion-reference/lib/__tests__/preload.test.ts'
const BIG_LIB = 'apps/web/src/components/__biome_fixture__/big.tsx'
/** A Convex function file, where collecting the Change Log is banned. */
const CONVEX = 'apps/web/convex/__biome_fixture__/z.ts'
const BIG_APP = 'apps/web/src/routes/__biome_fixture__/big.tsx'
/** A function exactly at the cap. */
const AT_CAP_APP = 'apps/web/src/routes/__biome_fixture__/atCap.tsx'
const BIG_CONVEX = 'apps/web/convex/__biome_fixture__/big.ts'
const BIG_APP_TEST = 'apps/web/src/routes/__biome_fixture__/big.test.tsx'
/** A workspace with no function cap. */
const BIG_SRD = 'apps/discord-bot/src/__biome_fixture__/big.ts'
/** The route error screen, whose development-only dump is exempt from the raw-message ban. */
const ROUTE_ERRORS = 'apps/web/src/components/shared/RouteErrors.tsx'

const FIXTURES: Record<string, string> = {
  [SOURCE]: [
    'declare const SalvageUnionReference: any',
    'export const all = SalvageUnionReference.Chassis.all()', // 2: flagged
    "export const hit = SalvageUnionReference.search('x')", // 3: flagged
    "SalvageUnionReference.preload('all')",
    'SalvageUnionReference.isLoaded()',
    'export function inFunction() {',
    '  return SalvageUnionReference.Chassis.all()',
    '}',
    "export const inArrow = () => SalvageUnionReference.search('x')",
    'export const hp = (p: { currentDamage?: number }, max: number) => p.currentDamage ?? max', // 10: flagged
    "export const label = (p: { currentName?: string }) => p.currentName ?? 'none'",
    "export const shown = (err: unknown) => (err instanceof Error ? err.message : 'x')", // 12: flagged
    "export const mixed = (a: unknown, b: Error) => (a instanceof Error ? b.message : 'x')",
    "export const tab = () => window.open('/systems/red-laser', '_blank')", // 14: flagged
    "export const global = () => globalThis.open('/systems/red-laser')", // 15: flagged
    'export const opener = window.open', // 16: flagged
    'export const own = (dialog: { open: () => void }) => dialog.open()',
    'export const href = window.location.href',
    '',
  ].join('\n'),
  [ROUTE_ERRORS]: [
    "export const dump = (error: unknown) => (error instanceof Error ? error.message : 'x')",
    '',
  ].join('\n'),
  [TEST_FILE]: [
    "import { cleanup } from '@testing-library/react'",
    "import { afterEach } from 'bun:test'",
    'declare function reset(): void',
    'afterEach(cleanup)', // 4: flagged
    'afterEach(() => {', // 5: flagged
    '  cleanup()',
    '})',
    'afterEach(() => {',
    '  cleanup()',
    '  reset()',
    '})',
    'declare const SalvageUnionReference: any',
    "SalvageUnionReference.preload(['chassis'])", // 13: flagged
    'SalvageUnionReference.Chassis.all = () => []', // 14: flagged
    'SalvageUnionReference.Chassis.label = "x"',
    'export const stamp = new Date().toISOString()', // 16: flagged
    'export const fixed = new Date(0).toISOString()',
    "export const log = (ctx: any) => ctx.db.query('changeLog').collect()",
    "export const said = (err: unknown) => (err instanceof Error ? err.message : 'x')",
    '',
  ].join('\n'),
  [CONVEX]: [
    'declare const ctx: any',
    "export const all = ctx.db.query('changeLog').collect()", // 2: flagged
    'export const indexed = ctx.db', // 3: flagged
    "  .query('changeLog')",
    "  .withIndex('by_game_state', (q: any) => q.eq('gameId', 1))",
    '  .collect()',
    "export const newest = ctx.db.query('changeLog').order('desc').take(10)",
    "export const games = ctx.db.query('games').collect()",
    '',
  ].join('\n'),
  [OTHER_TEST]: [
    'declare const SalvageUnionReference: any',
    "SalvageUnionReference.preload(['chassis'])", // 2: flagged
    'export const stamp = new Date().toISOString()',
    "export const tab = () => window.open('/')",
    '',
  ].join('\n'),
  [EXEMPT_TEST]: [
    'declare const SalvageUnionReference: any',
    "SalvageUnionReference.preload('all')",
    '',
  ].join('\n'),
  [BIG_LIB]: bigFunction(CAP + 1),
  [BIG_APP]: bigFunction(CAP + 1),
  [AT_CAP_APP]: bigFunction(CAP),
  [BIG_CONVEX]: bigFunction(CAP + 1),
  [BIG_APP_TEST]: bigFunction(CAP + 1),
  [BIG_SRD]: bigFunction(CAP + 1),
}

type Diagnostic = {
  category: string
  message: string
  location: { path: string; start: { line: number } }
}

let root = ''
let diagnostics: Diagnostic[] = []

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'biome-plugins-'))
  writeFileSync(join(root, 'biome.jsonc'), CONFIG)
  mkdirSync(join(root, 'packages', 'gates', 'biome'), { recursive: true })
  for (const grit of readdirSync(join(REPO, 'packages', 'gates', 'biome'))) {
    copyFileSync(
      join(REPO, 'packages', 'gates', 'biome', grit),
      join(root, 'packages', 'gates', 'biome', grit)
    )
  }
  for (const [rel, text] of Object.entries(FIXTURES)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  const proc = Bun.spawnSync(
    [BIOME, 'lint', '--reporter=json', '--max-diagnostics=none', ...Object.keys(FIXTURES)],
    { cwd: root, stdout: 'pipe', stderr: 'pipe' }
  )
  const out = proc.stdout.toString()
  const start = out.indexOf('{')
  if (start === -1)
    throw new Error(`biome printed no JSON report:\n${out}\n${proc.stderr.toString()}`)
  diagnostics = (JSON.parse(out.slice(start)) as { diagnostics: Diagnostic[] }).diagnostics
})

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

/** Lines in `path` carrying a diagnostic of `category` whose message starts with `prefix`. */
function flagged(path: string, category: string, prefix = ''): number[] {
  return diagnostics
    .filter(
      (d) => d.location.path === path && d.category === category && d.message.startsWith(prefix)
    )
    .map((d) => d.location.start.line)
    .sort((a, b) => a - b)
}

describe('noModuleScopeReferenceCall', () => {
  test('flags accessor calls at module scope, not inside a function or preload()/isLoaded()', () => {
    expect(flagged(SOURCE, 'plugin', 'This SalvageUnionReference call')).toEqual([2, 3])
  })

  test('its message reads as written (no escape sequences mangled by GritQL)', () => {
    const message =
      diagnostics.find((d) => d.message.startsWith('This SalvageUnionReference call'))?.message ??
      ''
    expect(message).toContain("throws 'Schema not loaded'")
    expect(message).not.toMatch(/[\t\n\r]/)
  })
})

describe('noInlinePoolDefault', () => {
  test('flags `p.currentX ?? max` and passes a string fallback', () => {
    expect(flagged(SOURCE, 'plugin', 'This inlines the unset-pool default')).toEqual([10])
  })
})

describe('noBareCleanupHook', () => {
  test('flags afterEach(cleanup) in both shapes, not a hook that does more', () => {
    expect(flagged(TEST_FILE, 'plugin', 'Delete this hook')).toEqual([4, 5])
  })
})

describe('noTestReferencePreload', () => {
  test('flags a test file preloading for itself, except the files that test loading', () => {
    expect(flagged(TEST_FILE, 'plugin', 'Delete this preload')).toEqual([13])
    expect(flagged(OTHER_TEST, 'plugin', 'Delete this preload')).toEqual([2])
    expect(flagged(EXEMPT_TEST, 'plugin', 'Delete this preload')).toEqual([])
  })
})

describe('noPartialModelPatch', () => {
  test('flags assigning one accessor on a reference model, not any other property', () => {
    expect(flagged(TEST_FILE, 'plugin', 'Patch reference-model rows')).toEqual([14])
  })
})

describe('noLiveClockFixture', () => {
  test('flags a live clock in an app test, not a fixed date or another workspace', () => {
    expect(flagged(TEST_FILE, 'plugin', 'Use FIXTURE_NOW')).toEqual([16])
    expect(flagged(OTHER_TEST, 'plugin', 'Use FIXTURE_NOW')).toEqual([])
  })
})

describe('noChangeLogCollect', () => {
  test('flags collecting the Change Log in a Convex function, not take() or another table', () => {
    expect(flagged(CONVEX, 'plugin', 'Do not collect the Change Log')).toEqual([2, 3])
  })

  test('does not apply to tests, which read their own fixture rows', () => {
    expect(flagged(TEST_FILE, 'plugin', 'Do not collect the Change Log')).toEqual([])
  })
})

describe('noRawErrorMessage', () => {
  test("flags showing a caught error's own message in the app's source, not a mismatched pair", () => {
    expect(flagged(SOURCE, 'plugin', 'Do not show a caught error')).toEqual([12])
  })

  test('does not apply to tests or the development-only route error dump', () => {
    expect(flagged(TEST_FILE, 'plugin', 'Do not show a caught error')).toEqual([])
    expect(flagged(ROUTE_ERRORS, 'plugin', 'Do not show a caught error')).toEqual([])
  })
})

describe('noWindowOpen', () => {
  test('flags window.open and globalThis.open in the app, not an own open() or another window member', () => {
    expect(flagged(SOURCE, 'plugin', 'Never open a new tab')).toEqual([14, 15, 16])
  })

  test('does not apply outside the app', () => {
    expect(flagged(OTHER_TEST, 'plugin', 'Never open a new tab')).toEqual([])
  })
})

describe('noExcessiveLinesPerFunction', () => {
  const rule = 'lint/complexity/noExcessiveLinesPerFunction'

  test(`fires on a function over the ${CAP}-line cap anywhere in the app and its Convex backend`, () => {
    expect(flagged(BIG_LIB, rule)).toEqual([1])
    expect(flagged(BIG_APP, rule)).toEqual([1])
    expect(flagged(BIG_CONVEX, rule)).toEqual([1])
  })

  test('a function exactly at the cap passes', () => {
    expect(flagged(AT_CAP_APP, rule)).toEqual([])
  })

  test('does not apply to a test or an uncapped workspace', () => {
    expect(flagged(BIG_APP_TEST, rule)).toEqual([])
    expect(flagged(BIG_SRD, rule)).toEqual([])
  })
})
