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
