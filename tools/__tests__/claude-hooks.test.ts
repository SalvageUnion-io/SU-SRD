import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { GENERATED_PATHS } from '../check-generated'

/**
 * The agent guards in `.claude/`: the typecheck hooks, the `session-status.sh`
 * SessionStart report, the `guard-generated.sh` PreToolUse hook that keeps
 * agents off generated files, and the `deny` rules in `.claude/settings.json`
 * that keep them off other package managers.
 *
 * Generated files are guarded by a hook, not `Edit(...)` deny rules: Claude
 * Code applies Edit deny rules to the Bash sandbox too, which blocked the
 * generators themselves. What can drift is the hook's list: a new generated
 * path it does not cover is silently editable. These tests drive the hook
 * with each representative path.
 */

const ROOT = join(import.meta.dir, '..', '..')
const HOOKS = join(ROOT, '.claude', 'hooks')

async function runHook(script: string, payload: unknown): Promise<number> {
  const proc = Bun.spawn([join(HOOKS, script)], {
    cwd: ROOT,
    stdin: new TextEncoder().encode(JSON.stringify(payload)),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return await proc.exited
}

/** A hook blocks on exit 2; 0 allows. */
const ALLOW = 0

const settings: { permissions: { allow: string[]; ask: string[]; deny: string[] } } =
  await Bun.file(join(ROOT, '.claude', 'settings.json')).json()
const { allow, ask, deny } = settings.permissions

/** A hook blocks with exit 2. */
const BLOCK = 2

/** Whether `guard-generated.sh` blocks an edit to `path`. */
const editDenied = async (path: string) =>
  (await runHook('guard-generated.sh', { tool_input: { file_path: path } })) === BLOCK

describe('guard-generated.sh', () => {
  test.each([
    ['a generated JSON schema', 'packages/salvageunion-reference/schemas/chassis.schema.json'],
    ['the same, absolute', `${ROOT}/packages/salvageunion-reference/schemas/abilities.schema.json`],
    ['generated lib code', 'packages/salvageunion-reference/lib/generated/registry.generated.ts'],
    ['the router tree', 'apps/web/src/routeTree.gen.ts'],
    ['anything under dist', 'apps/web/dist/index.html'],
    ['Convex codegen', 'apps/web/convex/_generated/api.d.ts'],
    ['the lockfile', 'bun.lock'],
    ['the schema catalog', 'packages/salvageunion-reference/schemas/index.json'],
    ['a build-info file', 'apps/web/tsconfig.tsbuildinfo'],
  ])('blocks editing %s', async (_label, path) => {
    expect(await editDenied(path)).toBe(true)
  })

  test.each([
    [
      'a Zod schema — the file you SHOULD edit',
      'packages/salvageunion-reference/lib/schemas/chassis.ts',
    ],
    ['an app component', 'apps/web/src/components/Foo.tsx'],
    ['a tool', 'tools/check-path-filters.ts'],
    ['a doc', 'docs/README.md'],
  ])('allows editing %s', async (_label, path) => {
    expect(await editDenied(path)).toBe(false)
  })

  test('blocks a notebook edit by its notebook_path', async () => {
    const code = await runHook('guard-generated.sh', {
      tool_input: { notebook_path: 'apps/web/dist/report.ipynb' },
    })
    expect(code).toBe(BLOCK)
  })

  test('an empty payload is allowed rather than erroring', async () => {
    expect(await runHook('guard-generated.sh', { tool_input: {} })).toBe(ALLOW)
  })

  test('is registered before every editing tool runs', () => {
    const hooks = (
      settings as unknown as {
        hooks: { PreToolUse: { matcher: string; hooks: { command: string }[] }[] }
      }
    ).hooks.PreToolUse
    const entry = hooks.find((e) => e.hooks.some((h) => h.command.endsWith('/guard-generated.sh')))
    expect(entry?.matcher.split('|').sort()).toEqual(['Edit', 'MultiEdit', 'NotebookEdit', 'Write'])
  })

  // An `Edit(...)` deny rule also becomes a Bash sandbox write deny, so the
  // generators that write these paths would fail with EPERM again.
  test('no Edit deny rule shadows the hook in the sandbox', () => {
    expect(deny.filter((rule) => rule.startsWith('Edit('))).toEqual([])
  })

  // Parity with `bun run check generated`. The Record is typed over the
  // GENERATED_PATHS union, so a new entry there fails typecheck until it is
  // mapped here — and then this test fails until the hook covers it.
  const REPRESENTATIVE: Record<
    (typeof GENERATED_PATHS)[number],
    { file: string; denied: boolean }
  > = {
    // Only its GENERATED:BEGIN/END span is generated; the rest is hand-written.
    'packages/salvageunion-reference/lib/index.ts': {
      file: 'packages/salvageunion-reference/lib/index.ts',
      denied: false,
    },
    'apps/web/src/routeTree.gen.ts': {
      file: 'apps/web/src/routeTree.gen.ts',
      denied: true,
    },
    'apps/web/worker-configuration.d.ts': {
      file: 'apps/web/worker-configuration.d.ts',
      denied: true,
    },
    'apps/discord-bot/worker-configuration.d.ts': {
      file: 'apps/discord-bot/worker-configuration.d.ts',
      denied: true,
    },
  }

  test.each([...GENERATED_PATHS])('mirrors GENERATED_PATHS entry %s', async (path) => {
    expect(await editDenied(REPRESENTATIVE[path].file)).toBe(REPRESENTATIVE[path].denied)
  })
})

describe('settings.json deny rules', () => {
  test.each(['npm', 'yarn', 'pnpm'])('denies %s, directly and behind bunx', (pm) => {
    expect(deny).toContain(`Bash(${pm} *)`)
    expect(deny).toContain(`Bash(bunx ${pm}*)`)
  })

  // `Bash(gh *)` and the git allow rules would otherwise run these unprompted;
  // CLAUDE.md's Merging section forbids a hand rebase or a force push.
  test.each([
    'Bash(gh pr merge*)',
    'Bash(gh pr close*)',
    'Bash(gh release create*)',
    'Bash(git rebase*)',
    'Bash(git push --force-with-lease*)',
    'Bash(git push * --force-with-lease*)',
  ])('asks before %s', (rule) => {
    expect(ask).toContain(rule)
  })

  test.each(['rebase', 'push --force-with-lease'])('never allows git %s outright', (cmd) => {
    expect(allow.filter((rule) => rule.startsWith(`Bash(git ${cmd}`))).toEqual([])
  })

  test.each(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'])(
    'gitignores a foreign lockfile: %s',
    async (lockfile) => {
      const proc = Bun.spawn(['git', 'check-ignore', '-q', '--no-index', lockfile], { cwd: ROOT })
      expect(await proc.exited).toBe(0)
    }
  )
})

describe('.claude/rules path globs', () => {
  // A rule loads only when an edited file matches one of its `paths:` globs, so a
  // glob that matches nothing tracked (a moved directory, a gitignored output)
  // is a rule that silently never loads there.
  const tracked = Bun.spawnSync(['git', 'ls-files'], { cwd: ROOT })
    .stdout.toString()
    .split('\n')
    .filter(Boolean)
  const rulesDir = join(ROOT, '.claude', 'rules')
  const globs = readdirSync(rulesDir)
    .filter((name) => name.endsWith('.md'))
    .flatMap((name) => {
      const front = /^---\n([\s\S]*?)\n---/.exec(readFileSync(join(rulesDir, name), 'utf-8'))
      return [...(front?.[1] ?? '').matchAll(/^\s*-\s*'?([^'\n]+?)'?\s*$/gm)].map(
        (m): [string, string] => [name, m[1] as string]
      )
    })

  test('every rule declares at least one glob', () => {
    expect(globs.length).toBeGreaterThan(0)
    const withGlobs = new Set(globs.map(([rule]) => rule))
    const rules = readdirSync(rulesDir).filter((name) => name.endsWith('.md'))
    expect(rules.filter((rule) => !withGlobs.has(rule))).toEqual([])
  })

  test.each(globs)('%s: %s matches a tracked file', (_rule, glob) => {
    const matcher = new Bun.Glob(glob)
    expect(tracked.some((path) => matcher.match(path))).toBe(true)
  })

  test('game-domain edits load the data-access and bot rules', () => {
    const loading = (path: string) =>
      globs.filter(([, glob]) => new Bun.Glob(glob).match(path)).map(([rule]) => rule)
    expect(loading('packages/game-domain/src/schemas/pilot.ts')).toContain('app-data-access.md')
    expect(loading('packages/game-domain/src/botWire.ts')).toEqual(
      expect.arrayContaining(['app-data-access.md', 'discord-bot.md'])
    )
  })
})

describe('typecheck.sh', () => {
  const typecheck = (file_path: string) => runHook('typecheck.sh', { tool_input: { file_path } })

  test.each([
    ['markdown', 'docs/README.md'],
    ['json', 'package.json'],
    ['css', 'apps/web/src/styles/global.css'],
    ['a root-level ts config file', 'knip.config.ts'],
  ])('is a silent no-op for %s', async (_label, file) => {
    expect(await typecheck(file)).toBe(ALLOW)
  })

  test('an empty payload is allowed rather than erroring', async () => {
    expect(await runHook('typecheck.sh', { tool_input: {} })).toBe(ALLOW)
  })

  test('the script the hook runs exists in the real root manifest', async () => {
    const manifest = await Bun.file(join(ROOT, 'package.json')).json()
    expect(manifest.scripts.typecheck).toBeString()
  })

  // A workspace is checked by its own tsconfig.json, which the root script
  // must name, or by the root project's `include`.
  test('the root typecheck reaches every workspace', async () => {
    const manifest = await Bun.file(join(ROOT, 'package.json')).json()
    const projects = new Set((manifest.scripts.typecheck as string).split('tsc -b ')[1]?.split(' '))
    // Comment-stripped: tsconfig.json is JSONC.
    const root = (await Bun.file(join(ROOT, 'tsconfig.json')).text())
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\/\*.*?\*\//g, '')
    const { include } = JSON.parse(root) as { include: string[] }
    expect(projects).toContain('.')
    let seen = 0
    for (const dir of ['apps/*', 'packages/*', 'tools']) {
      for await (const path of new Bun.Glob(`${dir}/package.json`).scan(ROOT)) {
        const project = path.replace('/package.json', '')
        const own = await Bun.file(join(ROOT, project, 'tsconfig.json')).exists()
        if (own) expect(projects).toContain(project)
        else expect(include.some((i) => project === i || project.startsWith(`${i}/`))).toBe(true)
        seen++
      }
    }
    expect(seen).toBeGreaterThan(4)
  })
})

// A throwaway git repo that mirrors the workspace layout, with the root
// `typecheck` stubbed to log the projects it was handed (Bun appends a script's
// arguments to its last command), so the filtering, the exit codes and the root
// resolution are tested without running tsc.
describe('typecheck hooks against a stub workspace', () => {
  // Git hooks (lefthook's pre-push runs this suite) export GIT_DIR and friends,
  // which would point `git init` and the hooks' `rev-parse` at the outer repo.
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  )

  const WORKSPACES = [
    'apps/discord-bot',
    'apps/web',
    'packages/gates',
    'packages/game-domain',
    'packages/salvageunion-reference',
    'tools',
  ].map((path) => [path, path.split('/').at(-1)] as const)

  /**
   * `root` replaces the root script, which otherwise logs `ROOT` and its
   * arguments. `install` leaves out `node_modules` (a fresh worktree) and puts
   * a `bun` first on PATH whose `install` logs `INSTALL` and its arguments,
   * then runs the given body; anything else goes to the real Bun.
   */
  async function fixture(opts: { root?: string; install?: string } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'typecheck-hook-'))
    const log = join(dir, 'ran.log')
    const bin = join(dir, 'bin')
    if (opts.install === undefined) mkdirSync(join(dir, 'node_modules'))
    else {
      mkdirSync(bin)
      writeFileSync(
        join(bin, 'bun'),
        `#!/bin/bash\nif [ "$1" = install ]; then echo "INSTALL $*" >> ${log}; ${opts.install}; fi\nexec ${process.execPath} "$@"\n`,
        { mode: 0o755 }
      )
    }
    for (const [path, name] of WORKSPACES) {
      mkdirSync(join(dir, path, 'lib'), { recursive: true })
      writeFileSync(join(dir, path, 'package.json'), JSON.stringify({ name }))
      writeFileSync(join(dir, path, 'lib', 'x.ts'), 'export {}\n')
    }
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'root',
        private: true,
        workspaces: ['apps/*', 'packages/*', 'tools'],
        scripts: { typecheck: opts.root ?? `echo ROOT >> ${log}` },
      })
    )
    await Bun.spawn(['git', 'init', '-q', dir], { env: cleanEnv }).exited
    /** What ran, in the order it ran. */
    const ranInOrder = async () =>
      (await Bun.file(log).exists()) ? (await Bun.file(log).text()).trim().split('\n') : []
    const ran = async () => (await ranInOrder()).sort()
    return {
      dir,
      ran,
      ranInOrder,
      cleanup: () => rmSync(dir, { recursive: true, force: true }),
    }
  }

  /** Runs a hook from `cwd` inside the fixture `dir`, its `bin/` (if any) first on PATH. */
  async function run(script: string, dir: string, cwd: string, payload: unknown) {
    const proc = Bun.spawn([join(HOOKS, script)], {
      cwd,
      env: { ...cleanEnv, PATH: `${join(dir, 'bin')}:${cleanEnv.PATH}` },
      stdin: new TextEncoder().encode(JSON.stringify(payload)),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    return {
      code,
      stdout: await new Response(proc.stdout).text(),
      stderr: await new Response(proc.stderr).text(),
    }
  }

  const edit = (dir: string, rel: string) =>
    run('typecheck.sh', dir, join(dir, 'apps', 'web'), {
      tool_input: { file_path: join(dir, rel) },
    })

  test.each([
    'apps/web/lib/x.ts',
    'apps/discord-bot/lib/x.ts',
    'packages/game-domain/lib/x.ts',
    'tools/lib/x.ts',
  ])('an edit to %s runs the whole-repo typecheck once, silently', async (rel) => {
    const f = await fixture()
    try {
      expect(await edit(f.dir, rel)).toEqual({ code: ALLOW, stdout: '', stderr: '' })
      expect(await f.ran()).toEqual(['ROOT'])
    } finally {
      f.cleanup()
    }
  })

  test('a failing typecheck exits 2 with the output on stderr, from any cwd', async () => {
    const f = await fixture({ root: 'echo boom-from-root >&2; exit 1' })
    try {
      const result = await edit(f.dir, 'packages/gates/lib/x.ts')
      expect(result.code).toBe(2)
      expect(result.stderr).toContain('boom-from-root')
      expect(result.stdout).toBe('')
    } finally {
      f.cleanup()
    }
  })

  test('a fresh worktree installs once with the frozen lockfile, then typechecks', async () => {
    const f = await fixture({ install: 'mkdir -p node_modules; exit 0' })
    try {
      expect(await edit(f.dir, 'apps/web/lib/x.ts')).toEqual({
        code: ALLOW,
        stdout: '',
        stderr: '',
      })
      expect((await edit(f.dir, 'apps/web/lib/x.ts')).code).toBe(ALLOW)
      expect(await f.ranInOrder()).toEqual(['INSTALL install --frozen-lockfile', 'ROOT', 'ROOT'])
    } finally {
      f.cleanup()
    }
  })

  test('a failed install exits 2 with its output and skips the typecheck', async () => {
    const f = await fixture({ install: 'echo lockfile-out-of-date >&2; exit 1' })
    try {
      const result = await edit(f.dir, 'apps/web/lib/x.ts')
      expect(result.code).toBe(2)
      expect(result.stderr).toContain('lockfile-out-of-date')
      expect(await f.ran()).toEqual(['INSTALL install --frozen-lockfile'])
    } finally {
      f.cleanup()
    }
  })
})

