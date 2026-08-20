import { describe, expect, test } from 'bun:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Behaviour tests for `tools/check-action-pinning.ts`.
 *
 * These assert the RULE, not the three pins that happened to prompt it: each
 * mutates the real tree, runs the real tool, and restores. A test that only
 * asserted "the committed tree passes" would keep passing if the checker were
 * gutted to `process.exit(0)`.
 */

const ROOT = join(import.meta.dir, '..', '..')
const TOOL = join(ROOT, 'tools', 'check-action-pinning.ts')

async function runCheck() {
  const proc = Bun.spawn(['bun', TOOL], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

async function withFileContents(
  relPath: string,
  mutate: (s: string) => string,
  fn: () => Promise<void>
) {
  const abs = join(ROOT, relPath)
  const original = readFileSync(abs, 'utf-8')
  try {
    writeFileSync(abs, mutate(original))
    await fn()
  } finally {
    writeFileSync(abs, original)
  }
}

describe('check-action-pinning', () => {
  test('passes on the tree as committed', async () => {
    const { exitCode, stdout } = await runCheck()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('SHA-pinned')
  })

  test('fails when a third-party action regresses to a mutable tag', async () => {
    await withFileContents(
      '.github/workflows/release-please.yml',
      (s) =>
        s.replace(
          /googleapis\/release-please-action@[0-9a-f]{40}[^\n]*/,
          'googleapis/release-please-action@v5'
        ),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('release-please-action@v5')
      }
    )
  })

  /**
   * The composite-action half. `oven-sh/setup-bun` does not appear in any
   * workflow — it lives in `.github/actions/setup-bun/action.yml` — so a
   * checker that walked only `workflows/` would report a clean tree while the
   * action installing the toolchain for every job was unpinned. That is the
   * shape the real gap had.
   */
  test('scans composite actions, not just workflows', async () => {
    await withFileContents(
      '.github/actions/setup-bun/action.yml',
      // Target the `uses:` line specifically. An earlier version of this test
      // replaced the first textual match, which was a COMMENT mentioning the
      // action — the checker correctly ignored it and the test failed, which is
      // the comment-stripping working rather than a bug.
      (s) => s.replace(/uses: oven-sh\/setup-bun@[0-9a-f]{40}[^\n]*/, 'uses: oven-sh/setup-bun@v2'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('.github/actions/setup-bun/action.yml')
      }
    )
  })

  /**
   * Control: first-party actions must stay exempt. Without this, a checker that
   * simply demanded a SHA everywhere would pass both failure tests above while
   * being a different, unenforceable rule — 25 `actions/checkout@v7` lines is
   * how a gate gets switched off rather than satisfied.
   */
  test('first-party actions/* and github/* are exempt', async () => {
    const { exitCode } = await runCheck()
    // The committed tree contains many `actions/checkout@v7` and
    // `github/codeql-action@v4.37.6` references, none SHA-pinned.
    expect(exitCode).toBe(0)
  })

  test('a short SHA is not accepted as a pin', async () => {
    await withFileContents(
      '.github/workflows/ci.yml',
      (s) => s.replace(/dorny\/paths-filter@([0-9a-f]{40})[^\n]*/, 'dorny/paths-filter@ceb8a2b'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('paths-filter@ceb8a2b')
      }
    )
  })

  /**
   * A reference named only in prose must not satisfy the scan. These workflows
   * explain themselves at length; a comment-blind checker could be satisfied by
   * commentary after the real `uses:` was deleted.
   */
  test('a commented-out uses: line is ignored', async () => {
    await withFileContents(
      '.github/workflows/ci.yml',
      (s) => `${s}\n# uses: some-vendor/unpinned-action@v1\n`,
      async () => {
        const { exitCode } = await runCheck()
        expect(exitCode).toBe(0)
      }
    )
  })
})
