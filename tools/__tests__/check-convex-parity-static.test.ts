import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
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

/** A workflow carrying all three properties the guard asks for. */
const GOOD_WORKFLOW = `name: Deploy (Cloudflare)
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Refuse to ship without a Convex deploy key
        env:
          CONVEX_DEPLOY_KEY: \${{ secrets.CONVEX_DEPLOY_KEY }}
        run: |
          if [ -z "$CONVEX_DEPLOY_KEY" ]; then
            echo "FATAL: production deploy with no CONVEX_DEPLOY_KEY." >&2
            exit 1
          fi
      - name: Push the backend and build the client
        run: bunx convex deploy --cmd "bun run build"
`

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
    await withFileAbsent('apps/itun/netlify.toml', async () => {
      const { exitCode, stderr } = await runCheck()
      expect(exitCode).toBe(1)
      expect(stderr).toContain('no build definition carries the Convex deploy guard')
    })
  })

  test('accepts the Actions workflow as the guard once netlify.toml is gone', async () => {
    await withFileAbsent('apps/itun/netlify.toml', async () => {
      await withNewFile(WORKFLOW, GOOD_WORKFLOW, async () => {
        const { exitCode, stdout } = await runCheck()
        expect(exitCode).toBe(0)
        expect(stdout).toContain('[deploy-cloudflare.yml]')
      })
    })
  })

  test('a workflow that never runs `convex deploy` still fails', async () => {
    await withFileAbsent('apps/itun/netlify.toml', async () => {
      await withNewFile(
        WORKFLOW,
        GOOD_WORKFLOW.replace('bunx convex deploy', 'bun run build'),
        async () => {
          const { exitCode, stderr } = await runCheck()
          expect(exitCode).toBe(1)
          expect(stderr).toContain('no longer runs `convex deploy`')
        }
      )
    })
  })

  test('a workflow that cannot fail on an absent key still fails', async () => {
    await withFileAbsent('apps/itun/netlify.toml', async () => {
      await withNewFile(WORKFLOW, GOOD_WORKFLOW.replace('            exit 1\n', ''), async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('no longer fails a production deploy')
      })
    })
  })
})
