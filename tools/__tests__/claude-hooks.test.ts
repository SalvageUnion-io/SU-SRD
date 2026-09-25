import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
    ['in a command substitution', `echo $(${PM} bin)`],
    ['behind env', `env CI=1 ${PM} test`],
    // Wrapper and keyword forms a command-position regex missed.
    ['behind a wrapper with a flag', `sudo -E ${PM} install`],
    ['behind timeout', `timeout 60 ${PM} install`],
    ['as an if condition', `if ${PM} test; then echo ok; fi`],
    ['negated', `! ${PM} test`],
    ['behind a quoted assignment', `FOO="a b" ${PM} install`],
    ['behind bun x', `bun x ${PM} install`],
    ['as an absolute path', `/usr/bin/${PM} install`],
    ['found through which', `$(which ${PM}) install`],
    ['versioned behind bunx', `bunx ${PM}@10 install`],
    ['run through command', `command ${PM} install`],
    ['after a quoted apostrophe on the same line', `echo "it's"; ${PM} install; echo 'x'`],
    ['on a later line of a multi-line command', `echo start\n${PM} install`],
    // A command substitution inside double quotes is code: it runs.
    ['in a quoted command substitution', `ls "$(${PM} root -g)"`],
    ['in a quoted substitution in an assignment', `export PATH="$(${PM} bin):$PATH"`],
    ['through a quoted which', `"$(which ${PM})" install`],
    ['in a quoted backtick substitution', `echo "\`${PM} bin\`"`],
    // An apostrophe in a comment must not open a quote that hides later lines.
    ['after a comment containing an apostrophe', `echo hi # don't do this\n${PM} install`],
  ])('blocks %s', async (_label, command) => {
    expect(await bash(command)).toBe(BLOCK)
  })

  test.each([
    ['bun install', 'bun install'],
    ['bunx for a real one-off', 'bunx wrangler deploy --dry-run'],
    ['a bun script', 'bun run test'],
    ['an unrelated command', 'ls node_modules'],
    // Mentions that are not in command position. The any-whitespace pattern
    // blocked all of these, which made commit messages, greps and PR bodies
    // about the rule itself unrunnable.
    ['a commit message that mentions it', `git commit -m "docs: say ${PM} is banned"`],
    ['a grep for it', `grep -rn ${PM} docs`],
    ['an rg for a phrase', `rg -n "${PM} run" apps`],
    ['a path containing it', `ls node_modules/${PM2}`],
    ['a cd into a directory named for it', `cd node_modules/${PM2}`],
    ['a quoted mention after a separator', `git commit -m "a; ${PM} is banned"`],
    ['an rg alternation', `rg "(${PM}|${PM2})" docs`],
    ['a lookup through which', `which ${PM}`],
    ['a lookup through command -v', `command -v ${PM}`],
    ['a mention in a trailing comment', `rm -f package-lock.json # left by ${PM}`],
    ['a quoted substitution that is harmless', `git commit -m "fix: $(date) ${PM} note"`],
    ['a harmless quoted backtick substitution', `git commit -m "built \`date\` without ${PM}"`],
    // How agents actually write commits and PR bodies: multi-line quoted text
    // and heredocs. Stripping quotes one line at a time blocked all of these.
    [
      'a heredoc commit message',
      `git commit -m "$(cat <<'EOF'\ndocs: explain why\n\n${PM} install; ${PM2} add are banned\nEOF\n)"`,
    ],
    [
      'a multi-line double-quoted PR body',
      `gh pr create --title x --body "line one\n${PM} install\nline three"`,
    ],
    ['a multi-line single-quoted message', `git commit -m 'first\n| ${PM} ci\nlast'`],
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

  // A throwaway git repo whose `typecheck:tools` script is a stub, so the
  // exit-code path and the root resolution are tested without running tsc.
  // Git hooks (lefthook's pre-push runs this suite) export GIT_DIR and friends,
  // which would point `git init` and the hook's `rev-parse` at the outer repo.
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  )

  async function fixture(script: string): Promise<{ dir: string; file: string }> {
    const dir = mkdtempSync(join(tmpdir(), 'typecheck-hook-'))
    mkdirSync(join(dir, 'tools'))
    mkdirSync(join(dir, 'apps', 'srd'), { recursive: true })
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ scripts: { 'typecheck:tools': script } })
    )
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
