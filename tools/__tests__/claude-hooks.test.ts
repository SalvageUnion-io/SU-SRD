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
    ['the a11y baseline — new debt is accepted by hand, with a reason', 'tools/a11y-baseline.json'],
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

  // The fixture below stubs `typecheck`; this keeps the stub honest. The hook
  // once called a script #995 had deleted, and a stubbed suite stayed green.
  test('the script the hook runs exists in the real root manifest', async () => {
    const manifest = await Bun.file(join(ROOT, 'package.json')).json()
    expect(manifest.scripts.typecheck).toBeString()
  })

  // A throwaway git repo whose `typecheck` script is a stub, so the exit-code
  // path and the root resolution are tested without running tsc.
  // Git hooks (lefthook's pre-push runs this suite) export GIT_DIR and friends,
  // which would point `git init` and the hook's `rev-parse` at the outer repo.
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  )

  async function fixture(script: string): Promise<{ dir: string; file: string }> {
    const dir = mkdtempSync(join(tmpdir(), 'typecheck-hook-'))
    mkdirSync(join(dir, 'tools'))
    mkdirSync(join(dir, 'apps', 'srd'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { typecheck: script } }))
    writeFileSync(join(dir, 'tools', 'x.ts'), 'export {}\n')
    await Bun.spawn(['git', 'init', '-q', dir], { env: cleanEnv }).exited
    return { dir, file: join(dir, 'tools', 'x.ts') }
  }

  async function runFrom(cwd: string, file_path: string) {
    const proc = Bun.spawn([join(HOOKS, 'typecheck-scoped.sh')], {
      cwd,
      env: cleanEnv,
      stdin: new TextEncoder().encode(JSON.stringify({ tool_input: { file_path } })),
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

  test('a failing typecheck exits 2 with the output on stderr, from any cwd', async () => {
    const { dir, file } = await fixture('echo boom-from-tsc >&2; exit 1')
    try {
      const result = await runFrom(join(dir, 'apps', 'srd'), file)
      expect(result.code).toBe(2)
      expect(result.stderr).toContain('boom-from-tsc')
      expect(result.stdout).toBe('')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a passing typecheck is silent', async () => {
    const { dir, file } = await fixture('echo all-good')
    try {
      const result = await runFrom(join(dir, 'apps', 'srd'), file)
      expect(result.code).toBe(ALLOW)
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
