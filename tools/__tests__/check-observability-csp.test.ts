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
 * source, its `public/_headers`, which must declare a `connect-src` that
 * permits the Sentry origin.
 */

const ITUN_HEADERS = 'apps/itun/public/_headers'

const ROOT = join(import.meta.dir, '..', '..')
const TOOL = join(ROOT, 'tools', 'check-observability.ts')
const SENTRY_HOST = 'https://*.ingest.de.sentry.io'

/**
 * Every file the check reads (it resolves them from its cwd). These tests run
 * it against a private copy of them and mutate only the copy — never the
 * working tree. Renaming the real `_headers` aside raced every other
 * workspace's tests that read it, because `test:coverage` runs the workspaces
 * concurrently: an srd test read `apps/srd/public/_headers` while it was
 * stashed, and failed with ENOENT. A file the check starts reading without
 * being listed here fails the first test below, not silently.
 */
const CHECKED_FILES = [
  'apps/srd/src/lib/observability.ts',
  'apps/srd/src/runtime/islands.client.ts',
  'apps/srd/public/_headers',
  'apps/itun/src/lib/observability.ts',
  'apps/itun/src/main.tsx',
  'apps/itun/wrangler.jsonc',
  ITUN_HEADERS,
  'apps/itun/src/worker/index.ts',
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

  test('a Sentry origin named only in a comment does not count', async () => {
    await withFileContents(
      ITUN_HEADERS,
      (s) => `${s.replace(SENTRY_HOST, 'https://example.invalid')}\n# connect-src ${SENTRY_HOST}\n`,
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('CSP connect-src does not allow')
      }
    )
  })

  test('a CSP that omits the Sentry origin fails', async () => {
    await withFileContents(
      ITUN_HEADERS,
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

  test.each(['apps/srd/public/_headers', ITUN_HEADERS])(
    'a missing %s fails as no CSP source',
    async (path) => {
      await withFileAbsent(path, async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain(`no CSP source found at ${path}`)
      })
    }
  )
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
