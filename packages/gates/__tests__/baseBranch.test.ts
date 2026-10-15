import { describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  cliLine,
  describeBase,
  parseCliArgs,
  pickBase,
  repoSlug,
  resolveBaseBranch,
} from '../lib/baseBranch'

/** Commits ahead of main, and of a branch that is no candidate. */
const near = (main: number, release: number) =>
  new Map([
    ['main', main],
    ['release', release],
  ])

describe('pickBase', () => {
  test('$SU_BASE wins over everything, with or without origin/', () => {
    const inputs = { prBase: 'main', upstream: 'origin/x', current: 'y', distances: near(0, 9) }
    expect(pickBase({ ...inputs, suBase: 'origin/release' })).toEqual({
      branch: 'release',
      ref: 'origin/release',
      source: 'SU_BASE',
    })
    expect(pickBase({ ...inputs, suBase: 'main' })?.ref).toBe('origin/main')
  })

  test("the PR's base comes next", () => {
    expect(pickBase({ prBase: 'release', upstream: 'origin/x', distances: near(0, 9) })).toEqual({
      branch: 'release',
      ref: 'origin/release',
      source: 'pr',
    })
  })

  test('then an upstream on origin that is another branch', () => {
    expect(
      pickBase({ upstream: 'origin/release', current: 'refit2/g2', distances: near(1, 9) })
    ).toMatchObject({ branch: 'release', source: 'upstream' })
  })

  test('an upstream of the same name, or off origin, says nothing about the base', () => {
    for (const upstream of ['origin/feature', 'fork/main']) {
      expect(pickBase({ upstream, current: 'feature', distances: near(5, 2) })).toMatchObject({
        branch: 'main',
        source: 'nearest',
      })
    }
  })

  test('else main, the one candidate, however near another branch is', () => {
    expect(pickBase({ distances: near(145, 3) })?.branch).toBe('main')
    expect(pickBase({ distances: near(2, 7) })?.branch).toBe('main')
    expect(pickBase({ distances: new Map([['release', 4]]) })).toBeNull()
  })

  test('nothing to go on is null, not main', () => {
    expect(pickBase({ prBase: ' ', distances: new Map() })).toBeNull()
  })

  test('describeBase names the source', () => {
    expect(describeBase({ branch: 'main', ref: 'origin/main', source: 'nearest' })).toBe(
      'nearest of main'
    )
  })
})

describe('repoSlug', () => {
  test.each([
    'https://github.com/SalvageUnion-io/SU-SRD.git',
    'git@github.com:SalvageUnion-io/SU-SRD.git',
    'http://local_proxy@127.0.0.1:1234/git/SalvageUnion-io/SU-SRD',
  ])('%s', (url) => {
    expect(repoSlug(url)).toBe('SalvageUnion-io/SU-SRD')
  })
})

describe('parseCliArgs', () => {
  test('--no-pr skips the lookup, --pr-base= supplies it, neither asks gh', () => {
    expect(parseCliArgs([])).toBeUndefined()
    expect(parseCliArgs(['--no-pr'])).toBeNull()
    expect(parseCliArgs(['--no-pr', '--pr-base=main'])).toBeNull()
    expect(parseCliArgs(['--pr-base=release'])).toBe('release')
    expect(parseCliArgs(['--pr-base='])).toBeNull()
  })
})

