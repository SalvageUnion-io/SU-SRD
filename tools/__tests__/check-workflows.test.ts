import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { WorkflowContext, WorkflowFile } from '../check-workflows'
import {
  checkAggregator,
  checkBunVersion,
  checkConvexGuard,
  checkDeployOrder,
  checkPathFilters,
  checkPinning,
  GUARD_STEP,
  loadContext,
  runnerCalls,
  toolIsPinned,
  WORKFLOW_CHECKS,
} from '../check-workflows'

/**
 * `tools/check-workflows.ts` — six merge-gating invariants over `.github/`.
 *
 * Every case builds its context from YAML TEXT through `Bun.YAML.parse`, the
 * same path the real run takes, so a fixture cannot pass by being shaped
 * differently from a workflow. The running Bun is injected (`runningBun`), so
 * these pass on any machine — the previous bun-version suite failed wherever
 * the local Bun differed from the pin.
 */

const REPO = join(import.meta.dir, '..', '..')
const SHA = 'a'.repeat(40)

const yaml = (path: string, text: string): WorkflowFile => ({
  path,
  doc: Bun.YAML.parse(text) as Record<string, unknown>,
})

const CI_TEXT = `
on: pull_request
jobs:
  changes:
    runs-on: ubuntu-latest
    steps:
      - uses: dorny/paths-filter@${SHA} # v4
        id: filter
        with:
          filters: |
            shared: &shared
              - 'packages/ref/**'
            itun:
              - *shared
              - 'apps/itun/**'
            web:
              - *shared
              - 'apps/srd/**'
            bot:
              - *shared
            code:
              - 'apps/**'
  build:
    needs: [changes]
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup-bun
      - run: |
          # bunx not-a-call-this-is-a-comment
          echo "quality-checks:"
  quality-checks:
    needs:
      - changes
      - build
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
`

const DEPLOY_TEXT = `
on: workflow_dispatch
jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup-bun
      - name: ${GUARD_STEP}
        env:
          CONVEX_DEPLOY_KEY: x
        run: |
          if [ -z "$CONVEX_DEPLOY_KEY" ]; then
            exit 1
          fi
  build-srd:
    needs: plan
    if: needs.plan.outputs.srd == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: bun --filter srd build
      - uses: actions/upload-artifact@v7
  build-itun:
    needs: plan
    if: needs.plan.outputs.itun == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: bun run build
      - uses: actions/upload-artifact@v7
  push-convex:
    needs: [plan, build-srd, build-itun]
    if: \${{ !cancelled() && !failure() && needs.plan.outputs.itun == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - name: Push
        run: bunx convex deploy --cmd "true"
  deploy-srd:
    needs: [plan, build-srd, build-itun, push-convex]
    if: \${{ !cancelled() && !failure() && needs.plan.outputs.srd == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v8
      - run: bun run deploy
  deploy-bot:
    needs: [plan, build-srd, build-itun, push-convex]
    if: \${{ !cancelled() && !failure() && needs.plan.outputs.bot == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - run: bun run deploy
  smoke:
    needs: [plan, deploy-srd, deploy-bot]
    if: \${{ !cancelled() && !failure() }}
    runs-on: ubuntu-latest
    steps:
      - run: bash tools/smoke-production.sh
  record:
    needs: [plan, smoke]
    if: \${{ !cancelled() && !failure() && needs.smoke.result == 'success' }}
    permissions:
      contents: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v9
`

const SETUP_BUN = yaml(
  '.github/actions/setup-bun/action.yml',
  `runs:\n  using: composite\n  steps:\n    - uses: oven-sh/setup-bun@${SHA}\n      with:\n        bun-version-file: .bun-version\n`
)

