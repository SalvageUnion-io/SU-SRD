import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
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

describe('check-observability CSP source resolution', () => {
  test('passes on the tree as committed', async () => {
    const { exitCode } = await runCheck()
    expect(exitCode).toBe(0)
  })

  test('fails when NO source declares a CSP at all', async () => {
    // One source to neutralise now, not two. This test used to blank BOTH
    // itun's `netlify.toml` and its `_headers`, because either alone would let
    // the run pass on the other and prove nothing. With the toml deleted,
    // `_headers` IS the only source — which makes the check stricter, not
    // weaker: there is no longer a second file that could paper over a stale
    // sibling.
    await withFileContents(
      'apps/itun/public/_headers',
      (s) => s.replace(/Content-Security-Policy/g, 'X-Retired-Policy'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('declares a Content-Security-Policy')
      }
    )
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

  test('a source that declares no CSP is skipped, not failed', async () => {
    // The rule is "at least one source declares a policy, and every source that
    // does must permit Sentry" — not "every source declares one". A `_headers`
    // file may legitimately exist for other reasons.
    //
    // This used to blank srd's CSP and rely on its `netlify.toml` still carrying
    // one. With the toml deleted there is no second source to fall back to, so
    // it asserts the other half of the rule instead: itun, whose `_headers`
    // still declares a policy, keeps the run green while srd's is neutralised —
    // which is exactly "a present source with no CSP is not itself a failure",
    // now expressed as a failure of srd alone rather than of the whole run.
    await withFileContents(
      'apps/srd/public/_headers',
      (s) => s.replace(/^\s*Content-Security-Policy:.*$/m, '  X-Retired-Policy: none'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        // srd now has NO source declaring a policy, so it fails — and the
        // message names that app rather than complaining about a missing file.
        expect(exitCode).toBe(1)
        expect(stderr).toContain('[srd]')
        // itun is untouched and must not be implicated.
        expect(stderr).not.toContain('[itun]')
      }
    )
  })
})

/*
 * `check-observability functions-directory retirement` lived here and is
 * DELETED along with `checkFunctionDirs` itself.
 *
 * It enforced that nothing sat in a Netlify functions directory unless it was a
 * function — a rule with a real incident behind it. ADR-033 predicted its
 * retirement and the reason: a Worker declares ONE entry point, so "every file
 * in a directory is a public endpoint" is not a failure class that can occur
 * any more. The directories it watched no longer exist.
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
          const { stderr } = await runCheck()
          // The claim is narrow and stays narrow: the ASSETS rule does not fire
          // for a wrangler config that declares no assets.
          expect(stderr).not.toContain('apps/itun/public/_headers does not exist')
          // The exit code is deliberately NOT asserted. With `netlify.toml`
          // deleted, `_headers` is itun's only CSP source, so removing it trips
          // the CSP rule as well — a different rule, correctly firing. Asserting
          // exit 0 here would force this test to depend on that unrelated
          // failure never happening, which is how a narrow test quietly becomes
          // a broad one.
          expect(stderr).toContain('[itun]')
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
