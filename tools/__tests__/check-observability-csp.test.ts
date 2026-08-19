import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Behaviour tests for the CSP half of `tools/check-observability.ts`.
 *
 * This is the check whose absence let a fully-built Sentry stack sit dark in
 * production: a `connect-src` missing the ingest origin blocks every event in
 * the browser while the app looks completely healthy. ADR-033 moves that header
 * out of `netlify.toml` and into a `_headers` file, so the check now reads
 * either dialect — and the risk of that change is that "reads either" quietly
 * becomes "requires neither".
 *
 * These assert the two rules separately, because conflating them is the actual
 * bug this test caught during the port:
 *
 *   - AT LEAST ONE source must declare a CSP connect-src.
 *   - EVERY source that declares one must permit the Sentry origin.
 *
 * The second rule is what stops a correct `_headers` file papering over a stale
 * `netlify.toml` while both are live during the cutover. A source that declares
 * no CSP at all is fine — srd's `_headers` legitimately carries only CORS.
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

/** Create a file that does not exist, run, then remove it again. */
async function withNewFile(relPath: string, contents: string, fn: () => Promise<void>) {
  const abs = join(ROOT, relPath)
  if (existsSync(abs)) throw new Error(`${relPath} already exists — test would clobber it`)
  try {
    writeFileSync(abs, contents)
    await fn()
  } finally {
    rmSync(abs, { force: true })
  }
}

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

describe('check-observability CSP source resolution', () => {
  test('passes on the tree as committed', async () => {
    const { exitCode } = await runCheck()
    expect(exitCode).toBe(0)
  })

  test('fails when the netlify.toml CSP drops the Sentry ingest origin', async () => {
    await withFileContents(
      'apps/itun/netlify.toml',
      (s) => s.replace(SENTRY_HOST, 'https://example.invalid'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('CSP connect-src does not allow')
      }
    )
  })

  test('fails when NO source declares a CSP at all', async () => {
    await withFileContents(
      'apps/itun/netlify.toml',
      (s) => s.replace(/Content-Security-Policy/g, 'X-Retired-Policy'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('declares a Content-Security-Policy')
      }
    )
  })

  test('accepts a _headers file as the CSP source once netlify.toml is gone', async () => {
    await withFileAbsent('apps/itun/netlify.toml', async () => {
      await withNewFile(
        'apps/itun/public/_headers',
        `/*\n  Content-Security-Policy: default-src 'self'; connect-src 'self' ${SENTRY_HOST};\n`,
        async () => {
          const { exitCode } = await runCheck()
          expect(exitCode).toBe(0)
        }
      )
    })
  })

  test('a _headers CSP that omits Sentry still fails — the dialect is not an escape hatch', async () => {
    await withFileAbsent('apps/itun/netlify.toml', async () => {
      await withNewFile(
        'apps/itun/public/_headers',
        `/*\n  Content-Security-Policy: default-src 'self'; connect-src 'self';\n`,
        async () => {
          const { exitCode, stderr } = await runCheck()
          expect(exitCode).toBe(1)
          expect(stderr).toContain('CSP connect-src does not allow')
        }
      )
    })
  })

  test('a present source with no CSP is not itself a failure', async () => {
    // The rule is "at least one source declares a policy", not "every source
    // does" — a `_headers` file may legitimately exist for other reasons (srd's
    // carried only CORS for the JSON endpoints before the Cloudflare cutover
    // moved the CSP into it).
    //
    // Constructed rather than read off the real file. The original version of
    // this test asserted that srd's `_headers` contained no CSP, which was true
    // when written and became false the moment ADR-033 moved the policy there —
    // so it was testing a passing fact about a file in flight, not the rule. It
    // failed for the right reason and is now written so it cannot.
    await withFileContents(
      'apps/srd/public/_headers',
      (s) => s.replace(/^\s*Content-Security-Policy:.*$/m, '  X-Retired-Policy: none'),
      async () => {
        const { exitCode } = await runCheck()
        // srd's netlify.toml still declares one, so the app is covered.
        expect(exitCode).toBe(0)
      }
    )
  })
})

describe('check-observability functions-directory retirement', () => {
  test('a retired functions directory is tolerated, not failed', async () => {
    await withFileAbsent('apps/su-assets/netlify/functions', async () => {
      const { exitCode } = await runCheck()
      expect(exitCode).toBe(0)
    })
  })

  test('a file in a SURVIVING functions directory still must export a handler', async () => {
    await withNewFile(
      'apps/itun/netlify/functions/_probe-not-a-handler.ts',
      'export const notAHandler = 1\n',
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('exports no handler')
      }
    )
  })
})
