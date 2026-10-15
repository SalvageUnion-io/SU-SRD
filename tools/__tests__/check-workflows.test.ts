import { describe, expect, spyOn, test } from 'bun:test'
import { join } from 'node:path'
import type { WorkflowContext, WorkflowFile } from '../check-workflows'
import {
  checkAggregator,
  checkDeployOrder,
  checkPathFilters,
  checkPinning,
  checkSecretsEnv,
  GUARD_STEP,
  loadContext,
  main,
  runnerCalls,
  toolIsPinned,
  WORKFLOW_CHECKS,
} from '../check-workflows'
import { MAIN_RULESET } from '../environments'

/**
 * `tools/check-workflows.ts` — five merge-gating invariants over `.github/`.
 *
 * Every case builds its context from YAML TEXT through `Bun.YAML.parse`, the
 * same path the real run takes, so a fixture cannot pass by being shaped
 * differently from a workflow.
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
            assets:
              - *shared
              - 'apps/su-assets/**'
            web:
              - *shared
              - 'apps/web/**'
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
    name: CI Success
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
    outputs:
      stale: \${{ steps.surfaces.outputs.stale }}
      deploy: \${{ steps.surfaces.outputs.deploy }}
    steps:
      - uses: ./.github/actions/setup-bun
      - name: Decide which surfaces to deploy
        id: surfaces
        run: bun tools/deploy-surfaces.ts
      - name: ${GUARD_STEP}
        env:
          CONVEX_DEPLOY_KEY: x
        run: |
          if [ -z "$CONVEX_DEPLOY_KEY" ]; then
            exit 1
          fi
  build-srd:
    needs: plan
    if: contains(fromJSON(needs.plan.outputs.deploy), 'srd')
    runs-on: ubuntu-latest
    steps:
      - run: bun --filter web build
      - uses: actions/upload-artifact@v7
        with:
          name: srd-build
  og-srd:
    needs: [plan, build-srd]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v8
        with:
          name: srd-build
      - uses: actions/upload-artifact@v7
        with:
          name: srd-dist
  build-cantina:
    needs: plan
    if: contains(fromJSON(needs.plan.outputs.deploy), 'cantina')
    runs-on: ubuntu-latest
    steps:
      - run: bun run build
      - uses: actions/upload-artifact@v7
        with:
          name: cantina-dist
  push-convex:
    needs: [plan, build-srd, build-cantina]
    if: \${{ !cancelled() && !failure() && contains(fromJSON(needs.plan.outputs.deploy), 'cantina') }}
    runs-on: ubuntu-latest
    steps:
      - name: Push
        run: bunx convex deploy --cmd "true"
  deploy:
    needs: [plan, build-srd, og-srd, build-cantina, push-convex]
    if: \${{ !cancelled() && !failure() && needs.plan.outputs.deploy != '[]' }}
    strategy:
      fail-fast: false
      matrix:
        app: \${{ fromJSON(needs.plan.outputs.deploy) }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v8
        if: matrix.app == 'srd'
        with:
          name: srd-dist
      - uses: actions/download-artifact@v8
        if: matrix.app == 'cantina'
        with:
          name: cantina-dist
      - run: bun run deploy
  smoke:
    needs: [plan, deploy]
    if: \${{ !cancelled() && !failure() && needs.plan.outputs.stale != 'true' }}
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

function ctx(overrides: {
  ci?: string
  deploy?: string | null
  extra?: WorkflowFile[]
  manifests?: Record<string, object>
  missing?: string[]
}): WorkflowContext {
  const files = [
    yaml('.github/workflows/ci.yml', overrides.ci ?? CI_TEXT),
    yaml(
      '.github/workflows/codeql.yml',
      'jobs:\n  a:\n    steps:\n      - uses: github/codeql-action/init@v4\n'
    ),
    yaml(
      '.github/workflows/pr-title.yml',
      'jobs:\n  pr-title:\n    steps:\n      - run: echo ok\n'
    ),
    yaml(
      '.github/workflows/nightly.yml',
      'jobs:\n  a:\n    steps:\n      - uses: ./.github/actions/setup-bun\n'
    ),
    yaml(
      '.github/workflows/other.yml',
      'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v7\n'
    ),
    ...(overrides.extra ?? []),
  ]
  if (overrides.deploy !== null) {
    files.push(yaml('.github/workflows/deploy-cloudflare.yml', overrides.deploy ?? DEPLOY_TEXT))
  }
  const manifests = new Map<string, object>(
    Object.entries(
      overrides.manifests ?? {
        'package.json': { devDependencies: { convex: '1.0.0' } },
        'apps/su-assets/package.json': {
          name: 'su-assets',
          dependencies: { ref: 'workspace:*', lib: 'workspace:*' },
        },
        'apps/web/package.json': {
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
    lockBins: new Map([['@playwright/test', ['playwright']]]),
    exists: (p) => !missing.has(p) && files.some((f) => f.path === p),
  }
}

describe('the real repo', () => {
  test('every workflow check passes on the tree as committed', () => {
    const real = loadContext(REPO)
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

  test('a workflow the ruleset still waits on that is gone fails', () => {
    const c = ctx({ missing: ['.github/workflows/codeql.yml'] })
    expect(checkAggregator(c).failures.join('\n')).toContain('codeql.yml is missing')
    const title = ctx({ missing: ['.github/workflows/pr-title.yml'] })
    expect(checkAggregator(title).failures.join('\n')).toContain('pr-title.yml is missing')
  })

  test('the declared ruleset must require the aggregate gate by its name', () => {
    const ruleset = { ...MAIN_RULESET, requiredChecks: ['PR title is a conventional commit'] }
    expect(checkAggregator(ctx({}), {}, ruleset).failures).toEqual([
      expect.stringContaining('does not require `CI Success`'),
    ])
  })

  test('a required context no known workflow produces fails', () => {
    const ruleset = { ...MAIN_RULESET, requiredChecks: ['CI Success', 'Mystery'] }
    expect(checkAggregator(ctx({}), {}, ruleset).failures.join('\n')).toContain(
      'waits on `Mystery`, which no workflow is known to produce'
    )
  })
})

describe('path-filters', () => {
  test('passes when every workspace dependency is covered, expanding the *shared alias', () => {
    const c = ctx({})
    for (const app of ['su-assets', 'web']) {
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
    expect(failures).toContain('apps/su-assets depends on `lib` (packages/lib)')
    expect(failures).toContain('apps/web depends on `lib`')
  })

  test('an app with no filter group and no exemption fails', () => {
    const c = ctx({})
    c.manifests.set('apps/new-app/package.json', { name: 'new-app' })
    expect(checkPathFilters(c).failures.join('\n')).toContain('apps/new-app has no filter group')
  })

  test('a ci.yml whose paths-filter step moved or is not a mapping trips the scan floor', () => {
    const noStep = CI_TEXT.replace(/ {6}- uses: dorny\/paths-filter@[\s\S]*?(?= {2}build:)/, '')
    expect(checkPathFilters(ctx({ ci: noStep })).failures[0]).toBe(
      'parsed 0 filter group(s) from .github/workflows/ci.yml; expected at least 4 — the block moved.'
    )
    const listed = CI_TEXT.replace(
      /filters: \|\n[\s\S]*?(?= {2}build:)/,
      "filters: |\n            - 'apps/**'\n"
    )
    expect(checkPathFilters(ctx({ ci: listed })).failures[0]).toContain('parsed 0 filter group(s)')
  })

  test('an app mapped to a group ci.yml does not define fails, naming the group', () => {
    const c = ctx({
      ci: CI_TEXT.replace(
        "            assets:\n              - *shared\n              - 'apps/su-assets/**'\n",
        ''
      ),
    })
    c.manifests.set('apps/su-assets/package.json', {
      name: 'su-assets',
      dependencies: { ref: 'workspace:*' },
    })
    expect(checkPathFilters(c).failures).toContain(
      'apps/su-assets maps to filter group `assets`, which .github/workflows/ci.yml does not define.'
    )
  })

  test('a workspace: dependency no workspace declares fails rather than passing as covered', () => {
    const c = ctx({})
    c.manifests.set('apps/discord-bot/package.json', {
      name: 'discord-bot',
      dependencies: { ref: 'workspace:*', ghost: 'workspace:*', zod: '4.0.0' },
    })
    expect(checkPathFilters(c).failures).toContain(
      'apps/discord-bot depends on workspace `ghost`, which no workspace declares.'
    )
  })
})

describe('pinning', () => {
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

  test("a declared package's lockfile bin is exempt; the same bin undeclared is not", () => {
    const run = (declared: boolean) => {
      const c = ctx({})
      if (declared)
        c.manifests.set('apps/web/package.json', {
          devDependencies: { '@playwright/test': '1.0.0' },
        })
      c.files.push(
        yaml(
          '.github/workflows/r.yml',
          'jobs:\n  a:\n    steps:\n      - run: bunx playwright test\n'
        )
      )
      return checkPinning(c).failures
    }
    expect(run(true)).toEqual([])
    expect(run(false)[0]).toContain('bunx playwright')
  })

  test('a bare name that is only the suffix of a scoped dependency is NOT exempt', () => {
    const c = ctx({})
    c.manifests.set('apps/su-assets/package.json', {
      name: 'su-assets',
      dependencies: { '@convex-dev/auth': '1.0.0' },
    })
    c.files.push(
      yaml('.github/workflows/r.yml', 'jobs:\n  a:\n    steps:\n      - run: bunx auth init\n')
    )
    expect(checkPinning(c).failures[0]).toContain('bunx auth')
  })

  test('scanning fewer than five workflow files fails the scan floor', () => {
    const c = ctx({})
    c.files.splice(2)
    expect(checkPinning(c).failures).toEqual([
      'only 2 workflow file(s) scanned — expected at least 5.',
    ])
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

/** A job-level `if:` line as the fixture writes it, `\${{ … }}` and all. */
const jobIf = (expr: string) => `    if: \${{ ${expr} }}`

