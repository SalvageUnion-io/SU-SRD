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
      '// Print export (#82/#258).',
    ].join('\n')
    expect(hits(source, 'a.tsx')).toEqual([
      [1, 'issue-number', 'issue 1255'],
      [3, 'issue-number', '#1276'],
      [3, 'phase-number', 'Phase 4'],
      [4, 'used-to', 'used to'],
      [4, 'previously', 'Previously'],
      [6, 'issue-number', 'PR #292'],
      [6, 'previously', 'formerly'],
      [7, 'issue-number', '#258'],
    ])
  })

  test('finds who asked and when: a review round, a dated call, a board, a mockup', () => {
    const source = [
      '// Never a chip (owner, round 4). One frame (C6, C7; owner, 2026-10-20).',
      "// TL first (owner's call, 2026-10-14); one order (owner's rule, 2026-10-14).",
      '// round 8: "top border should not be pink"; the Heat red (round 4).',
      '// The release notes (ruling 2026-10-19), the trees (rounds 4–5).',
      '// The Contents page (board 06); the shelves (boards S1, N2).',
      '// The stepper rail (mockup Screen 02 `.rlabel`).',
    ].join('\n')
    expect(hits(source)).toEqual([
      [1, 'owner-stamp', 'owner, round 4'],
      [1, 'owner-stamp', 'owner, 2026-10'],
      [1, 'review-round', 'round 4)'],
      [2, 'owner-stamp', "owner's call, 2026-10"],
      [2, 'owner-stamp', "owner's rule, 2026-10"],
      [2, 'dated-call', 'call, 2026-10-14'],
      [2, 'dated-call', 'rule, 2026-10-14'],
      [3, 'review-round', 'round 8:'],
      [3, 'review-round', '(round 4'],
      [4, 'review-round', '(rounds 4'],
      [4, 'dated-call', 'ruling 2026-10-19'],
      [5, 'board-ref', 'board 06'],
      [5, 'board-ref', 'boards S1'],
      [6, 'mockup', 'mockup'],
      [6, 'mockup', 'Screen 02'],
    ])
  })

  test('finds a phrase wrapped across the lines of a comment, on its first line', () => {
    const source = [
      "/** One frame (owner's call,",
      ' * 2026-10-20). */',
      '// The trees (owner,',
      '// round 5).',
      "const a = 1 // A trailing comment runs on into the next line: owner's",
      '// call, 2026-10-14.',
      'const b = 2',
      '// round 9: a comment after code starts its own run.',
    ].join('\n')
    expect(hits(source)).toEqual([
      [1, 'owner-stamp', "owner's call, 2026-10"],
      [1, 'dated-call', 'call, 2026-10-20'],
      [3, 'owner-stamp', 'owner, round 5'],
      [4, 'review-round', 'round 5)'],
      [5, 'owner-stamp', "owner's call, 2026-10"],
      [6, 'dated-call', 'call, 2026-10-14'],
      [8, 'review-round', 'round 9:'],
    ])
  })

  test("leaves a game's rounds, a unit's owner and a date in code alone", () => {
    const source = [
      '// The round ends when every unit has acted; each round its Heat cools.',
      "// The owner's units, the owner chip, and the board's owner.",
      "const d = '2026-10-14' // a sample date",
    ].join('\n')
    expect(hits(source)).toEqual([])
  })

  test("reads a stylesheet's block comments, not its rules", () => {
    const source = [
      '/* One hairline all round (owner, round 8). */',
      '.a { content: "(round 4)"; }',
      '/*',
      ' * Board 06: the Contents page.',
      ' */',
    ].join('\n')
    expect(hits(source, 'a.css')).toEqual([
      [1, 'owner-stamp', 'owner, round 8'],
      [1, 'review-round', 'round 8)'],
      [4, 'board-ref', 'Board 06'],
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
  test('reads script, module and stylesheet code, not generated output or declarations', () => {
    expect(isCommentSource('apps/web/src/routes/a.tsx')).toBe(true)
    expect(isCommentSource('apps/web/src/styles/pages.css')).toBe(true)
    expect(isCommentSource('apps/web/public/sw-takeover.js')).toBe(true)
    expect(isCommentSource('tools/check.ts')).toBe(true)
    expect(isCommentSource('apps/web/convex/_generated/api.d.ts')).toBe(false)
    expect(isCommentSource('apps/web/src/routeTree.gen.ts')).toBe(false)
    expect(isCommentSource('packages/x/lib/generated/registry.ts')).toBe(false)
    expect(isCommentSource('apps/web/src/routes/vite-env.d.ts')).toBe(false)
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
      'apps/web/src/routes/a.ts': "// Shelves (issue 1279).\nexport const a = 'issue 1279'\n",
      'packages/x/lib/b.ts': '/**\n * The gauge used to decide this.\n */\nexport const b = 1\n',
      'tools/c.ts': '// What is true now.\n',
    }
    const root = fixture(files)
    const result = checkCommentHistory(root, Object.keys(files))
    expect(result.failures).toEqual([
      'apps/web/src/routes/a.ts:1 says "issue 1279" (issue-number), history in a code comment: say what the code does; the issue is in git history.',
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
