import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Behaviour tests for `tools/check-bun-version.ts`.
 *
 * These exist because ADR-033 deletes this guard's inputs one deploy target at
 * a time, and the guard had to learn the difference between "that target is
 * retired" and "that target is misconfigured". Without a test, the cheap way to
 * make a red guard green during the cutover is to widen the skip — which is
 * precisely the failure this guard was written to prevent (su-assets shipped
 * with no BUN_VERSION at all and nothing noticed).
 *
 * So both halves are asserted: a MISSING FILE must be tolerated, and a PRESENT
 * FILE WITHOUT A PIN must still fail. A change that makes the second case pass
 * has broken the guard, not fixed it.
 *
 * Each case mutates the real tree and restores it, for the same reason
 * check-catalog.test.ts does: the tool's job is to read *these* files, and a
 * fixture copy would not prove it is pointed at them.
 */

const ROOT = join(import.meta.dir, '..', '..')
const TOOL = join(ROOT, 'tools', 'check-bun-version.ts')

async function runCheck() {
  const proc = Bun.spawn(['bun', TOOL], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

/** Run `fn` with `relPath` temporarily rewritten, then restore it verbatim. */
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

/** Run `fn` with `relPath` temporarily moved aside, then restore it. */
async function withFileAbsent(relPath: string, fn: () => Promise<void>) {
  const abs = join(ROOT, relPath)
  const stash = `${abs}.check-bun-version-test-stash`
  renameSync(abs, stash)
  try {
    await fn()
  } finally {
    if (existsSync(stash)) renameSync(stash, abs)
  }
}

describe('check-bun-version', () => {
  test('passes on the tree as committed', async () => {
    const { exitCode, stdout } = await runCheck()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('pinned consistently')
  })

  test('fails when a deploy config exists but carries no pin', async () => {
    await withFileContents(
      'apps/srd/netlify.toml',
      (s) => s.replace(/BUN_VERSION\s*=\s*"[^"]+"/, 'NOT_THE_PIN = "x"'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('apps/srd/netlify.toml BUN_VERSION = (missing)')
      }
    )
  })

  test('fails when a deploy config pins a different version', async () => {
    await withFileContents(
      'render.yaml',
      (s) => s.replace(/(-\s*key:\s*BUN_VERSION\s*\n\s*value:\s*)["']?[^"'\s]+["']?/, '$10.0.1'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('render.yaml BUN_VERSION = 0.0.1')
      }
    )
  })

  test('tolerates a retired deploy target — the file being gone', async () => {
    await withFileAbsent('render.yaml', async () => {
      const { exitCode, stdout } = await runCheck()
      expect(exitCode).toBe(0)
      expect(stdout).toContain('1 deploy surface(s) retired')
    })
  })

  test('still reports the surviving Netlify sites after one is retired', async () => {
    await withFileAbsent('apps/su-assets/netlify.toml', async () => {
      const { exitCode, stdout } = await runCheck()
      expect(exitCode).toBe(0)
      expect(stdout).toContain('2 Netlify site(s)')
    })
  })
})