/** The matrix deploy job's header and `needs:`, as the fixture writes them. */
const NEEDS = '  deploy:\n    needs: [plan, build-srd, og-srd, build-cantina, push-convex]'

describe('deploy-order', () => {
  test('passes when builds precede deploys, deploys precede smoke, smoke precedes record', () => {
    expect(checkDeployOrder(ctx({})).failures).toEqual([])
  })

  test('a deploy job that does not wait for EVERY build fails', () => {
    const deploy = DEPLOY_TEXT.replace(NEEDS, '  deploy:\n    needs: [plan, build-srd, og-srd]')
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining('`deploy` does not need `build-cantina` — every build must finish'),
      expect.stringContaining('`deploy` does not need `push-convex`'),
      expect.stringContaining(
        '`deploy` does not need `build-cantina` — it downloads `cantina-dist`'
      ),
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
      '  smoke:\n    needs: [plan, deploy]',
      '  smoke:\n    needs: [plan]'
    )
    expect(checkDeployOrder(ctx({ deploy: early })).failures[0]).toContain(
      '`smoke` does not need `deploy`'
    )
    const record = DEPLOY_TEXT.replace(
      '  record:\n    needs: [plan, smoke]',
      '  record:\n    needs: [plan]'
    )
    expect(checkDeployOrder(ctx({ deploy: record })).failures[0]).toContain(
      '`record` does not need `smoke`'
    )
  })

  test('deleting the deploy-key guard STEP fails, wherever its tokens survive', () => {
    const deploy = DEPLOY_TEXT.replace(`name: ${GUARD_STEP}`, 'name: Some other guard')
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining(`no \`${GUARD_STEP}\` step`),
    ])
  })

  test('a guard that can no longer exit, or no longer names the key, fails', () => {
    const noExit = DEPLOY_TEXT.replace('exit 1', 'true')
    expect(checkDeployOrder(ctx({ deploy: noExit })).failures).toEqual([
      expect.stringContaining('no longer fails when CONVEX_DEPLOY_KEY is absent'),
    ])
    const renamed = DEPLOY_TEXT.replace('$CONVEX_DEPLOY_KEY', '$OTHER')
    expect(checkDeployOrder(ctx({ deploy: renamed })).failures).toEqual([
      expect.stringContaining('no longer fails when CONVEX_DEPLOY_KEY is absent'),
    ])
  })

  test('a Convex push in a job that does not need the guard job fails', () => {
    const guarded = DEPLOY_TEXT.replace(
      `      - name: ${GUARD_STEP}\n`,
      `  guard:\n    runs-on: ubuntu-latest\n    steps:\n      - name: ${GUARD_STEP}\n`
    )
    expect(checkDeployOrder(ctx({ deploy: guarded })).failures).toEqual([
      expect.stringContaining('`push-convex` does not need `guard` — the deploy-key guard'),
    ])
  })

  test('`convex deploy` mentioned only in a shell comment is no push', () => {
    const deploy = DEPLOY_TEXT.replace(
      'run: bunx convex deploy --cmd "true"',
      'run: |\n          # bunx convex deploy used to run here\n          true'
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining('has no job that runs `convex deploy`'),
    ])
  })

  test('a Convex push that does not wait for EVERY build fails', () => {
    const deploy = DEPLOY_TEXT.replace(
      '  push-convex:\n    needs: [plan, build-srd, build-cantina]',
      '  push-convex:\n    needs: [plan, build-cantina]'
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
      expect.stringContaining('`build-cantina` does not need `build-srd`')
    )
  })

  test('a deploy job that can ship before the backend push fails', () => {
    const deploy = DEPLOY_TEXT.replace(
      NEEDS,
      '  deploy:\n    needs: [plan, build-srd, og-srd, build-cantina]'
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining('`deploy` does not need `push-convex`'),
    ])
  })

  test('a post-build pass is not a build: only the job shipping its output waits for it', () => {
    expect(DEPLOY_TEXT).toContain('  push-convex:\n    needs: [plan, build-srd, build-cantina]\n')
    expect(checkDeployOrder(ctx({})).failures).toEqual([])
  })

  test('split deploy jobs: only the one shipping the post-build output waits for it', () => {
    const srdLeg = `  deploy-web:
    needs: [plan, build-srd, og-srd, build-cantina, push-convex]
    if: \${{ !cancelled() && !failure() && contains(fromJSON(needs.plan.outputs.deploy), 'srd') }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v8
        with:
          name: srd-dist
      - run: bun run deploy
`
    const split = DEPLOY_TEXT.replace(
      `${NEEDS}\n`,
      `${srdLeg}  deploy:\n    needs: [plan, build-srd, build-cantina, push-convex]\n`
    )
      .replace(
        "      - uses: actions/download-artifact@v8\n        if: matrix.app == 'srd'\n        with:\n          name: srd-dist\n",
        ''
      )
      .replace('    needs: [plan, deploy]', '    needs: [plan, deploy-web, deploy]')
    expect(checkDeployOrder(ctx({ deploy: split })).failures).toEqual([])

    const early = split.replace(
      '  deploy-web:\n    needs: [plan, build-srd, og-srd, build-cantina, push-convex]',
      '  deploy-web:\n    needs: [plan, og-srd]'
    )
    expect(checkDeployOrder(ctx({ deploy: early })).failures).toContainEqual(
      expect.stringContaining('`deploy-web` does not need `build-cantina`')
    )
    const unsmoked = split.replace(
      '    needs: [plan, deploy-web, deploy]',
      '    needs: [plan, deploy]'
    )
    expect(checkDeployOrder(ctx({ deploy: unsmoked })).failures).toEqual([
      expect.stringContaining('`smoke` does not need `deploy-web`'),
    ])
  })

  test('a deploy that does not wait for the job uploading what it ships fails', () => {
    const deploy = DEPLOY_TEXT.replace(
      NEEDS,
      '  deploy:\n    needs: [plan, build-srd, build-cantina, push-convex]'
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining('`deploy` does not need `og-srd` — it downloads `srd-dist`'),
    ])
  })

  test('a download that no job uploads fails', () => {
    const deploy = DEPLOY_TEXT.replace(
      "        if: matrix.app == 'srd'\n        with:\n          name: srd-dist\n",
      "        if: matrix.app == 'srd'\n        with:\n          name: srd-typo\n"
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining('downloads `srd-typo`, which no job uploads'),
    ])
  })

  test('a job behind a skippable job with only the implicit success() fails', () => {
    const deploy = DEPLOY_TEXT.replace(
      jobIf("!cancelled() && !failure() && needs.smoke.result == 'success'"),
      "    if: needs.smoke.result == 'success'"
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining('`record` has no explicit status function'),
    ])
  })

  test('a record that does not require smoke to have succeeded fails', () => {
    const deploy = DEPLOY_TEXT.replace(
      jobIf("!cancelled() && !failure() && needs.smoke.result == 'success'"),
      jobIf('!cancelled() && !failure()')
    )
    expect(checkDeployOrder(ctx({ deploy })).failures).toEqual([
      expect.stringContaining("does not require `needs.smoke.result == 'success'`"),
    ])
  })

  test('a workflow with no guard, push, builds, deploys, smoke or record fails rather than passing empty', () => {
    const deploy = 'on: workflow_dispatch\njobs:\n  a:\n    steps:\n      - run: echo hi\n'
    expect(checkDeployOrder(ctx({ deploy })).failures).toHaveLength(6)
    expect(checkDeployOrder(ctx({ deploy: null })).failures[0]).toContain('is missing')
  })
})

