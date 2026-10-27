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
 * A `connect-src` that blocks the report's destination blocks every error in
 * the browser while the app looks completely healthy. The app has one CSP
 * source, `public/_headers`, which must declare a `connect-src` allowing
 * `'self'`, where the app posts its reports.
 */

const HEADERS = 'apps/web/public/_headers'

const ROOT = join(import.meta.dir, '..', '..')
const TOOL = join(ROOT, 'tools', 'check-observability.ts')
const SELF = "connect-src 'self'"

/**
 * Every file the check reads (it resolves them from its cwd). These tests run
 * it against a private copy of them and mutate only the copy — never the
 * working tree. Renaming the real `_headers` aside raced every other
 * workspace's tests that read it, because `test:coverage` runs the workspaces
 * concurrently: a reference-site test read `apps/web/public/_headers` while it was
 * stashed, and failed with ENOENT. A file the check starts reading without
 * being listed here fails the first test below, not silently.
 */
const CHECKED_FILES = [
  'apps/web/src/lib/observability.ts',
  'apps/web/src/runtime/islands.client.ts',
  HEADERS,
  'apps/web/src/worker/routes.ts',
  'apps/web/src/main.tsx',
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

  test("'self' named only in a comment does not count", async () => {
    await withFileContents(
      HEADERS,
      (s) => `${s.replace(SELF, 'connect-src https://example.invalid')}\n# ${SELF}\n`,
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('CSP connect-src does not allow')
      }
    )
  })

  test("a CSP that omits 'self' fails", async () => {
    await withFileContents(
      HEADERS,
      (s) => s.replace(SELF, 'connect-src https://example.invalid'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('CSP connect-src does not allow')
      }
    )
  })

  // The edge injects the Web Analytics beacon, so the CSP is the only place
  // the repo can blind it: from the site's creation until 3.0.0 neither origin
  // was allowed and the dashboard recorded one page load in six weeks.
  test.each([
    ['script-src', 'https://static.cloudflareinsights.com'],
    ['connect-src', 'https://cloudflareinsights.com'],
  ])('a %s without %s fails', async (directive, source) => {
    await withFileContents(
      HEADERS,
      (s) => s.replace(` ${source}`, ''),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain(`CSP ${directive} does not allow ${source}`)
      }
    )
  })

  test('a missing _headers fails as no CSP source', async () => {
    await withFileAbsent(HEADERS, async () => {
      const { exitCode, stderr } = await runCheck()
      expect(exitCode).toBe(1)
      expect(stderr).toContain(`no CSP source found at ${HEADERS}`)
    })
  })
})

/**
 * The negative control: edits a text match would be fooled by, each leaving its
 * old spelling in a comment. Every one must fail on its own.
 */
describe('check-observability reads parsed source, not prose', () => {
  test.each(['apps/web/src/runtime/islands.client.ts', 'apps/web/src/main.tsx'])(
    'an init call commented out of %s fails',
    async (entry) => {
      await withFileContents(
        entry,
        (s) => s.replace('\ninitBrowserObservability()', '\n// initBrowserObservability()'),
        async () => {
          const { exitCode, stderr } = await runCheck()
          expect(exitCode).toBe(1)
          expect(stderr).toContain(`${entry} never calls initBrowserObservability()`)
        }
      )
    }
  )

  test('an error report route that is commented out fails', async () => {
    await withFileContents(
      'apps/web/src/worker/routes.ts',
      (s) =>
        s.replace(
          "handleErrorReport(request, { app: 'web', limiter: env.ERROR_REPORT_LIMIT }),",
          'null as never, // handleErrorReport(request),'
        ),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('apps/web/src/worker/routes.ts never calls handleErrorReport()')
      }
    )
  })
})
