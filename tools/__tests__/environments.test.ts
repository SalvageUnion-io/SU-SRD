import { describe, expect, test } from 'bun:test'
import type { EnvironmentSpec, GhApi, GhResult, LiveEnvironment, LiveState } from '../environments'
import { apply, compare, ENVIRONMENTS, REPO, REPOSITORY_SECRETS, readLive } from '../environments'

/**
 * `tools/environments.ts` — the declared GitHub Environments against a live
 * snapshot. `compare` is pure, so its cases are hand-built snapshots; the
 * `gh api` reads and writes take an injected runner, faked here by path.
 */

const SPEC: EnvironmentSpec[] = [
  { name: 'production', branches: ['main'], secrets: ['A_TOKEN', 'B_KEY'] },
]

const env = (over: Partial<LiveEnvironment> = {}): LiveEnvironment => ({
  name: 'production',
  policy: 'custom',
  branches: ['main'],
  secrets: ['A_TOKEN', 'B_KEY'],
  ...over,
})

const live = (over: Partial<LiveState> = {}): LiveState => ({
  environments: [env()],
  repositorySecrets: [],
  readableOutside: null,
  ...over,
})

const failures = (state: LiveState, allowed: string[] = []) =>
  compare(SPEC, allowed, state).failures

describe('compare', () => {
  test('settings that match the declaration pass, and say what was checked', () => {
    const v = compare(SPEC, [], live())
    expect(v.failures).toEqual([])
    expect(v.ran).toContain('production: branch policy')
    expect(v.ran).toContain('repository secrets')
    expect(v.notRun).toEqual([])
  })

  test('a missing Environment fails and points at --apply', () => {
    expect(failures(live({ environments: [] }))).toEqual([
      expect.stringContaining('`production` does not exist'),
    ])
  })

  test('no branch policy (every branch) fails — the 2026-10-07 state', () => {
    expect(failures(live({ environments: [env({ policy: 'none', branches: null })] }))).toEqual([
      expect.stringContaining('admits every branch, not only main'),
    ])
  })

  test('protected-branches policy is not the declared custom policy', () => {
    expect(
      failures(live({ environments: [env({ policy: 'protected', branches: null })] }))[0]
    ).toContain('every protected branch')
  })

  test('an extra or missing admitted branch fails', () => {
    expect(failures(live({ environments: [env({ branches: ['main', 'release'] })] }))[0]).toContain(
      'admits [main, release], declared [main]'
    )
  })

  test('a missing Environment secret fails with the command that prompts for it', () => {
    expect(failures(live({ environments: [env({ secrets: ['A_TOKEN'] })] }))).toEqual([
      expect.stringContaining('has no secret B_KEY — `gh secret set B_KEY --env production'),
    ])
  })

  test('an undeclared Environment secret fails', () => {
    expect(
      failures(live({ environments: [env({ secrets: ['A_TOKEN', 'B_KEY', 'C'] })] }))[0]
    ).toContain('holds undeclared secret C')
  })

  test('an undeclared Environment fails with its URL-encoded delete command', () => {
    const extra = env({ name: 'main - old-host', policy: 'none', branches: null, secrets: null })
    expect(failures(live({ environments: [env(), extra] }))).toEqual([
      expect.stringContaining('environments/main%20-%20old-host'),
    ])
  })

  test('an Environment secret still at repository level fails; a stray one too', () => {
    const f = failures(live({ repositorySecrets: ['A_TOKEN', 'OLD_HOST_SITE_ID'] }))
    expect(f).toEqual([
      expect.stringContaining('A_TOKEN is still a repository secret, readable from any branch'),
      expect.stringContaining('OLD_HOST_SITE_ID is an undeclared repository secret'),
    ])
  })

  test('an allowed repository secret passes', () => {
    expect(failures(live({ repositorySecrets: ['PUBLIC_THING'] }), ['PUBLIC_THING'])).toEqual([])
  })

  test('a token that cannot list secrets reports those checks as not run, never as passed', () => {
    const v = compare(
      SPEC,
      [],
      live({ environments: [env({ secrets: null })], repositorySecrets: null })
    )
    expect(v.failures).toEqual([])
    expect(v.notRun).toEqual([
      'production: secret names (this token cannot list secrets)',
      'repository secrets (this token cannot list secrets)',
    ])
    expect(v.ran).not.toContain('repository secrets')
  })

  test('the sentinel: an Environment secret readable outside its Environment fails', () => {
    const v = compare(SPEC, [], live({ readableOutside: ['B_KEY', 'UNRELATED'] }))
    expect(v.failures).toEqual([
      expect.stringContaining('B_KEY is readable by a job with no Environment'),
    ])
    expect(v.ran).toContain('2 Environment secret(s) unreadable outside their Environment')
  })

  test('declaring nothing fails rather than passing empty', () => {
    expect(compare([], [], live({ environments: [] })).failures[0]).toContain(
      'would pass by doing nothing'
    )
  })
})

