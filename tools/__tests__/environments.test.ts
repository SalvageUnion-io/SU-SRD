import { describe, expect, test } from 'bun:test'
import type { EnvironmentSpec, LiveEnvironment, LiveState } from '../environments'
import { compare, ENVIRONMENTS, REPOSITORY_SECRETS } from '../environments'

/**
 * `tools/environments.ts` — the declared GitHub Environments against a live
 * snapshot. `compare` is pure, so every case is a hand-built snapshot; the
 * `gh api` reads around it are thin and exercised by the nightly job.
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
    const f = failures(live({ repositorySecrets: ['A_TOKEN', 'NETLIFY_SITE_ID'] }))
    expect(f).toEqual([
      expect.stringContaining('A_TOKEN is still a repository secret, readable from any branch'),
      expect.stringContaining('NETLIFY_SITE_ID is an undeclared repository secret'),
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
  test('production admits main alone and holds the four deploy secrets', () => {
    expect(ENVIRONMENTS).toEqual([
      {
        name: 'production',
        branches: ['main'],
        secrets: [
          'CLOUDFLARE_API_TOKEN',
          'CONVEX_DEPLOY_KEY',
          'SENTRY_AUTH_TOKEN',
          'RELEASE_PLEASE_TOKEN',
        ],
      },
    ])
  })

  test('no secret is allowed at repository level', () => {
    expect(REPOSITORY_SECRETS).toEqual([])
  })
})