// A throwaway clone of a local origin with main and a release branch two
// commits past it. The PR lookup runs only against a stub `gh` on PATH.
describe('resolveBaseBranch', () => {
  // No GIT_* (a git hook's GIT_DIR would point every command at this repo) and
  // no SU_BASE, which would short-circuit every case.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_') && key !== 'SU_BASE')
  )

  async function fixture() {
    const dir = mkdtempSync(join(tmpdir(), 'base-branch-'))
    const origin = join(dir, 'origin.git')
    const work = join(dir, 'work')
    // No signing: a global commit.gpgsign would hand each commit to an agent.
    const config = ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false']
    const git = async (cwd: string, ...args: string[]) => {
      const proc = Bun.spawn(['git', ...config, ...args], {
        cwd,
        env,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      await proc.exited
    }
    await git(dir, 'init', '-q', '--bare', '-b', 'main', origin)
    await git(dir, 'clone', '-q', origin, work)
    await git(work, 'commit', '-q', '--allow-empty', '-m', 'base')
    await git(work, 'push', '-q', 'origin', 'main')
    await git(work, 'checkout', '-q', '-b', 'release')
    await git(work, 'commit', '-q', '--allow-empty', '-m', 'release')
    await git(work, 'commit', '-q', '--allow-empty', '-m', 'release 2')
    await git(work, 'push', '-q', 'origin', 'release')
    await git(work, 'checkout', '-q', '-b', 'feature')
    await git(work, 'commit', '-q', '--allow-empty', '-m', 'one')
    return { dir, work, git, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
  }

  // A `gh` that answers only the REST call for this branch's open PR, so the
  // PR lookup runs without the network; origin gets a GitHub-style URL.
  async function withGh(f: Awaited<ReturnType<typeof fixture>>, body: string) {
    await f.git(f.work, 'remote', 'set-url', 'origin', 'https://github.com/o/r.git')
    const bin = join(f.dir, 'bin')
    await Bun.spawn(['mkdir', '-p', bin]).exited
    const gh = join(bin, 'gh')
    writeFileSync(gh, `#!/bin/sh\n${body}\n`)
    chmodSync(gh, 0o755)
    return { ...env, PATH: `${bin}:${env.PATH ?? ''}` }
  }

  test('with no PR or upstream, a branch cut from another resolves to main', async () => {
    const f = await fixture()
    try {
      expect(await resolveBaseBranch({ cwd: f.work, env, prBase: null })).toEqual({
        branch: 'main',
        ref: 'origin/main',
        source: 'nearest',
      })
    } finally {
      f.cleanup()
    }
  })

  test('the upstream, then the PR, then $SU_BASE take precedence in turn', async () => {
    const f = await fixture()
    try {
      await f.git(f.work, 'branch', '-q', '--set-upstream-to=origin/main')
      expect(await resolveBaseBranch({ cwd: f.work, env, prBase: null })).toMatchObject({
        branch: 'main',
        source: 'upstream',
      })
      expect(await resolveBaseBranch({ cwd: f.work, env, prBase: 'release' })).toMatchObject({
        branch: 'release',
        source: 'pr',
      })
      expect(
        await resolveBaseBranch({ cwd: f.work, env: { ...env, SU_BASE: 'main' }, prBase: 'x' })
      ).toMatchObject({ branch: 'main', source: 'SU_BASE' })
    } finally {
      f.cleanup()
    }
  })

  test("left out, the PR's base is asked of gh api", async () => {
    const f = await fixture()
    try {
      const ghEnv = await withGh(
        f,
        '[ "$1 $2" = "api repos/o/r/pulls?state=open&head=o:feature" ] && echo main || exit 1'
      )
      expect(await resolveBaseBranch({ cwd: f.work, env: ghEnv })).toEqual({
        branch: 'main',
        ref: 'origin/main',
        source: 'pr',
      })
    } finally {
      f.cleanup()
    }
  })

  test('gh failing or outrunning the timeout falls through to git', async () => {
    const f = await fixture()
    try {
      for (const body of ['exit 1', 'exec sleep 5']) {
        const ghEnv = await withGh(f, body)
        expect(await resolveBaseBranch({ cwd: f.work, env: ghEnv, timeoutMs: 200 })).toMatchObject({
          branch: 'main',
          source: 'nearest',
        })
      }
    } finally {
      f.cleanup()
    }
  })

  test('the CLI line is the branch and where it came from', async () => {
    const f = await fixture()
    try {
      expect(await cliLine(['--no-pr'], { cwd: f.work, env })).toBe('main\tnearest of main')
      expect(await cliLine(['--pr-base=main'], { cwd: f.work, env })).toBe("main\tthe PR's base")
    } finally {
      f.cleanup()
    }
  })

  test('a cwd that does not exist is no base, not a throw', async () => {
    expect(
      await resolveBaseBranch({ cwd: join(tmpdir(), 'base-branch-missing-dir'), env, prBase: null })
    ).toBeNull()
  })

  test('outside a repository there is no base', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'base-branch-none-'))
    try {
      expect(await resolveBaseBranch({ cwd: dir, env, prBase: null })).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