function ctx(overrides: {
  ci?: string
  deploy?: string | null
  extra?: WorkflowFile[]
  manifests?: Record<string, object>
  running?: string | null
  missing?: string[]
}): WorkflowContext {
  const files = [
    yaml('.github/workflows/ci.yml', overrides.ci ?? CI_TEXT),
    yaml(
      '.github/workflows/codeql.yml',
      'jobs:\n  a:\n    steps:\n      - uses: github/codeql-action/init@v4\n'
    ),
    yaml(
      '.github/workflows/nightly.yml',
      'jobs:\n  a:\n    steps:\n      - uses: ./.github/actions/setup-bun\n'
    ),
    yaml(
      '.github/workflows/other.yml',
      'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v7\n'
    ),
    SETUP_BUN,
    ...(overrides.extra ?? []),
  ]
  if (overrides.deploy !== null) {
    files.push(yaml('.github/workflows/deploy-cloudflare.yml', overrides.deploy ?? DEPLOY_TEXT))
  }
  const manifests = new Map<string, object>(
    Object.entries(
      overrides.manifests ?? {
        'package.json': {
          packageManager: 'bun@1.4.0',
          devDependencies: { 'bun-types': '1.4.0', convex: '1.0.0' },
        },
        'apps/itun/package.json': {
          name: 'itun',
          dependencies: { ref: 'workspace:*', lib: 'workspace:*' },
        },
        'apps/srd/package.json': {
          name: 'srd',
          dependencies: { ref: 'workspace:*', lib: 'workspace:*' },
        },
        'apps/discord-bot/package.json': {
          name: 'discord-bot',
          dependencies: { ref: 'workspace:*' },
        },
        'packages/ref/package.json': { name: 'ref' },
        'packages/lib/package.json': { name: 'lib' },
      }
    )
  )
  const missing = new Set(overrides.missing ?? [])
  return {
    files,
    manifests,
    bunVersion: '1.4.0',
    runningBun: overrides.running === undefined ? null : overrides.running,
    exists: (p) => !missing.has(p) && files.some((f) => f.path === p),
  }
}

describe('the real repo', () => {
  test('every workflow check passes on the tree as committed', () => {
    const real = loadContext(REPO, null)
    for (const check of WORKFLOW_CHECKS) {
      expect({ id: check.id, failures: check.run(real).failures }).toEqual({
        id: check.id,
        failures: [],
      })
    }
  })
})

describe('aggregator', () => {
  test('passes when every job is in needs', () => {
    expect(checkAggregator(ctx({})).failures).toEqual([])
  })

  test('a job added without joining needs fails — the gate would have a hole', () => {
    const ci = CI_TEXT.replace(
      '  quality-checks:',
      '  lint:\n    runs-on: ubuntu-latest\n    steps: []\n  quality-checks:'
    )
    expect(checkAggregator(ctx({ ci })).failures.join('\n')).toContain('job `lint` is NOT in')
  })

  test('a needs entry that is not a job is stale', () => {
    const ci = CI_TEXT.replace('      - build\n', '      - build\n      - gone\n')
    expect(checkAggregator(ctx({ ci })).failures.join('\n')).toContain('`gone`, which is not a job')
  })

  test('a shell line shaped like YAML inside a run block is not a job', () => {
    // CI_TEXT's build step echoes "quality-checks:" — a real parse never reads it as a key.
    expect(checkAggregator(ctx({})).ok).toContain('gates all 2 jobs')
  })

  test('no aggregate job, or an empty needs list, fails', () => {
    const renamed = CI_TEXT.replace('  quality-checks:', '  gate:')
    expect(checkAggregator(ctx({ ci: renamed })).failures[0]).toContain('no `quality-checks` job')
    const empty = CI_TEXT.replace(/ {4}needs:\n {6}- changes\n {6}- build\n/, '')
    expect(checkAggregator(ctx({ ci: empty })).failures[0]).toContain('empty `needs:`')
  })

  test('an exemption for a gated job is flagged as dead', () => {
    expect(checkAggregator(ctx({}), { build: 'why' }).failures.join('\n')).toContain(
      'drop the exemption'
    )
  })

  test('a separately-required workflow that is gone fails', () => {
    const c = ctx({ missing: ['.github/workflows/codeql.yml'] })
    expect(checkAggregator(c).failures.join('\n')).toContain('codeql.yml is missing')
  })
})

