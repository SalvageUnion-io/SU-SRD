import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GENERATED_PATHS } from '../check-generated'

/**
 * The agent guards in `.claude/`: the `typecheck-scoped.sh` hook, and the
 * `deny` rules in `.claude/settings.json` that keep agents off generated files
 * and other package managers.
 *
 * The deny rules are native permission rules, enforced by Claude Code before a
 * tool runs, so there is no script to drive. What can drift is the list: a new
 * generated path that no `Edit(...)` rule covers is silently editable. These
 * tests match each representative path against the rules' globs.
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

const settings: { permissions: { deny: string[] } } = await Bun.file(
  join(ROOT, '.claude', 'settings.json')
).json()
const deny = settings.permissions.deny

/** The globs inside the `Edit(...)` deny rules. */
const editGlobs = deny.flatMap((rule) => /^Edit\((.+)\)$/.exec(rule)?.[1] ?? [])
const editDenied = (path: string) => editGlobs.some((glob) => new Bun.Glob(glob).match(path))

describe('settings.json deny rules', () => {
  test.each([
    ['a generated JSON schema', 'packages/salvageunion-reference/schemas/chassis.schema.json'],
    ['the same, absolute', `${ROOT}/packages/salvageunion-reference/schemas/abilities.schema.json`],
    ['generated lib code', 'packages/salvageunion-reference/lib/generated/registry.generated.ts'],
    ['the router tree', 'apps/itun/src/routeTree.gen.ts'],
    ['anything under dist', 'apps/srd/dist/index.html'],
    ['Convex codegen', 'apps/itun/convex/_generated/api.d.ts'],
    ['the lockfile', 'bun.lock'],
    ['the styling baseline', 'tools/styling-baseline.json'],
    ['the schema catalog', 'packages/salvageunion-reference/schemas/index.json'],
    ['a build-info file', 'apps/itun/tsconfig.tsbuildinfo'],
  ])('deny editing %s', (_label, path) => {
    expect(editDenied(path)).toBe(true)
  })

  test.each([
    [
      'a Zod schema — the file you SHOULD edit',
      'packages/salvageunion-reference/lib/schemas/chassis.ts',
    ],
    ['an app component', 'apps/itun/src/components/Foo.tsx'],
    ['a tool', 'tools/check-path-filters.ts'],
    ['a doc', 'docs/README.md'],
  ])('allow editing %s', (_label, path) => {
    expect(editDenied(path)).toBe(false)
  })

  // Parity with `bun run check generated`. The Record is typed over the
  // GENERATED_PATHS union, so a new entry there fails typecheck until it is
  // mapped here — and then this test fails until a deny rule covers it.
  const REPRESENTATIVE: Record<
    (typeof GENERATED_PATHS)[number],
    { file: string; denied: boolean }
  > = {
    'packages/salvageunion-reference/schemas': {
      file: 'packages/salvageunion-reference/schemas/index.json',
      denied: true,
    },
    'packages/salvageunion-reference/lib/generated': {
      file: 'packages/salvageunion-reference/lib/generated/schemaRegistry.generated.ts',
      denied: true,
    },
    // Only its GENERATED:BEGIN/END span is generated; the rest is hand-written.
    'packages/salvageunion-reference/lib/index.ts': {
      file: 'packages/salvageunion-reference/lib/index.ts',
      denied: false,
    },
    'apps/itun/src/routeTree.gen.ts': { file: 'apps/itun/src/routeTree.gen.ts', denied: true },
    'apps/su-assets/worker-configuration.d.ts': {
      file: 'apps/su-assets/worker-configuration.d.ts',
      denied: true,
    },
    'apps/discord-bot/worker-configuration.d.ts': {
      file: 'apps/discord-bot/worker-configuration.d.ts',
      denied: true,
    },
  }

  test.each([...GENERATED_PATHS])('mirrors GENERATED_PATHS entry %s', (path) => {
    expect(editDenied(REPRESENTATIVE[path].file)).toBe(REPRESENTATIVE[path].denied)
  })

  test.each(['npm', 'yarn', 'pnpm'])('denies %s, directly and behind bunx', (pm) => {
    expect(deny).toContain(`Bash(${pm} *)`)
    expect(deny).toContain(`Bash(bunx ${pm}*)`)
  })

  test.each(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'])(
    'gitignores a foreign lockfile: %s',
    async (lockfile) => {
      const proc = Bun.spawn(['git', 'check-ignore', '-q', '--no-index', lockfile], { cwd: ROOT })
      expect(await proc.exited).toBe(0)
    }
  )
})

