import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReleaseDeps } from '../release'
import { githubApi, liveDeps, main, whatChanged } from '../release'

const ROOT = join(import.meta.dir, '..', '..')
const SHA = 'abc123'
const REPO = 'SalvageUnion-io/SU-SRD'

const BODY = [
  '<!-- attribution -->',
  '## Summary',
  '',
  'Not this.',
  '',
  '## What changed',
  '',
  'The refresh.',
  '',
  '### Features',
  '',
  '* A feature that closes the page in colour.',
  '',
  'Closes #1250, closes #1251',
  '',
  '## Also closes',
  '',
  '- Closes #1062: a plan.',
].join('\n')

type Call = { method: string; path: string; body?: unknown }

function harness(
  routes: Record<string, unknown>,
  version = '3.0.0'
): { deps: ReleaseDeps; calls: Call[]; out: string[]; err: string[] } {
  const calls: Call[] = []
  const out: string[] = []
  const err: string[] = []
  const deps: ReleaseDeps = {
    version: () => version,
    api: async (method, path, body) => {
      calls.push({ method, path, body })
      return routes[`${method} ${path}`] ?? null
    },
    repo: REPO,
    log: (l) => out.push(l),
    error: (l) => err.push(l),
  }
  return { deps, calls, out, err }
}

const merged = (body: string | null, sha = SHA) => [
  { number: 1344, body, merged_at: '2026-10-15T00:00:00Z', merge_commit_sha: sha },
]

describe('whatChanged', () => {
  test('takes the section up to the next ## heading, without Closes lines', () => {
    expect(whatChanged(BODY)).toBe(
      'The refresh.\n\n### Features\n\n* A feature that closes the page in colour.'
    )
  })

  test('runs to the end when it is the last section, and reads CRLF bodies', () => {
    expect(whatChanged('## What changed\r\n\r\nAll of it.\r\n')).toBe('All of it.')
  })

  test('is empty when the body has no such section', () => {
    expect(whatChanged('## Summary\n\nNothing.')).toBe('')
  })

  test("is #1344's section from its first line through Before you play", () => {
    // The section the owner chose as the 3.0.0 notes, shaped like the PR body.
    const notes = whatChanged(
      '## What changed\n\nThe Workshop Manual refresh.\n\n### Before you play\n\n* Sign in again.\n\nCloses #1250, closes #1306\n\n## Also closes\n'
    )
    expect(notes.startsWith('The Workshop Manual refresh.')).toBe(true)
    expect(notes.endsWith('* Sign in again.')).toBe(true)
  })
})

describe('main', () => {
  test('publishes v<version> on the merge commit with the What changed notes', async () => {
    const { deps, calls, out } = harness({
      [`GET /repos/${REPO}/commits/${SHA}/pulls`]: merged(BODY),
      [`POST /repos/${REPO}/releases`]: { html_url: 'https://github.com/r/v3.0.0' },
    })
    expect(await main(['--sha', SHA], deps)).toBe(0)
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      `GET /repos/${REPO}/git/ref/tags/v3.0.0`,
      `GET /repos/${REPO}/commits/${SHA}/pulls`,
      `POST /repos/${REPO}/releases`,
    ])
    expect(calls[2]?.body).toEqual({
      tag_name: 'v3.0.0',
      target_commitish: SHA,
      name: 'v3.0.0',
      body: whatChanged(BODY),
      make_latest: 'true',
    })
    expect(out.join('\n')).toContain('published v3.0.0 from #1344')
  })

  test('does nothing when the tag already exists', async () => {
    const { deps, calls, out } = harness({
      [`GET /repos/${REPO}/git/ref/tags/v3.0.0`]: { ref: 'refs/tags/v3.0.0' },
    })
    expect(await main(['--sha', SHA], deps)).toBe(0)
    expect(calls).toHaveLength(1)
    expect(out.join('\n')).toContain('already exists')
  })

  test('does nothing with no version set', async () => {
    const { deps, calls } = harness({}, '0.0.0')
    expect(await main(['--sha', SHA], deps)).toBe(0)
    expect(calls).toHaveLength(0)
  })

  test('a dry run prints the notes and publishes nothing', async () => {
    const { deps, calls, out } = harness({
      [`GET /repos/${REPO}/commits/${SHA}/pulls`]: merged(BODY),
    })
    expect(await main(['--sha', SHA, '--dry-run'], deps)).toBe(0)
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
    expect(out.join('\n')).toContain('would publish v3.0.0')
  })

  test.each([
    ['no --sha', [], {}, '3.0.0', '--sha <commit> is required'],
    ['a non-semver version', ['--sha', SHA], {}, 'three', 'is not semver'],
    ['no merged PR', ['--sha', SHA], {}, '3.0.0', 'no merged PR'],
    [
      'a PR merged as another commit',
      ['--sha', SHA],
      { [`GET /repos/${REPO}/commits/${SHA}/pulls`]: merged(BODY, 'other') },
      '3.0.0',
      'no merged PR',
    ],
    [
      'a PR with no body',
      ['--sha', SHA],
      { [`GET /repos/${REPO}/commits/${SHA}/pulls`]: merged(null) },
      '3.0.0',
      'no "## What changed" section',
    ],
  ] as const)('fails on %s', async (_, argv, routes, version, message) => {
    const { deps, calls, err } = harness(routes, version)
    expect(await main([...argv], deps)).toBe(1)
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
    expect(err.join('\n')).toContain(message)
  })
})