describe('path-filters', () => {
  test('passes when every workspace dependency is covered, expanding the *shared alias', () => {
    const c = ctx({})
    for (const app of ['itun', 'srd']) {
      c.manifests.set(`apps/${app}/package.json`, {
        name: app,
        dependencies: { ref: 'workspace:*' },
      })
    }
    const r = checkPathFilters(c)
    // The fixture is deliberately small, so only the scan floor may complain.
    expect(r.failures).toEqual(['checked 3 workspace dependency edge(s); expected at least 5.'])
  })

  test('an app depending on a workspace its group does not cover fails', () => {
    const failures = checkPathFilters(ctx({})).failures.join('\n')
    expect(failures).toContain('apps/itun depends on `lib` (packages/lib)')
    expect(failures).toContain('apps/srd depends on `lib`')
  })

  test('an app with no filter group and no exemption fails', () => {
    const c = ctx({})
    c.manifests.set('apps/new-app/package.json', { name: 'new-app' })
    expect(checkPathFilters(c).failures.join('\n')).toContain('apps/new-app has no filter group')
  })
})

describe('pinning', () => {
  test('a third-party action on a mutable tag fails, first-party ones do not', () => {
    const extra = [
      yaml(
        '.github/workflows/x.yml',
        'jobs:\n  a:\n    steps:\n      - uses: oven-sh/setup-bun@v2\n'
      ),
    ]
    const failures = checkPinning(ctx({ extra })).failures
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('oven-sh/setup-bun@v2')
  })

  test('composite actions are scanned, and a short SHA is not a pin', () => {
    const extra = [
      yaml(
        '.github/actions/y/action.yml',
        'runs:\n  using: composite\n  steps:\n    - uses: some/action@abc1234\n'
      ),
    ]
    expect(checkPinning(ctx({ extra })).failures[0]).toContain('some/action@abc1234')
  })

  test('a reusable-workflow call at job level is scanned too', () => {
    const extra = [
      yaml(
        '.github/workflows/z.yml',
        'jobs:\n  a:\n    uses: org/repo/.github/workflows/w.yml@main\n'
      ),
    ]
    expect(checkPinning(ctx({ extra })).failures[0]).toContain(
      'org/repo/.github/workflows/w.yml@main'
    )
  })

  test('an undeclared bunx tool needs an exact version; a declared one does not', () => {
    const run = (cmd: string) =>
      checkPinning(
        ctx({
          extra: [
            yaml('.github/workflows/r.yml', `jobs:\n  a:\n    steps:\n      - run: ${cmd}\n`),
          ],
        })
      ).failures
    expect(run('bunx wrangler deploy')).toHaveLength(1)
    expect(run('bunx wrangler@latest deploy')).toHaveLength(1)
    expect(run('bunx wrangler@4 deploy')).toHaveLength(1)
    expect(run('bunx wrangler@4.132.0 deploy')).toEqual([])
    expect(run('bunx convex deploy')).toEqual([])
  })

  test('a bare name that is only the suffix of a scoped dependency is NOT exempt', () => {
    const c = ctx({})
    c.manifests.set('apps/itun/package.json', {
      name: 'itun',
      dependencies: { '@convex-dev/auth': '1.0.0' },
    })
    c.files.push(
      yaml('.github/workflows/r.yml', 'jobs:\n  a:\n    steps:\n      - run: bunx auth init\n')
    )
    expect(checkPinning(c).failures[0]).toContain('bunx auth')
  })

  test('runnerCalls ignores shell comments and sees npx and bun x', () => {
    expect(runnerCalls('# bunx nope\nnpx a@1.0.0 && bun x b')).toEqual([
      { runner: 'npx', tool: 'a@1.0.0' },
      { runner: 'bun x', tool: 'b' },
    ])
    expect(toolIsPinned('@scope/tool@1.2.3')).toBe(true)
    expect(toolIsPinned('@scope/tool')).toBe(false)
  })
})