describe('typecheck-scoped.sh', () => {
  const typecheck = (file_path: string) =>
    runHook('typecheck-scoped.sh', { tool_input: { file_path } })

  test.each([
    ['markdown', 'docs/README.md'],
    ['json', 'package.json'],
    ['css', 'apps/srd/src/styles/global.css'],
    ['a root-level ts config file', 'knip.config.ts'],
  ])('is a silent no-op for %s', async (_label, file) => {
    expect(await typecheck(file)).toBe(ALLOW)
  })

  test('an empty payload is allowed rather than erroring', async () => {
    expect(await runHook('typecheck-scoped.sh', { tool_input: {} })).toBe(ALLOW)
  })

  // The fixture below stubs every `typecheck`; these keep the stubs honest. The
  // hook once called a script #995 had deleted, and a stubbed suite stayed green.
  test('the script the hook runs exists in the real root manifest', async () => {
    const manifest = await Bun.file(join(ROOT, 'package.json')).json()
    expect(manifest.scripts.typecheck).toBeString()
  })

  test('every workspace the hook maps to exists and has a typecheck script', async () => {
    const script = await Bun.file(join(HOOKS, 'typecheck-scoped.sh')).text()
    const mapped = new Set(
      [...script.matchAll(/TARGETS="([^"*]+)"/g)].flatMap((m) => m[1]?.split(' ') ?? [])
    )
    const real = new Map<string, unknown>()
    for (const dir of ['apps/*', 'packages/*', 'tools']) {
      for await (const path of new Bun.Glob(`${dir}/package.json`).scan(ROOT)) {
        const manifest = await Bun.file(join(ROOT, path)).json()
        real.set(manifest.name, manifest.scripts?.typecheck)
        // A new workspace needs a line in the map, or its edits are never checked.
        expect(script).toMatch(new RegExp(`\\n  ${path.replace('/package.json', '')}/\\*[ )]`))
      }
    }
    expect(mapped.size).toBeGreaterThan(0)
    for (const name of mapped) expect(real.get(name)).toBeString()
  })
})

