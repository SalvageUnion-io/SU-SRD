/**
 * Tests for `packages/gates/lib/sessionLoad.ts`. Every case runs against a
 * throwaway fixture tree; the repo's own totals are what `bun run check
 * doc-drift` asserts.
 */

import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  checkSessionLoad,
  gitignoredMatcher,
  rulePaths,
  SESSION_SLACK,
  sessionLoad,
} from '../lib/sessionLoad'

const fixtureRoots: string[] = []

afterAll(() => {
  for (const root of fixtureRoots) rmSync(root, { recursive: true, force: true })
})

/** Materialise a throwaway repo-shaped tree from `path → contents`. */
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'session-load-'))
  fixtureRoots.push(root)
  for (const [relPath, contents] of Object.entries(files)) {
    const full = join(root, relPath)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, contents)
  }
  return root
}

describe('gitignoredMatcher', () => {
  it('matches plain, dir/* and double-star rules, and nothing else', () => {
    const root = fixture({ '.gitignore': '/.profiles/\nrules/*\n**/coverage/\n!keep\n*.log\n' })
    const ignored = gitignoredMatcher(root)
    expect(ignored('.profiles/cpu.md')).toBe(true)
    expect(ignored('rules/extracted/a.txt')).toBe(true)
    expect(ignored('apps/srd/coverage/lcov.info')).toBe(true)
    expect(ignored('tools/check-doc-drift.ts')).toBe(false)
    expect(ignored('rulesets/a.md')).toBe(false)
  })

  it('matches an unanchored bare name at any depth, as git does', () => {
    const root = fixture({ '.gitignore': '.env.local\n/root-only\n' })
    const ignored = gitignoredMatcher(root)
    expect(ignored('apps/itun/.env.local')).toBe(true)
    expect(ignored('.env.local')).toBe(true)
    expect(ignored('apps/root-only')).toBe(false)
  })
})

describe('rulePaths', () => {
  it('reads quoted and bare globs from the front matter, and none when it has no paths:', () => {
    const rule =
      '---\npaths:\n  - \'apps/srd/**\'\n  - "**/*.css"\n  - bunfig.toml\n---\n\n# Rule\n'
    expect(rulePaths(rule)).toEqual(['apps/srd/**', '**/*.css', 'bunfig.toml'])
    expect(rulePaths('# Rule\n\npaths:\n  - nope\n')).toEqual([])
  })
})

describe('sessionLoad and checkSessionLoad', () => {
  const tree = () =>
    fixture({
      'CLAUDE.md': '@AGENTS.md\n',
      'AGENTS.md': 'a'.repeat(100),
      'apps/srd/CLAUDE.md': 's'.repeat(50),
      'apps/srd/src/page.ts': '',
      'apps/srd/src/deep/CLAUDE.md': 'd'.repeat(5),
      'apps/srd/dist/CLAUDE.md': 'built',
      'apps/bot/CLAUDE.md': 'b'.repeat(70),
      'apps/bot/src/x.css': '',
      'docs/GUIDE.md': 'g'.repeat(30),
      '.gitignore': 'dist\n',
      '.claude/rules/srd.md': "---\npaths:\n  - 'apps/srd/**'\n---\n",
      '.claude/rules/css.md': "---\npaths:\n  - '**/*.css'\n---\n",
      '.claude/rules/always.md': '# no paths\n',
    })

  it('loads the root CLAUDE.md with its imports, nested CLAUDE.mds, matching rules and reads', () => {
    const root = tree()
    expect(sessionLoad(root, { dirs: ['apps/srd'], reads: ['docs/GUIDE.md'] })).toEqual([
      'CLAUDE.md',
      'AGENTS.md',
      'apps/srd/CLAUDE.md',
      'apps/srd/src/deep/CLAUDE.md',
      '.claude/rules/always.md',
      '.claude/rules/srd.md',
      'docs/GUIDE.md',
    ])
    expect(sessionLoad(root, { dirs: ['apps/bot'], reads: [] })).toEqual([
      'CLAUDE.md',
      'AGENTS.md',
      'apps/bot/CLAUDE.md',
      '.claude/rules/always.md',
      '.claude/rules/css.md',
    ])
  })

  it('fails a profile over its ceiling or too far under it, and stale or missing entries', () => {
    const root = tree()
    const profiles = { srd: { dirs: ['apps/srd'], reads: [] } }
    // CLAUDE.md 11, AGENTS.md 100, the two CLAUDE.mds 50 + 5, the rules 11 + 33.
    const total = 210
    expect(checkSessionLoad(root, profiles, { srd: total }).failures).toEqual([])
    expect(checkSessionLoad(root, profiles, { srd: total + SESSION_SLACK }).failures).toEqual([])
    expect(checkSessionLoad(root, profiles, { srd: total - 1 }).failures.join('\n')).toContain(
      `The srd session loads ${total} characters, over its ${total - 1} ceiling (largest: AGENTS.md 100`
    )
    expect(
      checkSessionLoad(root, profiles, { srd: total + SESSION_SLACK + 1 }).failures.join('\n')
    ).toContain(`Lower SESSION_CEILINGS.srd to ${total}.`)
    expect(checkSessionLoad(root, profiles, {}).failures).toEqual([
      `SESSION_CEILINGS has no entry for srd. Add it at ${total}.`,
    ])
    expect(
      checkSessionLoad(
        root,
        { gone: { dirs: ['apps/gone'], reads: ['docs/GONE.md'] } },
        { gone: 11 + 100 + 11 }
      ).failures
    ).toEqual([
      'SESSION_PROFILES.gone names apps/gone, which does not exist.',
      'SESSION_PROFILES.gone names docs/GONE.md, which does not exist.',
    ])
    expect(checkSessionLoad(root, {}, { old: 1 }).failures).toEqual([
      'SESSION_CEILINGS names old, which is not a profile. Remove the entry.',
    ])
  })
})
