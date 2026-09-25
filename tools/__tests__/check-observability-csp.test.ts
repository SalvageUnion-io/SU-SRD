import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Behaviour tests for the CSP half of `tools/check-observability.ts`.
 *
 * This is the check whose absence let a fully-built Sentry stack sit dark in
 * production: a `connect-src` missing the ingest origin blocks every event in
 * the browser while the app looks completely healthy. Each app's
 * `public/_headers` is its only CSP source, so it must exist, declare a
 * `connect-src`, and permit the Sentry origin.
 */

const ROOT = join(import.meta.dir, '..', '..')
const TOOL = join(ROOT, 'tools', 'check-observability.ts')
const SENTRY_HOST = 'https://*.ingest.de.sentry.io'

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

/** Rename a file out of the way, run, then put it back. */
async function withFileAbsent(relPath: string, fn: () => Promise<void>) {
  const abs = join(ROOT, relPath)
  const stash = `${abs}.check-observability-test-stash`
  renameSync(abs, stash)
  try {
    await fn()
  } finally {
    if (existsSync(stash)) renameSync(stash, abs)
  }
}

describe('check-observability CSP', () => {
  test('passes on the tree as committed', async () => {
    const { exitCode } = await runCheck()
    expect(exitCode).toBe(0)
  })

  test('fails when _headers declares no CSP at all', async () => {
    await withFileContents(
      'apps/itun/public/_headers',
      (s) => s.replace(/Content-Security-Policy/g, 'X-Retired-Policy'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('declares no Content-Security-Policy')
      }
    )
  })

  test('a CSP that omits the Sentry origin fails', async () => {
    await withFileContents(
      'apps/itun/public/_headers',
      (s) => s.replace(SENTRY_HOST, 'https://example.invalid'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('CSP connect-src does not allow')
      }
    )
  })

  test('a failure names only the app whose CSP is missing', async () => {
    await withFileContents(
      'apps/srd/public/_headers',
      (s) => s.replace(/^\s*Content-Security-Policy:.*$/m, '  X-Retired-Policy: none'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('[srd]')
        // itun is untouched and must not be implicated.
        expect(stderr).not.toContain('[itun]')
      }
    )
  })
})

describe('check-observability Workers static-assets headers', () => {
  test('fails when an app whose wrangler declares assets has no _headers', async () => {
    await withFileAbsent('apps/itun/public/_headers', async () => {
      const { exitCode, stderr } = await runCheck()
      expect(exitCode).toBe(1)
      expect(stderr).toContain('apps/itun/public/_headers does not exist')
    })
  })

  test('the same absence fails for srd — the rule is not itun-specific', async () => {
    await withFileAbsent('apps/srd/public/_headers', async () => {
      const { exitCode, stderr } = await runCheck()
      expect(exitCode).toBe(1)
      expect(stderr).toContain('apps/srd/public/_headers does not exist')
    })
  })

  /**
   * Control: the requirement must be TIED to the `assets` declaration, not
   * unconditional. Without this, a rule that simply always demanded `_headers`
   * would pass both tests above while being wrong about what it enforces — and
   * it would fire on a Worker-only surface that legitimately has no static
   * assets to attach headers to.
   */
  test('an app whose wrangler does NOT declare assets is exempt', async () => {
    await withFileContents(
      'apps/itun/wrangler.jsonc',
      (s) => s.replace(/"assets"\s*:/, '"assetsDisabledForTest":'),
      async () => {
        await withFileAbsent('apps/itun/public/_headers', async () => {
          const { stderr } = await runCheck()
          // The ASSETS rule does not fire for a config that declares no assets;
          // the missing CSP source still fails under its own rule.
          expect(stderr).not.toContain('apps/itun/public/_headers does not exist')
          expect(stderr).toContain('no CSP source found at apps/itun/public/_headers')
        })
      }
    )
  })

  /**
   * The `assets` match must survive the prose. These configs mention `/assets/*`
   * repeatedly in comments before declaring anything, so a substring match on
   * "assets" would keep passing after the real binding was deleted — the exact
   * trap `check-convex-parity.ts` fell into with `convex deploy`.
   */
  test('a commented-out assets binding does not satisfy the rule', async () => {
    await withFileContents(
      'apps/itun/wrangler.jsonc',
      (s) => s.replace(/^(\s*)"assets"\s*:/m, '$1// "assets":'),
      async () => {
        await withFileAbsent('apps/itun/public/_headers', async () => {
          const { stderr } = await runCheck()
          expect(stderr).not.toContain('apps/itun/public/_headers does not exist')
        })
      }
    )
  })
})