// A throwaway clone of a local "origin" (so the fetch needs no network) with a
// stub `gh` first on PATH, so the API answers, failures and hangs are scripted.
describe('session-status.sh (SessionStart)', () => {
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  )

  const STUBS = {
    ok: `case "$*" in
  *pulls*) printf '%s\n' '#42 feat: x (draft) → design-refresh https://example.test/pull/42' design-refresh ;;
  *e2e-nightly*) echo 'success 2026-10-11 https://example.test/runs/1' ;;
esac`,
    empty: 'exit 0',
    forbidden: 'echo "gh: HTTP 403: Forbidden" >&2; exit 1',
    hang: 'exec sleep 30',
  }

  async function fixture(gh: keyof typeof STUBS | null) {
    const dir = mkdtempSync(join(tmpdir(), 'session-status-'))
    const git = (...args: string[]) =>
      Bun.spawn(['git', ...args], { cwd: dir, env: cleanEnv, stdout: 'pipe', stderr: 'pipe' })
        .exited
    const origin = join(dir, 'SalvageUnion-io', 'SU-SRD.git')
    const work = join(dir, 'work')
    await git('init', '-q', '--bare', '-b', 'main', origin)
    await git('clone', '-q', origin, work)
    // No signing: a global commit.gpgsign would hand each commit to an agent.
    const inWork = (...args: string[]) =>
      Bun.spawn(
        ['git', '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args],
        {
          cwd: work,
          env: cleanEnv,
          stderr: 'pipe',
        }
      ).exited
    await inWork('commit', '-q', '--allow-empty', '-m', 'base')
    await inWork('push', '-q', 'origin', 'main')
    // A release branch one commit past main, and a branch cut from it.
    await inWork('checkout', '-q', '-b', 'design-refresh')
    await inWork('commit', '-q', '--allow-empty', '-m', 'release')
    await inWork('push', '-q', 'origin', 'design-refresh')
    await inWork('checkout', '-q', '-b', 'feature')
    await inWork('commit', '-q', '--allow-empty', '-m', 'one')
    await inWork('commit', '-q', '--allow-empty', '-m', 'two')

    // Only the tools the hook calls, so a real gh elsewhere on PATH stays out.
    // A git hook puts git's exec-path first on PATH; that dir's `git`, symlinked
    // into bin/, looks for git-upload-pack beside the link and the fetch fails.
    // Resolve past it to the git a shell would run.
    const execPath = resolve(
      Bun.spawnSync(['git', '--exec-path'], { env: cleanEnv }).stdout.toString().trim()
    )
    const toolPath = (cleanEnv.PATH ?? '')
      .split(':')
      .filter((entry) => resolve(entry) !== execPath)
      .join(':')
    const bin = join(dir, 'bin')
    mkdirSync(bin)
    const tools = ['git', 'sed', 'mktemp', 'head', 'grep', 'rm', 'sleep', 'touch', 'cat', 'dirname']
    for (const tool of [...tools, 'bun']) {
      const real = Bun.which(tool, { PATH: toolPath })
      if (real) await Bun.spawn(['ln', '-s', real, join(bin, tool)]).exited
    }
    if (gh) writeFileSync(join(bin, 'gh'), `#!/bin/bash\n${STUBS[gh]}\n`, { mode: 0o755 })

    const run = async (extraEnv: Record<string, string> = {}) => {
      const started = performance.now()
      const proc = Bun.spawn([join(HOOKS, 'session-status.sh')], {
        cwd: work,
        env: { ...cleanEnv, PATH: bin, CLAUDE_PROJECT_DIR: work, ...extraEnv },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      return { code, stdout, stderr, ms: performance.now() - started }
    }
    return { work, run, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
  }

  test('prints the branch, ahead/behind, the open PR and the nightly result', async () => {
    const f = await fixture('ok')
    try {
      const { code, stdout, stderr } = await f.run()
      expect({ code, stderr }).toEqual({ code: ALLOW, stderr: '' })
      expect(stdout).toContain('[status] branch: feature\n')
      expect(stdout).toContain(
        "vs origin/design-refresh (the PR's base; just fetched): 2 ahead, 0 behind"
      )
      expect(stdout).toContain('open PR: #42 feat: x (draft) → design-refresh')
      expect(stdout).toContain('nightly E2E: success 2026-10-11')
    } finally {
      f.cleanup()
    }
  })

  test('empty answers read as "none", not as a failure', async () => {
    const f = await fixture('empty')
    try {
      const { stdout } = await f.run()
      expect(stdout).toContain('open PR: none for this branch')
      expect(stdout).toContain('nightly E2E: no runs yet')
    } finally {
      f.cleanup()
    }
  })

  test('with no PR or upstream, counts against main', async () => {
    const f = await fixture('empty')
    try {
      const { stdout } = await f.run()
      expect(stdout).toContain('vs origin/main (nearest of main; just fetched): 3 ahead, 0 behind')
    } finally {
      f.cleanup()
    }
  })

  test('$SU_BASE overrides the PR', async () => {
    const f = await fixture('ok')
    try {
      const { stdout } = await f.run({ SU_BASE: 'main' })
      expect(stdout).toContain('vs origin/main (from $SU_BASE; just fetched): 3 ahead, 0 behind')
    } finally {
      f.cleanup()
    }
  })

  test.each([
    ['a 403', 'forbidden'],
    ['no gh at all', null],
  ] as const)('%s prints one "unavailable" line each and exits 0', async (_label, gh) => {
    const f = await fixture(gh)
    try {
      const { code, stdout, stderr } = await f.run()
      expect({ code, stderr }).toEqual({ code: ALLOW, stderr: '' })
      expect(stdout).toMatch(/open PR: unavailable \(.+\)\n/)
      expect(stdout).toMatch(/nightly E2E: unavailable \(.+\)\n/)
      expect(stdout).not.toContain('403')
    } finally {
      f.cleanup()
    }
  })

  test('a hanging API is cut off at the deadline', async () => {
    const f = await fixture('hang')
    try {
      const { code, stdout, ms } = await f.run({ SU_STATUS_DEADLINE: '1' })
      expect(code).toBe(ALLOW)
      expect(stdout).toContain('open PR: unavailable (gh api failed or timed out)')
      expect(ms).toBeLessThan(5000)
    } finally {
      f.cleanup()
    }
  })

  test('an unreachable origin still reports from the last fetch', async () => {
    const f = await fixture('ok')
    try {
      await Bun.spawn(['git', 'remote', 'set-url', 'origin', join(f.work, 'gone', 'x.git')], {
        cwd: f.work,
        env: cleanEnv,
      }).exited
      const { code, stdout, stderr } = await f.run()
      expect({ code, stderr }).toEqual({ code: ALLOW, stderr: '' })
      expect(stdout).toContain(
        "(the PR's base; fetch failed; as of the last fetch): 2 ahead, 0 behind"
      )
    } finally {
      f.cleanup()
    }
  })

  test('is registered as a SessionStart hook with a short timeout', () => {
    const hooks = (
      settings as unknown as {
        hooks: { SessionStart: { hooks: { command: string; timeout: number }[] }[] }
      }
    ).hooks.SessionStart.flatMap((entry) => entry.hooks)
    const status = hooks.find((hook) => hook.command.endsWith('/session-status.sh'))
    expect(status?.timeout).toBeLessThanOrEqual(10)
  })
})
