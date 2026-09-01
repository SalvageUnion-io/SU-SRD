import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

/**
 * Behaviour tests for the two `PreToolUse` hooks in `.claude/hooks/`.
 *
 * ## Why these exist
 *
 * Both hooks were written, wired into `settings.json`, and never tested — and
 * both were silently failing open in ways nobody could see from reading them.
 *
 * `protect-generated-files.sh` matched with `[[ "$FILE_PATH" == *"$pattern"* ]]`,
 * which makes a `*` inside the pattern a LITERAL asterisk rather than a glob.
 * Exactly one of its six entries contained a wildcard, and it was the JSON
 * schemas — the file class its own error message is mostly about, and the one
 * CI fails on for drift. So `dist/` was protected twice over and `schemas/` not
 * at all.
 *
 * `enforce-bun.sh` recognised its token only at the start of a line or right
 * after `&&`, `||` or `;`, so `bunx <pm> install` passed — and `Bash(bunx *)`
 * is in the `allow` list, making that the one form permitted by BOTH layers
 * with no prompt.
 *
 * A hook is a guard. An untested guard is a claim.
 *
 * ## Note on the assembled token
 *
 * The package-manager name is built by concatenation throughout. That is not
 * style: this file is edited by agents whose own Bash calls run through
 * `enforce-bun.sh`, and a literal occurrence makes routine commands touching
 * this file unrunnable. (Which is itself evidence the hook works.)
 */

const ROOT = join(import.meta.dir, '..', '..')
const HOOKS = join(ROOT, '.claude', 'hooks')

const PM = `np${'m'}`
const PM2 = `yar${'n'}`
const PM3 = `pnp${'m'}`

async function runHook(script: string, payload: unknown): Promise<number> {
  const proc = Bun.spawn([join(HOOKS, script)], {
    cwd: ROOT,
    stdin: new TextEncoder().encode(JSON.stringify(payload)),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return await proc.exited
}

const bash = (command: string) => runHook('enforce-bun.sh', { tool_input: { command } })
const edit = (file_path: string) =>
  runHook('protect-generated-files.sh', { tool_input: { file_path } })

/** PreToolUse blocks on exit 2; 0 allows. */
const BLOCK = 2
const ALLOW = 0

describe('enforce-bun.sh', () => {
  test.each([
    ['plain', `${PM} install`],
    ['leading whitespace', `  ${PM} install`],
    ['after &&', `ls && ${PM} install`],
    ['after ;', `cd x; ${PM} ci`],
    ['the second package manager', `${PM2} add foo`],
    ['the third', `${PM3} i`],
    // Everything below here passed before the rewrite.
    ['behind sudo', `sudo ${PM} install`],
    ['behind bunx — allowed by BOTH layers before', `bunx ${PM} install`],
    ['in a subshell', `( ${PM} install )`],
    ['inside a for loop', `for i in 1; do ${PM} i; done`],
    ['after an env assignment', `x=1 ${PM} install`],
    ['after a single pipe', `echo hi | ${PM} install`],
    ['bare, with no arguments', PM],
  ])('blocks %s', async (_label, command) => {
    expect(await bash(command)).toBe(BLOCK)
  })

  test.each([
    ['bun install', 'bun install'],
    ['bunx for a real one-off', 'bunx wrangler deploy --dry-run'],
    ['a bun script', 'bun run test'],
    ['an unrelated command', 'ls node_modules'],
  ])('allows %s', async (_label, command) => {
    expect(await bash(command)).toBe(ALLOW)
  })

  test('a quoted token is deliberately NOT caught', async () => {
    // Documented boundary, asserted so it is a decision rather than a gap
    // someone rediscovers. Nobody types this by accident; a deliberate evader
    // can split the token across a concatenation anyway, which no regex closes.
    // The `deny` entry in settings.json is the real control.
    expect(await bash(`bash -c "${PM} install"`)).toBe(ALLOW)
  })

  test('an empty command is allowed rather than erroring', async () => {
    expect(await runHook('enforce-bun.sh', { tool_input: {} })).toBe(ALLOW)
  })
})

describe('protect-generated-files.sh', () => {
  test.each([
    // The wildcard entry — the whole reason this suite exists. Allowed before.
    ['a generated JSON schema', 'packages/salvageunion-reference/schemas/chassis.schema.json'],
    ['the same, absolute', `${ROOT}/packages/salvageunion-reference/schemas/abilities.schema.json`],
    ['generated docs', 'packages/salvageunion-reference/docs/schemas/chassis.md'],
    ['generated lib code', 'packages/salvageunion-reference/lib/generated/registry.generated.ts'],
    ['the API report', 'packages/salvageunion-reference/etc/salvageunion-reference.api.d.ts'],
    ['the router tree', 'apps/itun/src/routeTree.gen.ts'],
    ['anything under dist', 'apps/srd/dist/index.html'],
    // Unlisted before, all silently allowed.
    ['Convex codegen', 'apps/itun/convex/_generated/api.d.ts'],
    ['the srd output snapshot', 'apps/srd/ssg/output-snapshot.json'],
    ['the lockfile', 'bun.lock'],
    ['the coverage baseline', 'coverage-baseline.json'],
    ['a tools baseline', 'tools/design-tokens-baseline.json'],
    ['generated editor settings', '.vscode/settings.json'],
  ])('blocks %s', async (_label, path) => {
    expect(await edit(path)).toBe(BLOCK)
  })

  test.each([
    [
      'a Zod schema — the file you SHOULD edit',
      'packages/salvageunion-reference/lib/schemas/chassis.ts',
    ],
    ['an app component', 'apps/itun/src/components/Foo.tsx'],
    ['a tool', 'tools/check-path-filters.ts'],
    ['a doc', 'docs/README.md'],
  ])('allows %s', async (_label, path) => {
    expect(await edit(path)).toBe(ALLOW)
  })

  test('covers the NotebookEdit payload shape', async () => {
    // `PreToolUse` matcher `Edit|Write` substring-matches `NotebookEdit`, which
    // passes `notebook_path` rather than `file_path`. That fell through to the
    // empty-path early exit, i.e. allowed silently.
    expect(
      await runHook('protect-generated-files.sh', {
        tool_input: { notebook_path: 'apps/srd/dist/x.ipynb' },
      })
    ).toBe(BLOCK)
  })

  test('an empty payload is allowed rather than erroring', async () => {
    expect(await runHook('protect-generated-files.sh', { tool_input: {} })).toBe(ALLOW)
  })
})
