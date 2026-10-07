/**
 * The GritQL plugins in `tools/biome/` and the component-lib function-size cap
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

const REPO = join(import.meta.dir, '..', '..')
const BIOME = join(REPO, 'node_modules', '.bin', 'biome')
const CONFIG = readFileSync(join(REPO, 'biome.jsonc'), 'utf8')

const capMatch = CONFIG.match(/"noExcessiveLinesPerFunction":\s*\{[^}]*"maxLines":\s*(\d+)/)
if (!capMatch) throw new Error('biome.jsonc no longer sets noExcessiveLinesPerFunction maxLines')
const CAP = Number(capMatch[1])

const bigFunction = `export function big(f: () => void) {\n${'  f()\n'.repeat(CAP + 50)}}\n`

const SOURCE = 'apps/itun/src/__biome_fixture__/x.ts'
const TEST_FILE = 'apps/itun/src/__biome_fixture__/x.test.tsx'
const BIG_LIB = 'packages/component-lib/src/__biome_fixture__/big.tsx'
const BIG_APP = 'apps/itun/src/__biome_fixture__/big.tsx'

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
    '',
  ].join('\n'),
  [BIG_LIB]: bigFunction,
  [BIG_APP]: bigFunction,
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
  mkdirSync(join(root, 'tools', 'biome'), { recursive: true })
  for (const grit of readdirSync(join(REPO, 'tools', 'biome'))) {
    copyFileSync(join(REPO, 'tools', 'biome', grit), join(root, 'tools', 'biome', grit))
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

describe('noExcessiveLinesPerFunction', () => {
  const rule = 'lint/complexity/noExcessiveLinesPerFunction'

  test(`fires on a function over the ${CAP}-line cap in component-lib`, () => {
    expect(flagged(BIG_LIB, rule)).toEqual([1])
  })

  test('does not apply outside component-lib', () => {
    expect(flagged(BIG_APP, rule)).toEqual([])
  })
})