describe('bun-version', () => {
  test('passes when bun-types matches and nothing pins Bun by hand', () => {
    expect(checkBunVersion(ctx({})).failures).toEqual([])
  })

  test('the running Bun is compared only when injected, so the suite passes on any Bun', () => {
    expect(checkBunVersion(ctx({ running: '1.4.0' })).failures).toEqual([])
    expect(checkBunVersion(ctx({ running: '1.3.11' })).failures[0]).toContain(
      'running Bun is 1.3.11'
    )
  })

  test('bun-types drift, or no bun-types at all, fails', () => {
    const drift = ctx({})
    drift.manifests.set('package.json', {
      packageManager: 'bun@1.4.0',
      devDependencies: { 'bun-types': '1.3.10' },
    })
    expect(checkBunVersion(drift).failures[0]).toContain('bun-types = 1.3.10')
    const none = ctx({})
    none.manifests.set('package.json', { packageManager: 'bun@1.4.0' })
    expect(checkBunVersion(none).failures[0]).toContain('no bun-types')
  })

  test('packageManager must name the pinned Bun — actions that install their own Bun read it', () => {
    const drift = ctx({})
    drift.manifests.set('package.json', {
      packageManager: 'bun@1.3.11',
      devDependencies: { 'bun-types': '1.4.0' },
    })
    expect(checkBunVersion(drift).failures).toEqual([
      expect.stringContaining('packageManager = bun@1.3.11, expected bun@1.4.0'),
    ])
    const absent = ctx({})
    absent.manifests.set('package.json', { devDependencies: { 'bun-types': '1.4.0' } })
    expect(checkBunVersion(absent).failures[0]).toContain('packageManager = (absent)')
  })

  test('a hand pin fails even when it matches today; bun-version-file does not', () => {
    const pinned = (v: string) => [
      yaml(
        '.github/workflows/p.yml',
        `jobs:\n  a:\n    steps:\n      - uses: oven-sh/setup-bun@${SHA}\n        with:\n          bun-version: ${v}\n`
      ),
    ]
    expect(checkBunVersion(ctx({ extra: pinned('1.2.0') })).failures[0]).toContain(
      'pins bun-version 1.2.0'
    )
    expect(checkBunVersion(ctx({ extra: pinned('1.4.0') })).failures[0]).toContain('matches today')
  })
})

describe('convex-guard', () => {
  test('passes on a workflow that deploys the backend and guards the key', () => {
    expect(checkConvexGuard(ctx({})).failures).toEqual([])
  })

  test('a missing deploy workflow fails', () => {
    expect(checkConvexGuard(ctx({ deploy: null })).failures[0]).toContain('is missing')
  })

  test('deleting the guard STEP fails even while its tokens survive elsewhere', () => {
    const deploy = DEPLOY_TEXT.replace(`name: ${GUARD_STEP}`, 'name: Some other guard')
    expect(checkConvexGuard(ctx({ deploy })).failures[0]).toContain(`no \`${GUARD_STEP}\` step`)
  })

  test('a guard that can no longer exit, or no longer names the key, fails', () => {
    expect(
      checkConvexGuard(ctx({ deploy: DEPLOY_TEXT.replace('exit 1', 'true') })).failures
    ).toHaveLength(1)
    const renamed = DEPLOY_TEXT.replace('if [ -z "$CONVEX_DEPLOY_KEY" ]', 'if [ -z "$OTHER" ]')
    expect(checkConvexGuard(ctx({ deploy: renamed })).failures).toHaveLength(1)
  })

  test('`convex deploy` mentioned only in a shell comment does not count', () => {
    const deploy = DEPLOY_TEXT.replace(
      'run: bunx convex deploy --cmd "true"',
      'run: |\n          # bunx convex deploy used to run here\n          true'
    )
    expect(checkConvexGuard(ctx({ deploy })).failures[0]).toContain(
      'no longer runs `convex deploy`'
    )
  })

  test('a push in a job that does not need the guard job fails', () => {
    const deploy = DEPLOY_TEXT.replace(
      '  push-convex:\n    needs: [plan, build-srd, build-itun]\n',
      '  push-convex:\n'
    )
    expect(checkConvexGuard(ctx({ deploy })).failures).toEqual([
      expect.stringContaining('`push-convex` runs `convex deploy` without needing `plan`'),
    ])
  })
})

