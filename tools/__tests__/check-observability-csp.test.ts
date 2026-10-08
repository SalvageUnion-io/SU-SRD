import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Behaviour tests for the CSP half of `tools/check-observability.ts`.
 *
 * This is the check whose absence let a fully-built Sentry stack sit dark in
 * production: a `connect-src` missing the ingest origin blocks every event in
 * the browser while the app looks completely healthy. Each app has one CSP
 * source — srd's `public/_headers`, itun's `src/worker/securityHeaders.ts`
 * (its Worker sets the header in code) — which must declare a `connect-src`
 * that permits the Sentry origin.
 */

const ITUN_CSP_MODULE = 'apps/itun/src/worker/securityHeaders.ts'

const ROOT = join(import.meta.dir, '..', '..')
const TOOL = join(ROOT, 'tools', 'check-observability.ts')
const SENTRY_HOST = 'https://*.ingest.de.sentry.io'

/**
 * Every file the check reads in its static mode (it resolves them from its
 * cwd). These tests run it against a private copy of them and mutate only the
 * copy — never the working tree. Renaming the real `_headers` aside raced every
 * other workspace's tests that read it, because `test:coverage` runs the
 * workspaces concurrently: an srd test read `apps/srd/public/_headers` while it
 * was stashed, and failed with ENOENT. A file the check starts reading without
 * being listed here fails the first test below, not silently.
 */
const CHECKED_FILES = [
  'apps/srd/src/lib/observability.ts',
  'apps/srd/src/runtime/islands.client.ts',
  'apps/srd/wrangler.jsonc',
  'apps/srd/public/_headers',
  'apps/itun/src/lib/observability.ts',
  'apps/itun/src/main.tsx',
  'apps/itun/wrangler.jsonc',
  'apps/itun/public/_headers',
  'apps/itun/src/worker/index.ts',
  ITUN_CSP_MODULE,
  'apps/su-assets/wrangler.jsonc',
  'apps/su-assets/src/worker.ts',
  'apps/discord-bot/wrangler.jsonc',
  'apps/discord-bot/src/http/worker.ts',
]

let TREE = ''

beforeAll(() => {
  TREE = mkdtempSync(join(tmpdir(), 'check-observability-'))
  for (const file of CHECKED_FILES) {
    mkdirSync(dirname(join(TREE, file)), { recursive: true })
    cpSync(join(ROOT, file), join(TREE, file))
  }
})

afterAll(() => {
  rmSync(TREE, { recursive: true, force: true })
})

async function runCheck() {
  const proc = Bun.spawn(['bun', TOOL], { cwd: TREE, stdout: 'pipe', stderr: 'pipe' })
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
  const abs = join(TREE, relPath)
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
  const abs = join(TREE, relPath)
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

  test('a type annotation on the CSP literal still reads as the literal', async () => {
    // The gate reads transpiled code, so a typed constant is the same policy.
    await withFileContents(
      ITUN_CSP_MODULE,
      (s) => s.replace('export const ITUN_CSP =', 'export const ITUN_CSP: string ='),
      async () => {
        const { exitCode } = await runCheck()
        expect(exitCode).toBe(0)
      }
    )
  })

  test('fails when the CSP module no longer declares the literal', async () => {
    // A policy built at runtime is one this gate cannot read, so it fails
    // rather than guessing.
    await withFileContents(
      ITUN_CSP_MODULE,
      (s) =>
        s
          .replace('export const ITUN_CSP =', 'export const ITUN_CSP = String(')
          .replace('convex.site;"', 'convex.site;")'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('declares no ITUN_CSP literal')
      }
    )
  })

  test('a Sentry origin named only in a comment does not count', async () => {
    await withFileContents(
      ITUN_CSP_MODULE,
      (s) =>
        `${s.replace(SENTRY_HOST, 'https://example.invalid')}\n// connect-src ${SENTRY_HOST}\n`,
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('CSP connect-src does not allow')
      }
    )
  })

  test('a CSP that omits the Sentry origin fails', async () => {
    await withFileContents(
      ITUN_CSP_MODULE,
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
          // The ASSETS rule does not fire for a config that declares no assets,
          // and itun's CSP lives in its Worker module, so nothing fails for it.
          expect(stderr).not.toContain('apps/itun/public/_headers does not exist')
          expect(stderr).not.toContain('[itun]')
        })
      }
    )
  })

  test('with no assets and no CSP module, a missing _headers still fails as no CSP source', async () => {
    await withFileContents(
      'apps/srd/wrangler.jsonc',
      (s) => s.replace(/"assets"\s*:/, '"assetsDisabledForTest":'),
      async () => {
        await withFileAbsent('apps/srd/public/_headers', async () => {
          const { exitCode, stderr } = await runCheck()
          expect(exitCode).toBe(1)
          expect(stderr).not.toContain('apps/srd/public/_headers does not exist')
          expect(stderr).toContain('no CSP source found at apps/srd/public/_headers')
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

/**
 * The negative control: the three edits a text match was fooled by, each
 * leaving its old spelling in a comment. Every one must fail on its own.
 */
describe('check-observability reads parsed source, not prose', () => {
  test('an init call that is commented out fails', async () => {
    await withFileContents(
      'apps/srd/src/runtime/islands.client.ts',
      (s) => s.replace('void initBrowserObservability()', '// void initBrowserObservability()'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('never calls initBrowserObservability()')
      }
    )
  })

  test('a Worker export unwrapped from withObservability fails', async () => {
    await withFileContents(
      'apps/su-assets/src/worker.ts',
      (s) =>
        s.replace(
          "export default withObservability('su-assets', {",
          "// was: withObservability('su-assets', ...)\nexport default ((_: string, h: object) => h)('su-assets', {"
        ),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain("[su-assets-worker] apps/su-assets/src/worker.ts's default export")
      }
    )
  })

  test('nodejs_als named only in a comment fails', async () => {
    await withFileContents(
      'apps/discord-bot/wrangler.jsonc',
      (s) =>
        s.replace(
          '"compatibility_flags": ["nodejs_als"],',
          '// "compatibility_flags": ["nodejs_als"],'
        ),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain(
          '[discord-bot-worker] apps/discord-bot/wrangler.jsonc does not grant'
        )
      }
    )
  })
})