describe('githubApi', () => {
  const fake = (status: number, payload: unknown, seen: Request[] = []) =>
    (async (url: string, init: RequestInit) => {
      seen.push(new Request(url, init))
      return new Response(JSON.stringify(payload), { status })
    }) as unknown as typeof fetch

  test('sends the token and body, and parses the reply', async () => {
    const seen: Request[] = []
    const api = githubApi('tkn', fake(201, { ok: 1 }, seen))
    expect(await api('POST', '/repos/x/releases', { a: 1 })).toEqual({ ok: 1 })
    expect(seen[0]?.url).toBe('https://api.github.com/repos/x/releases')
    expect(seen[0]?.headers.get('authorization')).toBe('Bearer tkn')
    expect(await seen[0]?.json()).toEqual({ a: 1 })
  })

  test('reads a 404 as null and throws on any other failure', async () => {
    expect(await githubApi('t', fake(404, {}))('GET', '/x')).toBeNull()
    await expect(githubApi('t', fake(403, { message: 'no' }))('GET', '/x')).rejects.toThrow(
      'GET /x: 403'
    )
  })
})

describe('liveDeps', () => {
  test('reads the root package.json version and the Actions environment', () => {
    const deps = liveDeps(ROOT, { GITHUB_REPOSITORY: 'o/r' })
    expect(deps.version()).toBe(
      JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version
    )
    expect(deps.repo).toBe('o/r')
    expect(liveDeps(ROOT, {}).repo).toBe(REPO)
  })
})

describe('release.yml', () => {
  const workflow = Bun.YAML.parse(
    readFileSync(join(ROOT, '.github', 'workflows', 'release.yml'), 'utf-8')
  ) as {
    on: { push: { branches: string[]; paths: string[] } }
    permissions: Record<string, string>
    jobs: Record<string, { permissions?: Record<string, string>; steps: { run?: string }[] }>
  }

  test('runs the script when a push to main or design-refresh changes the root package.json, holding only contents: write', () => {
    expect(workflow.on.push.branches).toEqual(['main', 'design-refresh'])
    expect(workflow.on.push.paths).toEqual(['package.json'])
    expect(workflow.permissions).toEqual({})
    const jobs = Object.values(workflow.jobs)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.permissions).toEqual({ contents: 'write' })
    const run = jobs[0]?.steps.find((s) => s.run?.includes('bun tools/release.ts'))?.run ?? ''
    // Only main publishes; any other branch dry-runs.
    expect(run).toContain(
      'if [ "$REF" = refs/heads/main ]; then\n  bun tools/release.ts --sha "$SHA"\nelse'
    )
    expect(run).toContain('bun tools/release.ts --sha "$SHA" --dry-run')
  })
})
