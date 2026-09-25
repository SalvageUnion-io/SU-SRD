import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decideSurfaces, planDeploy, SURFACES } from '../deploy-surfaces'

const EVERYTHING = { assets: true, srd: true, itun: true, bot: true }
const NOTHING = { assets: false, srd: false, itun: false, bot: false }

describe('deploy-surfaces — decideSurfaces', () => {
  test('no deploy record deploys every surface', () => {
    expect(decideSurfaces(null, false)).toEqual(EVERYTHING)
  })

  test('force_all deploys every surface even with nothing changed', () => {
    expect(decideSurfaces([], true)).toEqual(EVERYTHING)
  })

  test('nothing changed since the record deploys nothing', () => {
    expect(decideSurfaces([], false)).toEqual(NOTHING)
  })

  test('docs-only changes deploy nothing', () => {
    expect(decideSurfaces(['docs/architecture/ci.md', 'CLAUDE.md'], false)).toEqual(NOTHING)
  })

  /**
   * The CI-01 case. Commit A touched itun, commit B touched srd, and A's
   * deploy never ran. Diffing HEAD^..HEAD at B saw only srd; diffing from the
   * recorded deploy sees both.
   */
  test('changes from several commits since the record are all deployed', () => {
    const since = ['apps/itun/src/app.tsx', 'apps/srd/src/pages/index.page.tsx']
    expect(decideSurfaces(since, false)).toEqual({ ...NOTHING, itun: true, srd: true })
  })

  test.each(Object.entries(SURFACES))(
    'a change under apps/%s selects only that surface',
    (key, dir) => {
      const decision = decideSurfaces([`apps/${dir}/x.ts`], false)
      expect(decision).toEqual({ ...NOTHING, [key]: true })
    }
  )

  test.each([
    'packages/component-lib/src/index.ts',
    'packages/observability/src/cloudflare.ts',
    'test/happydom.ts',
    'package.json',
    'bun.lock',
    'bunfig.toml',
    'tsconfig.base.json',
    'patches/x.patch',
    '.bun-version',
    '.github/workflows/deploy-cloudflare.yml',
    // rendered into srd's about page and ITUN's bundle — the #731 shape
    'SPECIAL_THANKS.md',
    'ABOUT_JRVS.md',
    'LLM_STATEMENT.md',
  ])('a shared path (%s) deploys everything', (path) => {
    expect(decideSurfaces([path], false)).toEqual(EVERYTHING)
  })

  test('a directory that merely shares a prefix does not match', () => {
    // `apps/srd-legacy/` must not be read as `apps/srd/`.
    expect(decideSurfaces(['apps/srd-legacy/x.ts', 'apps/itun-docs/y.md'], false)).toEqual(NOTHING)
  })

  test('a root file that only starts like a shared one is not shared', () => {
    expect(decideSurfaces(['package.json.bak', 'bun.lockb.md'], false)).toEqual(NOTHING)
  })
})

describe('deploy-surfaces — planDeploy', () => {
  /**
   * The out-of-order case. A (itun, slow CI) and B (su-assets, fast CI) land
   * on main in that order. B deploys and records first; A's CI then goes
   * green. Diffing B->A would ship su-assets at A, reverting B in production.
   */
  test('a workflow_run for a commit older than the record deploys nothing', () => {
    const plan = planDeploy(['apps/su-assets/src/index.ts'], false, 'behind', false)
    expect(plan).toEqual({ stale: true, surfaces: NOTHING })
  })

  test('a stale run stays stale even when the diff touches a shared path', () => {
    expect(planDeploy(['bun.lock'], false, 'behind', false).stale).toBe(true)
  })

  test('a rollback dispatch may deploy an older commit', () => {
    const plan = planDeploy(['apps/su-assets/src/index.ts'], false, 'behind', true)
    expect(plan).toEqual({ stale: false, surfaces: { ...NOTHING, assets: true } })
  })

  test.each(['ahead', 'same', 'none', 'diverged'] as const)(
    'ancestry %s is never stale',
    (ancestry) => {
      expect(planDeploy(null, false, ancestry, false).stale).toBe(false)
    }
  )

  test('ahead of the record deploys what changed', () => {
    const plan = planDeploy(['apps/itun/src/app.tsx'], false, 'ahead', false)
    expect(plan).toEqual({ stale: false, surfaces: { ...NOTHING, itun: true } })
  })
})

/**
 * The script end to end against a real repository, so the ancestry wiring —
 * not just the pure decision — is covered. `origin` is a local bare repo
 * carrying the `deployed/cloudflare` tag, which is what the script fetches.
 */
describe('deploy-surfaces — script against a real git history', () => {
  const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'deploy-surfaces.ts')
  const root = mkdtempSync(join(tmpdir(), 'deploy-surfaces-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  const run = (cwd: string, args: string[]) => {
    const proc = Bun.spawnSync(args, { cwd, stdout: 'pipe', stderr: 'pipe' })
    if (proc.exitCode !== 0) throw new Error(`${args.join(' ')}: ${proc.stderr.toString()}`)
    return proc.stdout.toString().trim()
  }
  const git = (cwd: string, ...args: string[]) =>
    run(cwd, [
      'git',
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'tag.gpgsign=false',
      ...args,
    ])

  const origin = join(root, 'origin.git')
  const work = join(root, 'work')
  git(root, 'init', '--quiet', '--bare', origin)
  git(root, 'init', '--quiet', work)
  git(work, 'remote', 'add', 'origin', origin)
  const commit = (path: string) => {
    mkdirSync(join(work, dirname(path)), { recursive: true })
    writeFileSync(join(work, path), `${Math.random()}\n`)
    git(work, 'add', '-A')
    git(work, 'commit', '--quiet', '-m', path)
    return git(work, 'rev-parse', 'HEAD')
  }
  commit('README.md')
  const a = commit('apps/itun/app.ts')
  const b = commit('apps/su-assets/index.ts')
  git(
    work,
    'push',
    '--quiet',
    'origin',
    'HEAD:refs/heads/main',
    `${b}:refs/tags/deployed/cloudflare`
  )

  const decide = (sha: string, ...flags: string[]) => {
    git(work, 'checkout', '--quiet', '--detach', sha)
    const out = join(root, `out-${sha}-${flags.join('')}`)
    writeFileSync(out, '')
    const proc = Bun.spawnSync(['bun', SCRIPT, ...flags], {
      cwd: work,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, GITHUB_OUTPUT: out },
    })
    expect(proc.exitCode).toBe(0)
    return Object.fromEntries(
      readFileSync(out, 'utf8')
        .trim()
        .split('\n')
        .map((line) => line.split('='))
    )
  }

  test('an older commit finishing CI after the recorded deploy is stale', () => {
    expect(decide(a)).toEqual({
      stale: 'true',
      assets: 'false',
      srd: 'false',
      itun: 'false',
      bot: 'false',
    })
  })

  test('the same older commit may be deployed by a rollback dispatch', () => {
    // B->A differs only in su-assets, so a rollback to A ships su-assets alone.
    expect(decide(a, '--allow-backwards')).toMatchObject({
      stale: 'false',
      assets: 'true',
      itun: 'false',
    })
  })

  test('the recorded commit itself is not stale and deploys nothing', () => {
    expect(decide(b)).toMatchObject({ stale: 'false', assets: 'false', itun: 'false' })
  })

  test('a newer commit deploys what changed since the record', () => {
    git(work, 'checkout', '--quiet', '--detach', b)
    const c = commit('apps/srd/page.tsx')
    expect(decide(c)).toMatchObject({ stale: 'false', srd: 'true', assets: 'false' })
  })
})