describe('secrets-env', () => {
  /** A workflow with one job reading `secret`; `env` is its `environment:`, if any. */
  const job = (
    secret: string,
    env?: string,
    path = `.github/workflows/${secret.toLowerCase()}.yml`,
    id = 'release'
  ) =>
    yaml(
      path,
      [
        'jobs:',
        `  ${id}:`,
        '    runs-on: ubuntu-latest',
        ...(env === undefined ? [] : [`    environment: ${env}`]),
        '    steps:',
        '      - run: ./release.sh',
        '        env:',
        `          TOKEN: \${{ secrets.${secret} }}`,
        '',
      ].join('\n')
    )
  const decl = {
    environments: [
      {
        name: 'production',
        branches: ['main'],
        secrets: ['CONVEX_DEPLOY_KEY', 'DISCORD_TOKEN'],
      },
    ],
    sentinel: null,
  }
  const run = (...extra: WorkflowFile[]) => checkSecretsEnv(ctx({ extra }), decl).failures

  test('a job reading a production secret inside the environment passes', () => {
    expect(run(job('CONVEX_DEPLOY_KEY', 'production'))).toEqual([])
    expect(run(job('CONVEX_DEPLOY_KEY', '{ name: production }'))).toEqual([])
  })

  test('the same job outside the environment fails, naming the job and the secret', () => {
    expect(run(job('CONVEX_DEPLOY_KEY'))).toEqual([
      expect.stringContaining('job `release` reads secrets.CONVEX_DEPLOY_KEY without'),
    ])
  })

  test('an environment tools/environments.ts does not declare fails, as does reading outside production', () => {
    expect(run(job('DISCORD_TOKEN', 'staging'))).toEqual([
      expect.stringContaining(
        'names environment `staging`, which tools/environments.ts does not declare'
      ),
      expect.stringContaining('reads secrets.DISCORD_TOKEN without `environment: production`'),
    ])
  })

  test('a secret held by two Environments may be read inside either, and not outside both', () => {
    const shared = {
      environments: [
        ...decl.environments,
        { name: 'preview', branches: ['**/*'], secrets: ['DISCORD_TOKEN'], reviewers: ['o'] },
      ],
      sentinel: null,
    }
    const runShared = (...extra: WorkflowFile[]) => checkSecretsEnv(ctx({ extra }), shared).failures
    expect(runShared(job('DISCORD_TOKEN', 'production'))).toEqual([])
    expect(runShared(job('DISCORD_TOKEN', 'preview'))).toEqual([])
    expect(runShared(job('CONVEX_DEPLOY_KEY', 'preview'))).toEqual([
      expect.stringContaining('without `environment: production`'),
    ])
    expect(runShared(job('DISCORD_TOKEN'))).toEqual([
      expect.stringContaining('without `environment: production` or `preview`'),
    ])
  })

  test('a job reading only GITHUB_TOKEN needs no environment', () => {
    expect(run(job('GITHUB_TOKEN'), job('DISCORD_TOKEN', 'production'))).toEqual([])
  })

  test('no job reading a production secret fails rather than passing empty', () => {
    expect(run(job('GITHUB_TOKEN'))[0]).toContain('would pass by doing nothing')
    expect(run()[0]).toContain('would pass by doing nothing')
  })

  describe('the repository-secret sentinel', () => {
    const SENTINEL = { file: '.github/workflows/nightly.yml', job: 'environments' }
    const withSentinel = (...extra: WorkflowFile[]) =>
      checkSecretsEnv(ctx({ extra: [job('DISCORD_TOKEN', 'production'), ...extra] }), {
        ...decl,
        sentinel: SENTINEL,
      }).failures
    const sentinel = (env?: string, secrets = ['CONVEX_DEPLOY_KEY', 'DISCORD_TOKEN']) =>
      yaml(
        SENTINEL.file,
        [
          'jobs:',
          '  environments:',
          '    runs-on: ubuntu-latest',
          ...(env === undefined ? [] : [`    environment: ${env}`]),
          '    steps:',
          '      - run: bun tools/environments.ts --secrets-from-env',
          '        env:',
          ...secrets.map((s) => `          ${s}: \${{ secrets.${s} }}`),
          '',
        ].join('\n')
      )

    test('outside every environment, mapping every secret, it passes', () => {
      expect(withSentinel(sentinel())).toEqual([])
    })

    test('missing, it fails rather than leaving repository copies unwatched', () => {
      expect(withSentinel()).toEqual([
        expect.stringContaining(
          'sentinel (.github/workflows/nightly.yml job `environments`) is missing'
        ),
      ])
    })

    test('inside an environment it proves nothing, so it fails', () => {
      expect(withSentinel(sentinel('production'))).toEqual([
        expect.stringContaining('must declare no environment'),
      ])
    })

    test('a secret it does not map is named', () => {
      expect(withSentinel(sentinel(undefined, ['CONVEX_DEPLOY_KEY']))).toEqual([
        expect.stringContaining('does not map secrets.DISCORD_TOKEN'),
      ])
    })

    test('the same job in another file gets no exemption', () => {
      expect(
        withSentinel(
          sentinel(),
          job('CONVEX_DEPLOY_KEY', undefined, '.github/workflows/other.yml', 'environments')
        )
      ).toEqual([
        expect.stringContaining(
          'other.yml job `environments` reads secrets.CONVEX_DEPLOY_KEY without'
        ),
      ])
    })
  })
})

