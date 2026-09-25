import { describe, expect, test } from 'bun:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Behaviour tests for `tools/check-action-pinning.ts`.
 *
 * These assert the RULE, not the three pins that happened to prompt it: each
 * mutates the real tree, runs the real tool, and restores. A test that only
 * asserted "the committed tree passes" would keep passing if the checker were
 * gutted to `process.exit(0)`.
 */

const ROOT = join(import.meta.dir, '..', '..')
const TOOL = join(ROOT, 'tools', 'check-action-pinning.ts')

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

describe('check-action-pinning', () => {
  test('passes on the tree as committed', async () => {
    const { exitCode, stdout } = await runCheck()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('SHA-pinned')
  })

  test('fails when a third-party action regresses to a mutable tag', async () => {
    await withFileContents(
      '.github/workflows/release-please.yml',
      (s) =>
        s.replace(
          /googleapis\/release-please-action@[0-9a-f]{40}[^\n]*/,
          'googleapis/release-please-action@v5'
        ),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('release-please-action@v5')
      }
    )
  })

  /**
   * The composite-action half. `oven-sh/setup-bun` does not appear in any
   * workflow — it lives in `.github/actions/setup-bun/action.yml` — so a
   * checker that walked only `workflows/` would report a clean tree while the
   * action installing the toolchain for every job was unpinned. That is the
   * shape the real gap had.
   */
  test('scans composite actions, not just workflows', async () => {
    await withFileContents(
      '.github/actions/setup-bun/action.yml',
      // Target the `uses:` line specifically. An earlier version of this test
      // replaced the first textual match, which was a COMMENT mentioning the
      // action — the checker correctly ignored it and the test failed, which is
      // the comment-stripping working rather than a bug.
      (s) => s.replace(/uses: oven-sh\/setup-bun@[0-9a-f]{40}[^\n]*/, 'uses: oven-sh/setup-bun@v2'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('.github/actions/setup-bun/action.yml')
      }
    )
  })

  /**
   * Control: first-party actions must stay exempt. Without this, a checker that
   * simply demanded a SHA everywhere would pass both failure tests above while
   * being a different, unenforceable rule — 25 `actions/checkout@v7` lines is
   * how a gate gets switched off rather than satisfied.
   */
  test('first-party actions/* and github/* are exempt', async () => {
    const { exitCode } = await runCheck()
    // The committed tree contains many `actions/checkout@v7` and
    // `github/codeql-action@v4.37.6` references, none SHA-pinned.
    expect(exitCode).toBe(0)
  })

  test('a short SHA is not accepted as a pin', async () => {
    await withFileContents(
      '.github/workflows/ci.yml',
      (s) => s.replace(/dorny\/paths-filter@([0-9a-f]{40})[^\n]*/, 'dorny/paths-filter@ceb8a2b'),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('paths-filter@ceb8a2b')
      }
    )
  })

  /**
   * A reference named only in prose must not satisfy the scan. These workflows
   * explain themselves at length; a comment-blind checker could be satisfied by
   * commentary after the real `uses:` was deleted.
   */
  test('a commented-out uses: line is ignored', async () => {
    await withFileContents(
      '.github/workflows/ci.yml',
      (s) => `${s}\n# uses: some-vendor/unpinned-action@v1\n`,
      async () => {
        const { exitCode } = await runCheck()
        expect(exitCode).toBe(0)
      }
    )
  })
})

/**
 * The `bunx` half.
 *
 * The deploy workflow no longer calls any unlisted tool — wrangler became a
 * catalogued devDependency once its tree stopped carrying HIGH advisories
 * (wrangler 4.132's miniflare ships fixed `sharp` and `undici`) — so these
 * inject the call site they test rather than borrowing a real one.
 */
const DEPLOY = '.github/workflows/deploy-cloudflare.yml'
const FIRST_DEPLOY_STEP = /run: bun run deploy\n/

function injectRun(command: string) {
  return (s: string) => {
    if (!FIRST_DEPLOY_STEP.test(s)) throw new Error(`no \`bun run deploy\` step in ${DEPLOY}`)
    return s.replace(FIRST_DEPLOY_STEP, `run: ${command}\n`)
  }
}

describe('check-action-pinning — bunx tools', () => {
  test('fails when an unlisted bunx tool carries no version pin', async () => {
    await withFileContents(DEPLOY, injectRun('bunx unlisted-tool deploy'), async () => {
      const { exitCode, stderr } = await runCheck()
      expect(exitCode).toBe(1)
      expect(stderr).toContain('bunx unlisted-tool')
    })
  })

  test('fails on a mutable tag, not just a missing one', async () => {
    await withFileContents(DEPLOY, injectRun('bunx unlisted-tool@latest deploy'), async () => {
      const { exitCode } = await runCheck()
      expect(exitCode).toBe(1)
    })
  })

  test('passes when the unlisted tool carries an exact version', async () => {
    await withFileContents(DEPLOY, injectRun('bunx unlisted-tool@1.2.3 deploy'), async () => {
      const { exitCode } = await runCheck()
      expect(exitCode).toBe(0)
    })
  })

  /**
   * Control, and the one that keeps this rule honest. `bunx convex deploy` is
   * CORRECT unpinned: the step sets a `working-directory` inside apps/itun, so
   * bunx resolves the `convex` pinned in that manifest. A rule of "every bunx
   * needs an @version" would flag it and be wrong.
   */
  test('a locally-resolved tool is exempt', async () => {
    const { exitCode, stdout } = await runCheck()
    expect(exitCode).toBe(0)
    // `bunx convex deploy` is in the committed workflow and unpinned.
    expect(stdout).toContain('version-pinned')
  })

  test('a commented-out bunx line is ignored', async () => {
    await withFileContents(
      DEPLOY,
      (s) => `${s}\n# bunx some-unpinned-tool build\n`,
      async () => {
        const { exitCode } = await runCheck()
        expect(exitCode).toBe(0)
      }
    )
  })
})