describe('deploy-order', () => {
  test('passes when builds precede deploys, deploys precede smoke, smoke precedes record', () => {
    expect(checkDeployOrder(ctx({})).failures).toEqual([])
  })

  test('a deploy job that does not wait for EVERY build fails', () => {
    const deploy = DEPLOY_TEXT.replace(
      '  deploy-bot:\n    needs: [plan, build-srd, build-itun, push-convex]',
      '  deploy-bot:\n    needs: [plan, build-srd]'
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining('`deploy-bot` does not need `build-itun`'),
      expect.stringContaining('`deploy-bot` does not need `push-convex`'),
    ])
  })

  test('transitive needs count — waiting on a job that waits is waiting', () => {
    const deploy = DEPLOY_TEXT.replace(
      '  record:\n    needs: [plan, smoke]',
      '  record:\n    needs: [smoke]'
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([])
  })

  test('smoke that can run before a deploy, or a record before smoke, fails', () => {
    const early = DEPLOY_TEXT.replace(
      '  smoke:\n    needs: [plan, deploy-srd, deploy-bot]',
      '  smoke:\n    needs: [plan, deploy-srd]'
    )
    expect(checkDeployOrder(ctx({ deploy: early })).failures[0]).toContain(
      '`smoke` does not need `deploy-bot`'
    )
    const record = DEPLOY_TEXT.replace(
      '  record:\n    needs: [plan, smoke]',
      '  record:\n    needs: [plan]'
    )
    expect(checkDeployOrder(ctx({ deploy: record })).failures[0]).toContain(
      '`record` does not need `smoke`'
    )
  })

  test('a Convex push that does not wait for EVERY build fails', () => {
    const deploy = DEPLOY_TEXT.replace(
      '  push-convex:\n    needs: [plan, build-srd, build-itun]',
      '  push-convex:\n    needs: [plan, build-itun]'
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining('`push-convex` does not need `build-srd`'),
    ])
  })

  test('a Convex push inside a build job fails — a sibling build failure would not stop it', () => {
    const deploy = DEPLOY_TEXT.replace(
      '      - run: bun run build\n',
      '      - run: bunx convex deploy --cmd "bun run build"\n'
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toContainEqual(
      expect.stringContaining('`build-itun` does not need `build-srd`')
    )
  })

  test('a deploy job that can ship before the backend push fails', () => {
    const deploy = DEPLOY_TEXT.replace(
      '  deploy-bot:\n    needs: [plan, build-srd, build-itun, push-convex]',
      '  deploy-bot:\n    needs: [plan, build-srd, build-itun]'
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining('`deploy-bot` does not need `push-convex`'),
    ])
  })

  test('a job behind a skippable job with only the implicit success() fails', () => {
    const deploy = DEPLOY_TEXT.replace(
      "    if: ${{ !cancelled() && !failure() && needs.smoke.result == 'success' }}",
      "    if: needs.smoke.result == 'success'"
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining('`record` has no explicit status function'),
    ])
  })

  test('a record that does not require smoke to have succeeded fails', () => {
    const deploy = DEPLOY_TEXT.replace(
      "    if: ${{ !cancelled() && !failure() && needs.smoke.result == 'success' }}",
      '    if: ${{ !cancelled() && !failure() }}'
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining("does not require `needs.smoke.result == 'success'`"),
    ])
  })

  test('a workflow with no builds, deploys, smoke or record fails rather than passing empty', () => {
    const deploy = 'on: workflow_dispatch\njobs:\n  a:\n    steps:\n      - run: echo hi\n'
    expect(checkDeployOrder(ctx({ deploy })).failures).toHaveLength(4)
    expect(checkDeployOrder(ctx({ deploy: null })).failures[0]).toContain('is missing')
  })
})
