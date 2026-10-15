import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { checkCommentHistory, historyHits, isCommentSource } from '../lib/commentHistory'

/**
 * The `history` check of `tools/check-doc-drift.ts` reads code comments for
 * phrases that narrate how the code got here. These pin what each phrase
 * catches, what it leaves alone, and that only comments are read.
 */

const hits = (source: string, file = 'a.ts') =>
  historyHits(file, source).map(({ line, phrase, match }) => [line, phrase.id, match])

describe('historyHits', () => {
  test('finds each phrase in line, block and JSX comments, on its own line', () => {
    const source = [
      '// The invite link (issue 1255).',
      '/**',
      ' * Shared patterns (#1276), shipped in Phase 4.',
      ' * The gauge used to infer the override. Previously it sorted first.',
      ' */',
      'export const A = () => <div>{/* formerly the .pc-* scope, PR #292 */}</div>',
    ].join('\n')
    expect(hits(source, 'a.tsx')).toEqual([
      [1, 'issue-number', 'issue 1255'],
      [3, 'issue-number', '#1276'],
      [3, 'phase-number', 'Phase 4'],
      [4, 'used-to', 'used to'],
      [4, 'previously', 'Previously'],
      [6, 'issue-number', 'PR #292'],
      [6, 'previously', 'formerly'],
    ])
  })

  test('reads comments only: strings, templates and code are not comments', () => {
    const source = [
      "const a = 'issue 1255, used to, Phase 4'",
      'const b = `Previously #1276`',
      'const c = /#[1-9]\\d+/ // a pattern',
    ].join('\n')
    expect(hits(source)).toEqual([])
  })

  test('leaves the passive, names and samples alone', () => {
    const source = [
      '// The Tech Level is used to scale choice caps; it will be used to sort.',
      '/** Used to stub the accessor in tests. */',
      '// Current SP — used to apply overheat damage.',
      "// Union Crawler #430 'Tenacity', and React #418 on a hydration mismatch.",
      '// A run like `#466`, or "#430", in a sample.',
      '// a previously-chosen value, and colours like #fff.',
    ].join('\n')
    expect(hits(source)).toEqual([])
  })
})

describe('isCommentSource', () => {
  test('reads script and module code, not generated output or declarations', () => {
    expect(isCommentSource('apps/cantina/src/a.tsx')).toBe(true)
    expect(isCommentSource('apps/cantina/public/sw-takeover.js')).toBe(true)
    expect(isCommentSource('tools/check.ts')).toBe(true)
    expect(isCommentSource('apps/cantina/convex/_generated/api.d.ts')).toBe(false)
    expect(isCommentSource('apps/cantina/src/routeTree.gen.ts')).toBe(false)
    expect(isCommentSource('packages/x/lib/generated/registry.ts')).toBe(false)
    expect(isCommentSource('apps/cantina/src/vite-env.d.ts')).toBe(false)
    expect(isCommentSource('docs/README.md')).toBe(false)
  })
})

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'comment-history-'))
  roots.push(root)
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), contents)
  }
  return root
}

describe('checkCommentHistory', () => {
  test('fails each phrase with its line and what to write instead', () => {
    const files = {
      'apps/cantina/src/a.ts': "// Shelves (issue 1279).\nexport const a = 'issue 1279'\n",
      'packages/x/lib/b.ts': '/**\n * The gauge used to decide this.\n */\nexport const b = 1\n',
      'tools/c.ts': '// What is true now.\n',
    }
    const root = fixture(files)
    const result = checkCommentHistory(root, Object.keys(files))
    expect(result.failures).toEqual([
      'apps/cantina/src/a.ts:1 says "issue 1279" (issue-number), history in a code comment: say what the code does; the issue is in git history.',
      'packages/x/lib/b.ts:2 says "used to" (used-to), history in a code comment: state the invariant the old behaviour broke.',
    ])
    expect(result.ok).toContain('3 source files')
    expect(checkCommentHistory(root, ['tools/c.ts']).failures).toEqual([])
  })

  test('reads the tracked source by default, and fails a scan under its floor', () => {
    const root = fixture({
      'tools/c.ts': '// Previously, nothing.\n',
      'docs/d.md': '# Previously\n',
    })
    // lefthook's pre-push exports GIT_DIR and friends; left in, git would act
    // on the outer repo instead of the fixture.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
    )
    Bun.spawnSync(['git', 'init', '-q'], { cwd: root, env })
    Bun.spawnSync(['git', 'add', '.'], { cwd: root, env })
    const { ok, failures } = checkCommentHistory(root, undefined, env)
    expect(ok).toContain('1 source files')
    expect(failures[0]).toContain('tools/c.ts:1 says "Previously"')
    expect(failures[1]).toContain('history read 1 source files, under its floor')
  })
})