/**
 * The exempt set is derived, not hardcoded.
 *
 * The first version kept a literal allow-list and immediately produced a false
 * positive on `bunx @convex-dev/auth`, which is pinned at 0.0.94 in
 * `apps/itun/package.json`. A hand-maintained list of "things pinned elsewhere"
 * goes stale the moment somebody adds a dependency, and a gate that cries wolf
 * is one that gets switched off.
 */
describe('check-action-pinning — locally-resolved derivation', () => {
  test('a tool pinned in a workspace manifest is exempt', async () => {
    // `bunx convex deploy` runs unpinned in deploy-cloudflare.yml and must
    // pass: convex is pinned at 1.43.0 in apps/itun/package.json and the step's
    // working-directory is inside that workspace, so bunx resolves it locally.
    const { exitCode } = await runCheck()
    expect(exitCode).toBe(0)
  })

  test('removing that manifest entry makes the same call site fail', async () => {
    // The discriminating case: if the exemption came from a hardcoded list
    // rather than from the manifest, dropping the dependency would change
    // nothing and this test would pass for the wrong reason.
    //
    // This originally targeted `@convex-dev/auth`, and then the commit that
    // replaced that CLI with inline key generation deleted the call site out
    // from under it — leaving the test green against nothing until the
    // pre-push hook caught it. Pointed at `convex` instead, which has a
    // long-lived call site in the deploy workflow.
    await withFileContents(
      'apps/itun/package.json',
      (s) => s.replace(/^\s*"convex":\s*"[^"]+",\n/m, ''),
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('bunx convex')
      }
    )
  })

  test('wrangler is exempt because the Worker apps declare it, and only while they do', async () => {
    // Passes with the committed manifests: every Worker app lists wrangler, so
    // bunx resolves the lockfile's copy.
    await withFileContents(DEPLOY, injectRun('bunx wrangler deploy'), async () => {
      expect((await runCheck()).exitCode).toBe(0)

      // The catalog entry in the root manifest is not a dependency, so with
      // the four app entries gone nothing exempts it and it must be pinned.
      const apps = ['srd', 'itun', 'discord-bot', 'su-assets'].map((a) => `apps/${a}/package.json`)
      const dropWrangler = (s: string) => s.replace(/,?\n\s*"wrangler":\s*"catalog:"/, '')
      const nested = apps.reduceRight<() => Promise<void>>(
        (inner, manifest) => () => withFileContents(manifest, dropWrangler, inner),
        async () => {
          const { exitCode, stderr } = await runCheck()
          expect(exitCode).toBe(1)
          expect(stderr).toContain('bunx wrangler')
        }
      )
      await nested()
    })
  })
})

/**
 * The exempt set must be EXACT package names, never a derived suffix.
 *
 * An earlier version also exempted the unscoped half of every scoped package,
 * on a justification that was wrong on its face: `'@playwright/test'` yields
 * `test`, not `playwright`. Across the eight manifests it exempted 25 bare
 * names — `auth`, `node`, `core`, `test`, `browser`, `rest`, `blobs` among them
 * — all real npm packages, none present in any manifest.
 */
describe('check-action-pinning — the exempt set is not over-broad', () => {
  test('a bare name that only resembles a scoped package suffix is NOT exempt', async () => {
    // `@convex-dev/auth` is a dependency, so a suffix-deriving rule would
    // exempt the unrelated package `auth`. It must not.
    await withFileContents(
      '.github/workflows/e2e-nightly.yml',
      (s) => `${s}\n      # probe\n      - run: bunx auth --version\n`,
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('bunx auth')
      }
    )
  })

  test('`test` is not exempt either', async () => {
    // The literal suffix of `@playwright/test`, and a real npm package.
    await withFileContents(
      '.github/workflows/e2e-nightly.yml',
      (s) => `${s}\n      # probe\n      - run: bunx test --version\n`,
      async () => {
        const { exitCode, stderr } = await runCheck()
        expect(exitCode).toBe(1)
        expect(stderr).toContain('bunx test')
      }
    )
  })

  test('but a real root dependency still is', async () => {
    // Control: `playwright` IS a root devDependency by exact name, which is the
    // actual reason `bunx playwright test` passes — not any suffix rule.
    const { exitCode } = await runCheck()
    expect(exitCode).toBe(0)
  })
})
