import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Behaviour tests for the STATIC half of `tools/check-convex-parity.ts` — the
 * assertion that a production deploy cannot ship an ITUN client against a
 * backend nobody pushed.
 *
 * That is not hypothetical: production ran that way from 2026-08-06 to
 * 2026-08-10. The site served the current commit, the backend was four days
 * stale, every soft-link write failed, and the UI rendered all of it as saved.
 * Nothing was red.
 *
 * ADR-033 moves the build from `netlify.toml` into GitHub Actions, so the guard
 * now accepts either source. The hazard in that change is a window where
 * NEITHER carries the assertion and the check passes anyway — which is exactly
 * what the third test below forbids.
 *
 * The `--live` half is not exercised here; it needs a real deployment and a
 * CONVEX_DEPLOY_KEY, and runs nightly.
 */

const ROOT = join(import.meta.dir, '..', '..')
const TOOL = join(ROOT, 'tools', 'check-convex-parity.ts')
const WORKFLOW = '.github/workflows/deploy-cloudflare.yml'

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

async function withFileAbsent(relPath: string, fn: () => Promise<void>) {
  const abs = join(ROOT, relPath)
  const stash = `${abs}.check-convex-parity-test-stash`
  renameSync(abs, stash)
  try {
    await fn()
  } finally {
    if (existsSync(stash)) renameSync(stash, abs)
  }
}

describe('check-convex-parity static guard', () => {
  test('passes on the tree as committed', async () => {
    const { exitCode, stdout } = await runCheck()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('[netlify.toml]')
  })

  test('fails when netlify.toml stops making an absent key fatal', async () => {
    await withFileContents(
      'apps/itun/netlify.toml',
      (s) => s.replace('-z "$CONVEX_DEPLOY_KEY"', '-n "$CONVEX_DEPLOY_KEY"'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('no longer fails a production build')
      }
    )
  })

  test('fails when NEITHER a netlify.toml nor a deploy workflow carries the guard', async () => {
    // Both must be absent. An earlier version of this test removed only
    // `netlify.toml` and passed because `deploy-cloudflare.yml` did not exist
    // yet — so it was asserting a fact about the tree's current shape rather
    // than the rule, and it failed the moment P4 added the workflow. Failing
    // there was correct; relying on a file's absence was not.
    await withFileAbsent('apps/itun/netlify.toml', async () => {
      await withFileAbsent(WORKFLOW, async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('no build definition carries the Convex deploy guard')
      })
    })
  })

  test('the real deploy workflow satisfies the guard on its own', async () => {
    // The committed `.github/workflows/deploy-cloudflare.yml`, not a fixture:
    // the point of naming that path in the tool before the file existed was
    // that the file would have to satisfy it.
    await withFileAbsent('apps/itun/netlify.toml', async () => {
      const { exitCode, stdout } = await runCheck()
      expect(exitCode).toBe(0)
      expect(stdout).toContain('[deploy-cloudflare.yml]')
    })
  })

  test('a workflow that stops running `convex deploy` fails', async () => {
    // Mutates the REAL workflow rather than a fixture. A fixture would only
    // prove the tool can read some YAML; this proves it is pointed at the file
    // that actually deploys, which is the whole reason the path was named in
    // the tool before the file existed.
    await withFileContents(
      WORKFLOW,
      (s) => s.replace('bunx convex deploy', 'bun run build'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('no longer runs `convex deploy`')
      }
    )
  })

  test('a workflow that can no longer fail on an absent key fails', async () => {
    await withFileContents(
      WORKFLOW,
      (s) => s.replaceAll('exit 1', 'true'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('no longer fails a production deploy')
      }
    )
  })

  test('a workflow that stops naming CONVEX_DEPLOY_KEY fails', async () => {
    await withFileContents(
      WORKFLOW,
      (s) => s.replaceAll('CONVEX_DEPLOY_KEY', 'SOME_OTHER_KEY'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('no longer fails a production deploy')
      }
    )
  })
})