// A throwaway git repo that mirrors the workspace layout, with every
// `typecheck` script stubbed to log its name, so the scoping, the exit codes
// and the root resolution are tested without running tsc.
describe('typecheck hooks against a stub workspace', () => {
  // Git hooks (lefthook's pre-push runs this suite) export GIT_DIR and friends,
  // which would point `git init` and the hooks' `rev-parse` at the outer repo.
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  )

  const WORKSPACES = {
    'apps/discord-bot': 'discord-bot',
    'apps/itun': 'itun',
    'apps/srd': 'srd',
    'apps/su-assets': 'su-assets',
    'packages/component-lib': 'component-lib',
    'packages/itun-domain': 'itun-domain',
    'packages/observability': 'observability',
    'packages/salvageunion-reference': 'salvageunion-reference',
    tools: 'tools',
  }

  /** `fail` names workspaces whose stub exits 1; `root` is the root script. */
  async function fixture(opts: { fail?: string[]; root?: string } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'typecheck-hook-'))
    const log = join(dir, 'ran.log')
    for (const [path, name] of Object.entries(WORKSPACES)) {
      mkdirSync(join(dir, path, 'lib'), { recursive: true })
      const stub = opts.fail?.includes(name)
        ? `echo boom-from-${name} >&2; exit 1`
        : `echo ${name} >> ${log}`
      writeFileSync(
        join(dir, path, 'package.json'),
        JSON.stringify({ name, scripts: { typecheck: stub } })
      )
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
    const marker = join(dir, '.git', 'claude-typecheck-pending')
    const ran = async () =>
      (await Bun.file(log).exists()) ? (await Bun.file(log).text()).trim().split('\n').sort() : []
    return { dir, marker, ran, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
  }

  async function run(script: string, cwd: string, payload: unknown) {
    const proc = Bun.spawn([join(HOOKS, script)], {
      cwd,
      env: cleanEnv,
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
    run('typecheck-scoped.sh', join(dir, 'apps', 'srd'), {
      tool_input: { file_path: join(dir, rel) },
    })

  test.each([
    ['an app', 'apps/itun/lib/x.ts', ['itun']],
    ['the bot', 'apps/discord-bot/lib/x.ts', ['discord-bot']],
    ['component-lib', 'packages/component-lib/lib/x.ts', ['component-lib', 'itun', 'srd', 'tools']],
    [
      'observability',
      'packages/observability/lib/x.ts',
      ['discord-bot', 'itun', 'observability', 'srd', 'su-assets', 'tools'],
    ],
    [
      'itun-domain',
      'packages/itun-domain/lib/x.ts',
      ['discord-bot', 'itun', 'itun-domain', 'tools'],
    ],
    ['tools/lib', 'tools/lib/x.ts', ['itun', 'srd', 'tools']],
  ])(
    'an edit to %s checks it and its consumers, then asks for a full run',
    async (_l, rel, expected) => {
      const f = await fixture()
      try {
        const result = await edit(f.dir, rel)
        expect(result).toEqual({ code: ALLOW, stdout: '', stderr: '' })
        expect(await f.ran()).toEqual(expected)
        expect(await Bun.file(f.marker).exists()).toBe(true)
      } finally {
        f.cleanup()
      }
    }
  )

  test('a salvageunion-reference edit runs the whole-repo typecheck and no marker', async () => {
    const f = await fixture()
    try {
      expect((await edit(f.dir, 'packages/salvageunion-reference/lib/x.ts')).code).toBe(ALLOW)
      expect(await f.ran()).toEqual(['ROOT'])
      expect(await Bun.file(f.marker).exists()).toBe(false)
    } finally {
      f.cleanup()
    }
  })

  test('a failing typecheck exits 2 with the output on stderr, from any cwd', async () => {
    const f = await fixture({ fail: ['tools'] })
    try {
      const result = await edit(f.dir, 'tools/lib/x.ts')
      expect(result.code).toBe(2)
      expect(result.stderr).toContain('boom-from-tools')
      expect(result.stdout).toBe('')
    } finally {
      f.cleanup()
    }
  })

  describe('typecheck-full.sh (Stop)', () => {
    const stop = (dir: string, stop_hook_active = false) =>
      run('typecheck-full.sh', dir, { stop_hook_active })

    test('does nothing when no scoped check ran this turn', async () => {
      const f = await fixture()
      try {
        expect((await stop(f.dir)).code).toBe(ALLOW)
        expect(await f.ran()).toEqual([])
      } finally {
        f.cleanup()
      }
    })

    test('runs the whole repo once after a scoped check, silently', async () => {
      const f = await fixture()
      try {
        await edit(f.dir, 'apps/srd/lib/x.ts')
        expect(await stop(f.dir)).toEqual({ code: ALLOW, stdout: '', stderr: '' })
        expect(await f.ran()).toEqual(['ROOT', 'srd'])
        expect(await Bun.file(f.marker).exists()).toBe(false)
      } finally {
        f.cleanup()
      }
    })

    test('a failure exits 2 and keeps the marker; a continued stop is let through', async () => {
      const f = await fixture({ root: 'echo boom-from-root >&2; exit 1' })
      try {
        await edit(f.dir, 'apps/srd/lib/x.ts')
        const result = await stop(f.dir)
        expect(result.code).toBe(2)
        expect(result.stderr).toContain('boom-from-root')
        expect(await Bun.file(f.marker).exists()).toBe(true)
        expect((await stop(f.dir, true)).code).toBe(ALLOW)
      } finally {
        f.cleanup()
      }
    })
  })
})
