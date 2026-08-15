/**
 * The two coverage tools each carry their own workspace list: `run-coverage.ts`
 * decides what gets RUN and verified, `coverage-report.ts` decides what gets
 * SCORED against the baseline. They cannot import from one another —
 * `coverage-report.ts` does its work at module scope, so importing it would run
 * the whole ratchet — so this asserts they agree instead.
 *
 * A drift either way is silent and bad: a workspace in the runner but not the
 * report produces coverage nobody scores, and one in the report but not the
 * runner is scored `(missing)` forever, which is precisely the failure mode the
 * runner exists to prevent.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const toolsDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(toolsDir, '..')

const read = (file: string) => readFileSync(join(toolsDir, file), 'utf-8')

/** Pull the string entries out of a named array literal in a source file. */
function arrayLiteralEntries(source: string, declaration: string): string[] {
  const start = source.indexOf(declaration)
  if (start === -1) throw new Error(`"${declaration}" not found — the tool was renamed or reshaped`)
  const open = source.indexOf('[', start)
  const close = source.indexOf(']', open)
  if (open === -1 || close === -1) throw new Error(`no array literal after "${declaration}"`)
  return [...source.slice(open, close).matchAll(/'([^']+)'/g)].map((m) => m[1] as string)
}

describe('coverage tooling workspace lists', () => {
  const runner = read('run-coverage.ts')
  const report = read('coverage-report.ts')

  // run-coverage's entries are `{ dir, filter }` pairs, so the odd-indexed
  // matches are the filter names; take the directories.
  const runnerDirs = arrayLiteralEntries(runner, 'const WORKSPACES').filter((s) => s.includes('/'))
  const reportDirs = arrayLiteralEntries(report, 'const WORKSPACES')

  it('the report scores a non-empty set of workspaces', () => {
    expect(reportDirs.length).toBeGreaterThan(0)
  })

  it('the runner runs exactly the workspaces the report scores', () => {
    expect([...runnerDirs].sort()).toEqual([...reportDirs].sort())
  })

  it('every listed workspace exists and has a test:coverage script', () => {
    for (const dir of reportDirs) {
      const pkg = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf-8')) as {
        scripts?: Record<string, string>
      }
      expect(pkg.scripts?.['test:coverage']).toBeTruthy()
    }
  })

  it("each runner filter matches its workspace's package name", () => {
    const pairs = [...runner.matchAll(/\{\s*dir:\s*'([^']+)',\s*filter:\s*'([^']+)'\s*\}/g)]
    expect(pairs.length).toBe(reportDirs.length)

    for (const [, dir, filter] of pairs) {
      const pkg = JSON.parse(readFileSync(join(root, dir as string, 'package.json'), 'utf-8')) as {
        name: string
      }
      expect(pkg.name).toBe(filter as string)
    }
  })
})

/**
 * The retry budget and the readability check, asserted against the source text
 * for the same reason as everything above: `run-coverage.ts` does its work at
 * module scope, so importing it would run the whole coverage suite.
 *
 * Both of these are the fix for #818 and both are quiet to regress — a budget
 * trimmed back to 2 looks like tidying, and swapping `wroteCoverage` for a bare
 * `existsSync` looks like simplification. Each would silently restore a failure
 * that costs a re-run on every PR.
 */
describe('run-coverage retry budget (#818)', () => {
  const runner = read('run-coverage.ts')

  it('allows at least 3 attempts before calling a workspace deterministically broken', () => {
    const match = runner.match(/const ATTEMPTS = (\d+)/)
    expect(match, 'ATTEMPTS was renamed or removed').toBeTruthy()
    // 2 was the original budget, and it was exhausted by the intermittent flake
    // on two different workspaces (#816 apps/srd, #820 apps/itun) in one
    // afternoon — which is the whole reason this floor exists.
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(3)
  })

  it('treats an empty lcov.info as no coverage, not as 0% coverage', () => {
    // The truncation shape. `existsSync` alone passes on a zero-byte file, and
    // the ratchet would then score it 0% and fail the build for a coverage
    // collapse that never happened — a worse failure than the one it came from.
    expect(runner).toContain('function wroteCoverage')
    expect(runner).toMatch(/statSync\([^)]*\)\.size > 0/)
  })
})
