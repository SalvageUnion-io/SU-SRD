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
    // BOTH itun sources have to be neutralised now. When this test was written
    // itun had no `public/_headers`, so retiring the toml's header was enough to
    // reach "nothing declares a policy". itun has one since the Cloudflare flip,
    // and leaving it out here would have made this assertion vacuous — the run
    // would pass on the `_headers` CSP and the test would be proving nothing.
    await withFileContents(
      'apps/itun/netlify.toml',
      (s) => s.replace(/Content-Security-Policy/g, 'X-Retired-Policy'),
      async () => {
        await withFileContents(
          'apps/itun/public/_headers',
          (s) => s.replace(/Content-Security-Policy/g, 'X-Retired-Policy'),
          async () => {
            const { exitCode, stderr } = await runCheck()
            expect(exitCode).toBe(1)
            expect(stderr).toContain('declares a Content-Security-Policy')
          }
        )
      }
    )
  })

  test('accepts the _headers file as the CSP source once netlify.toml is gone', async () => {
    // This used to invent the `_headers` file, because itun had none. It is now
    // committed, so the test asserts the real thing: delete the toml — as P8
    // will — and the committed `_headers` must carry the pass on its own. That
    // makes this a live check on the actual policy rather than on a fixture.
    await withFileAbsent('apps/itun/netlify.toml', async () => {
      const { exitCode } = await runCheck()
      expect(exitCode).toBe(0)
    })
  })

  test('a _headers CSP that omits Sentry still fails — the dialect is not an escape hatch', async () => {
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

/**
 * The rule that would have caught the real outage.
 *
 * itun went live on Cloudflare with no `apps/itun/public/_headers` at all, and
 * this checker stayed green: the CSP rule above judges only sources that EXIST,
 * so an absent policy was filtered out before it could fail anything, and the
 * pass came from a `netlify.toml` describing a host that had stopped answering.
 * The site served no CSP, no HSTS and no X-Frame-Options for a day.
 *
 * The fix is a different KIND of rule — "config present, property missing →
 * fail" — keyed on the deploy target rather than on the file set: if
 * `wrangler.jsonc` declares `assets`, Cloudflare serves this app from static
 * assets, and `_headers` is the only thing there that can carry a policy.
 */
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
          const { exitCode, stderr } = await runCheck()
          expect(stderr).not.toContain('apps/itun/public/_headers does not exist')
          expect(exitCode).toBe(0)
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