describe('the declaration', () => {
  test('production admits main alone and holds the three deploy secrets', () => {
    expect(ENVIRONMENTS).toEqual([
      {
        name: 'production',
        branches: ['main'],
        secrets: ['CLOUDFLARE_API_TOKEN', 'CONVEX_DEPLOY_KEY', 'SENTRY_AUTH_TOKEN'],
      },
    ])
  })

  test('no secret is allowed at repository level', () => {
    expect(REPOSITORY_SECRETS).toEqual([])
  })
})

/** A fake `gh api`: GET answers by path prefix; every call is recorded. */
function fakeGh(routes: Record<string, GhResult>) {
  const calls: { args: string[]; input?: unknown }[] = []
  const api: GhApi = (args, input) => {
    calls.push({ args, input })
    const path = args.find((a) => a.startsWith('repos/')) ?? ''
    const method = args[0] === '-X' ? args[1] : 'GET'
    if (method !== 'GET') return { ok: true, json: null }
    const hit = Object.entries(routes).find(([prefix]) => path.startsWith(prefix))
    return hit ? hit[1] : { ok: false, status: 404, message: `gh: Not Found (HTTP 404) ${path}` }
  }
  return { api, calls }
}

const ok = (json: unknown): GhResult => ({ ok: true, json })
const forbidden: GhResult = {
  ok: false,
  status: 403,
  message: 'gh: Resource not accessible by integration (HTTP 403)',
}
const E = `repos/${REPO}/environments`

describe('readLive', () => {
  test('reads policy, branches and secret names of declared Environments only', () => {
    const { api } = fakeGh({
      [`${E}/production/deployment-branch-policies`]: ok({
        branch_policies: [
          { id: 1, name: 'main', type: 'branch' },
          { id: 2, name: 'v*', type: 'tag' },
        ],
      }),
      [`${E}/production/secrets`]: ok({ secrets: [{ name: 'CONVEX_DEPLOY_KEY' }] }),
      [`${E}?`]: ok({
        environments: [
          {
            name: 'production',
            deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
          },
          {
            name: 'github-pages',
            deployment_branch_policy: { protected_branches: true, custom_branch_policies: false },
          },
          { name: 'old', deployment_branch_policy: null },
        ],
      }),
      [`repos/${REPO}/actions/secrets`]: ok({ secrets: [{ name: 'OLD_HOST_SITE_ID' }] }),
    })
    expect(readLive(false, api, {})).toEqual({
      environments: [
        {
          name: 'production',
          policy: 'custom',
          branches: ['main'],
          secrets: ['CONVEX_DEPLOY_KEY'],
        },
        { name: 'github-pages', policy: 'protected', branches: null, secrets: null },
        { name: 'old', policy: 'none', branches: null, secrets: null },
      ],
      repositorySecrets: ['OLD_HOST_SITE_ID'],
      readableOutside: null,
    })
  })

  test('a token that cannot list secrets yields null, and the sentinel reads only non-empty values', () => {
    const { api } = fakeGh({
      [`${E}/production/secrets`]: forbidden,
      [`${E}?`]: ok({ environments: [{ name: 'production', deployment_branch_policy: null }] }),
      [`repos/${REPO}/actions/secrets`]: forbidden,
    })
    const state = readLive(true, api, { CONVEX_DEPLOY_KEY: 'x', SENTRY_AUTH_TOKEN: '' })
    expect(state.environments[0]?.secrets).toBeNull()
    expect(state.repositorySecrets).toBeNull()
    expect(state.readableOutside).toEqual(['CONVEX_DEPLOY_KEY'])
  })

  test('any other API failure throws rather than reading as empty', () => {
    const { api } = fakeGh({
      [`${E}?`]: { ok: false, status: 500, message: 'gh: boom (HTTP 500)' },
    })
    expect(() => readLive(false, api, {})).toThrow('GET environments: gh: boom (HTTP 500)')
  })
})

describe('apply', () => {
  test('sets the custom policy, adds the missing branch, removes a stale one, never touches secrets', () => {
    const { api, calls } = fakeGh({
      [`${E}/production/deployment-branch-policies`]: ok({
        branch_policies: [{ id: 7, name: 'release', type: 'branch' }],
      }),
    })
    expect(apply(api)).toEqual([
      'production: custom deployment branch policy',
      'production: admits main',
      'production: no longer admits release',
    ])
    const writes = calls
      .filter((c) => c.args[0] === '-X')
      .map((c) => [c.args[1], c.args[2], c.input])
    expect(writes).toEqual([
      [
        'PUT',
        `${E}/production`,
        { deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } },
      ],
      ['POST', `${E}/production/deployment-branch-policies`, { name: 'main', type: 'branch' }],
      ['DELETE', `${E}/production/deployment-branch-policies/7`, undefined],
    ])
    expect(calls.some((c) => c.args.some((a) => a.includes('secrets')))).toBe(false)
  })

  test('is idempotent: a matching Environment only re-asserts the policy', () => {
    const { api } = fakeGh({
      [`${E}/production/deployment-branch-policies`]: ok({
        branch_policies: [{ id: 1, name: 'main', type: 'branch' }],
      }),
    })
    expect(apply(api)).toEqual(['production: custom deployment branch policy'])
  })
})