describe('main', () => {
  const run = (argv: string[], c: WorkflowContext = ctx({})) => {
    const out = spyOn(console, 'log').mockImplementation(() => {})
    const err = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = main(argv, () => c)
      const lines = (spy: typeof out) => spy.mock.calls.map((call) => String(call[0]))
      return { code, out: lines(out), err: lines(err) }
    } finally {
      out.mockRestore()
      err.mockRestore()
    }
  }

  test('an unknown --only id exits 2, listing the known ones', () => {
    const r = run(['--only=pinning,bogus'])
    expect(r.code).toBe(2)
    expect(r.err[0]).toStartWith('✗ unknown check(s): bogus. Known: aggregator, ')
  })

  test('--only runs just those checks and passes when they do', () => {
    const r = run(['--only=aggregator'])
    expect(r).toEqual({
      code: 0,
      out: [expect.stringMatching(/^✓ .*: `quality-checks` gates all 2 jobs/)],
      err: [],
    })
  })

  test('every failure is listed under its check, and the run fails', () => {
    const r = run(['--only=aggregator,path-filters'])
    expect(r.code).toBe(1)
    expect(r.out).toHaveLength(1)
    expect(r.err[0]).toMatch(/^✗ .*:$/)
    expect(r.err.slice(1).every((l) => l.startsWith('    • '))).toBe(true)
    expect(r.err.join('\n')).toContain('apps/su-assets depends on `lib`')
  })
})
