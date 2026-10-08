import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  decideSurfaces,
  isVersionOnlyBump,
  planDeploy,
  READ_BY,
  SURFACES,
} from '../deploy-surfaces'

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
    expect(decideSurfaces(['docs/ARCHITECTURE.md', 'CLAUDE.md'], false)).toEqual(NOTHING)
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
    'packages/salvageunion-reference/package.json',
    'package.json',
    'bun.lock',
    'bunfig.toml',
    'tsconfig.base.json',
    '.github/workflows/deploy-cloudflare.yml',
    '.github/actions/setup-bun/action.yml',
    // rendered into srd's about page and ITUN's bundle — the #731 shape
    'SPECIAL_THANKS.md',
    'ABOUT_JRVS.md',
    'LLM_STATEMENT.md',
  ])('a shared path (%s) deploys everything', (path) => {
    expect(decideSurfaces([path], false)).toEqual(EVERYTHING)
  })

  test.each([
    'test/happydom.ts',
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/dependabot.yml',
    '.release-please-manifest.json',
  ])('a path that ships in no artifact (%s) deploys nothing', (path) => {
    expect(decideSurfaces([path], false)).toEqual(NOTHING)
  })

  test('the reference CHANGELOG deploys only the surfaces that render it', () => {
    expect(decideSurfaces(['packages/salvageunion-reference/CHANGELOG.md'], false)).toEqual({
      ...NOTHING,
      srd: true,
      itun: true,
    })
  })

  test('a CHANGELOG nothing is known to read is still shared', () => {
    expect(decideSurfaces(['packages/component-lib/CHANGELOG.md'], false)).toEqual(EVERYTHING)
  })

  test('a directory that merely shares a prefix does not match', () => {
    // `apps/srd-legacy/` must not be read as `apps/srd/`.
    expect(decideSurfaces(['apps/srd-legacy/x.ts', 'apps/itun-docs/y.md'], false)).toEqual(NOTHING)
  })

  test('a root file that only starts like a shared one is not shared', () => {
    expect(decideSurfaces(['package.json.bak', 'bun.lockb.md'], false)).toEqual(NOTHING)
  })
})

describe('deploy-surfaces — isVersionOnlyBump', () => {
  const manifest = (version: string, extra: object = {}) =>
    JSON.stringify({ name: 'ref', version, dependencies: { a: '^1.0.0' }, ...extra }, null, 2)

  test('a release bump changes nothing but the version', () => {
    expect(isVersionOnlyBump(manifest('2.13.1'), manifest('2.13.2'))).toBe(true)
  })

  test('a bump that also moves a dependency, a script or an export is not', () => {
    expect(isVersionOnlyBump(manifest('1.0.0'), manifest('1.0.1', { scripts: { b: 'x' } }))).toBe(
      false
    )
    expect(
      isVersionOnlyBump(manifest('1.0.0'), manifest('1.0.1', { dependencies: { a: '^2.0.0' } }))
    ).toBe(false)
  })

  test('an unparseable side or an unchanged manifest is not a bump', () => {
    expect(isVersionOnlyBump('{', manifest('1.0.0'))).toBe(false)
    expect(isVersionOnlyBump(manifest('1.0.0'), manifest('1.0.0'))).toBe(false)
  })
})

describe('deploy-surfaces — planDeploy', () => {
  /**
   * The out-of-order case. A (itun) and B (su-assets) land on main in that
   * order. B deploys and records first; A's deploy is then re-run. Diffing
   * B->A would ship su-assets at A, reverting B in production.
   */
  test('a push run for a commit older than the record deploys nothing', () => {
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

  // Git hooks (lefthook's pre-push runs this suite) export GIT_DIR and
  // friends. Inherited, they point every command below at the REAL repo:
  // `git init --bare` then re-initialises it as bare. Strip them.
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  )
  const run = (cwd: string, args: string[]) => {
    const proc = Bun.spawnSync(args, { cwd, stdout: 'pipe', stderr: 'pipe', env: cleanEnv })
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
      env: { ...cleanEnv, GITHUB_OUTPUT: out },
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

  /** A release commit: the reference package's version, CHANGELOG and manifest-of-manifests. */
  test('a release bump ships only the surfaces that render the CHANGELOG', () => {
    const manifest = 'packages/salvageunion-reference/package.json'
    const write = (path: string, text: string) => {
      mkdirSync(join(work, dirname(path)), { recursive: true })
      writeFileSync(join(work, path), text)
    }
    git(work, 'checkout', '--quiet', '--detach', b)
    write(manifest, '{\n  "name": "ref",\n  "version": "1.0.0"\n}\n')
    git(work, 'add', '-A')
    git(work, 'commit', '--quiet', '-m', 'add ref')
    const base = git(work, 'rev-parse', 'HEAD')
    git(work, 'push', '--quiet', '--force', 'origin', `${base}:refs/tags/deployed/cloudflare`)

    write(manifest, '{\n  "name": "ref",\n  "version": "1.0.1"\n}\n')
    write('packages/salvageunion-reference/CHANGELOG.md', '## 1.0.1\n')
    write('.release-please-manifest.json', '{}\n')
    git(work, 'add', '-A')
    git(work, 'commit', '--quiet', '-m', 'chore: release main')
    const release = git(work, 'rev-parse', 'HEAD')
    expect(decide(release)).toEqual({
      stale: 'false',
      assets: 'false',
      srd: 'true',
      itun: 'true',
      bot: 'false',
    })

    write(manifest, '{\n  "name": "ref",\n  "version": "1.0.2",\n  "main": "x.ts"\n}\n')
    git(work, 'add', '-A')
    git(work, 'commit', '--quiet', '-m', 'bump and change')
    expect(decide(git(work, 'rev-parse', 'HEAD'))).toMatchObject({ assets: 'true', bot: 'true' })
  })
})

/**
 * A version-only `packages/*` manifest bump ships nothing, and the reference
 * CHANGELOG ships only READ_BY's surfaces. Both hold only while no other
 * shipped source reads those files; a new reader fails here.
 */
describe('deploy-surfaces — the narrowed paths have no unlisted reader', () => {
  const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

  test('every manifest or CHANGELOG an app reads is its own or listed in READ_BY', () => {
    const listed = Bun.spawnSync(['git', 'ls-files', 'apps', 'packages'], { cwd: REPO })
    const sources = listed.stdout
      .toString()
      .split('\n')
      .filter((f) => /\.(ts|tsx|js|mjs)$/.test(f))
      .filter((f) => !/(__tests__|\/e2e\/|\/tools\/|\.test\.|\.stories\.)/.test(f))
    const unlisted: string[] = []
    let reads = 0
    for (const file of sources) {
      const text = readFileSync(join(REPO, file), 'utf8')
      for (const [, spec = ''] of text.matchAll(
        /['"]([^'"\s]*(?:CHANGELOG\.md|package\.json))(?:\?raw)?['"]/g
      )) {
        reads++
        const target = spec.startsWith('.') ? join(dirname(file), spec) : spec
        const app = file.match(/^apps\/([^/]+)\//)?.[1]
        const surface = Object.entries(SURFACES).find(([, dir]) => dir === app)?.[0]
        if (app && target.startsWith(`apps/${app}/`)) continue
        if (surface && READ_BY[target]?.some((s) => s === surface)) continue
        unlisted.push(`${file} reads ${target}`)
      }
    }
    expect(sources.length).toBeGreaterThan(500)
    expect(reads).toBeGreaterThan(0)
    expect(unlisted).toEqual([])
  })
})
