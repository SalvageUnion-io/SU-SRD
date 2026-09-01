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
    // `[deploy-cloudflare.yml]`, not `[netlify.toml]`. The Netlify half of this
    // guard is gone with the file it read; the workflow half is now the whole
    // of it, which is what makes the assertion below load-bearing rather than
    // one of two redundant sources.
    expect(stdout).toContain('[deploy-cloudflare.yml]')
  })

  test('fails when NO build definition carries the guard', async () => {
    // The one state that must never pass. This used to require removing BOTH
    // `netlify.toml` and the workflow — an earlier version removed only the
    // former and passed, because it was asserting a fact about the tree's shape
    // rather than the rule. With `netlify.toml` deleted the workflow is the only
    // source left, so removing it is now sufficient AND necessary, and the
    // tool's Netlify branch has been removed with it rather than left as
    // unreachable code that still reads as an active guard.
    await withFileAbsent(WORKFLOW, async () => {
      const { exitCode, stderr } = await runCheck()
      expect(exitCode).toBe(1)
      expect(stderr).toContain('Convex deploy guard')
      expect(stderr).toContain(WORKFLOW)
    })
  })

  test('fails when the guard STEP is deleted but its tokens survive elsewhere', async () => {
    // The regression test this check was missing, and the reason it needed one.
    //
    // The assertion used to be `yaml.includes('CONVEX_DEPLOY_KEY')` and
    // `yaml.includes('exit 1')` over the WHOLE file. `deploy-cloudflare.yml`
    // has four `exit 1`s and names the key in several places, so deleting the
    // entire "Refuse to deploy without a Convex deploy key" step left both
    // substrings present — the neighbouring Cloudflare-token guard supplies an
    // `exit 1`, and the build step's `env:` block supplies the key name. The
    // check printed `✓ convex deploy guard OK` for a workflow with no guard.
    //
    // That is the same weakness the tool's own comment describes for comments
    // satisfying the `convex deploy` assertion — fixed there, missed here. The
    // deletion below is the exact edit that used to pass.
    await withFileContents(
      WORKFLOW,
      (s) => {
        const lines = s.split('\n')
        const start = lines.findIndex((l) =>
          l.includes('name: Refuse to deploy without a Convex deploy key')
        )
        expect(start).toBeGreaterThan(-1)
        const end = lines.findIndex((l, i) => i > start && l.trimStart().startsWith('- name:'))
        expect(end).toBeGreaterThan(start)
        return [...lines.slice(0, start), ...lines.slice(end)].join('\n')
      },
      async () => {
        const mutated = readFileSync(join(ROOT, WORKFLOW), 'utf-8')
        // The premise: both tokens the old check looked for are still present.
        // Without this the test would pass for the wrong reason.
        expect(mutated).toContain('CONVEX_DEPLOY_KEY')
        expect(mutated).toContain('exit 1')

        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('Refuse to deploy without a Convex deploy key')
      }
    )
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
