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
 * the browser while the app looks completely healthy. Each app has one CSP
 * source, its `public/_headers`, which must declare a `connect-src` allowing
 * `'self'`, where the app posts its reports.
 */

const CANTINA_HEADERS = 'apps/cantina/public/_headers'

const ROOT = join(import.meta.dir, '..', '..')
const TOOL = join(ROOT, 'tools', 'check-observability.ts')
const SELF = "connect-src 'self'"

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
  'apps/srd/wrangler.jsonc',
  'apps/srd/src/worker/index.ts',
  'apps/cantina/src/lib/observability.ts',
  'apps/cantina/src/main.tsx',
  'apps/cantina/wrangler.jsonc',
  CANTINA_HEADERS,
  'apps/cantina/src/worker/index.ts',
  'apps/su-assets/wrangler.jsonc',
  'apps/su-assets/src/worker/index.ts',
  'apps/discord-bot/wrangler.jsonc',
  'apps/discord-bot/src/worker/index.ts',
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
      CANTINA_HEADERS,
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
      CANTINA_HEADERS,
      (s) => s.replace(SELF, 'connect-src https://example.invalid'),
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
        // cantina is untouched and must not be implicated.
        expect(stderr).not.toContain('[cantina]')
      }
    )
  })

  // The edge injects the Web Analytics beacon, so the CSP is the only place
  // the repo can blind it: from the site's creation until 3.0.0 neither origin
  // was allowed and the dashboard recorded one page load in six weeks.
  test.each([
    ['apps/srd/public/_headers', 'script-src', 'https://static.cloudflareinsights.com'],
    ['apps/srd/public/_headers', 'connect-src', 'https://cloudflareinsights.com'],
    [CANTINA_HEADERS, 'script-src', 'https://static.cloudflareinsights.com'],
    [CANTINA_HEADERS, 'connect-src', 'https://cloudflareinsights.com'],
  ])('%s: a %s without %s fails', async (path, directive, source) => {
    await withFileContents(
      path,
      (s) => s.replace(` ${source}`, ''),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain(`CSP ${directive} does not allow ${source}`)
      }
    )
  })

  test.each(['apps/srd/public/_headers', CANTINA_HEADERS])(
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
 * The negative control: edits a text match would be fooled by, each leaving its
 * old spelling in a comment. Every one must fail on its own.
 */
describe('check-observability reads parsed source, not prose', () => {
  test('an init call that is commented out fails', async () => {
    await withFileContents(
      'apps/srd/src/runtime/islands.client.ts',
      (s) => s.replace('\ninitBrowserObservability()', '\n// initBrowserObservability()'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('never calls initBrowserObservability()')
      }
    )
  })

  test('an error report route that is commented out fails', async () => {
    await withFileContents(
      'apps/cantina/src/worker/index.ts',
      (s) =>
        s.replace(
          'return handleConvexLogStream(',
          'return null as never // handleConvexLogStream('
        ),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain(
          '[cantina] apps/cantina/src/worker/index.ts never calls handleConvexLogStream()'
        )
      }
    )
  })

  test('Issues turned on only in a comment fails', async () => {
    await withFileContents(
      'apps/discord-bot/wrangler.jsonc',
      (s) => s.replace('"issues": { "enabled": true }', '// "issues": { "enabled": true }'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain(
          '[discord-bot-worker] apps/discord-bot/wrangler.jsonc does not turn on "observability.issues"'
        )
      }
    )
  })

  test('a Worker without upload_source_maps fails', async () => {
    await withFileContents(
      'apps/su-assets/wrangler.jsonc',
      (s) => s.replace('"upload_source_maps": true', '"upload_source_maps": false'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('[su-assets-worker] apps/su-assets/wrangler.jsonc does not set')
      }
    )
  })
})
