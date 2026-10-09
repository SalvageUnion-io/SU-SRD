/**
 * Tests for `tools/check-doc-drift.ts`. Every case runs against a throwaway
 * fixture tree; the repo's own state is what `bun run check doc-drift` asserts.
 */

import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  agentWorkflowScripts,
  checkBacktickedPathsExist,
  checkDecisions,
  checkDocSizes,
  checkMarkdownLinks,
  checkReferencedScripts,
  citationReadsAsHistoryOrProposal,
  gitignoredMatcher,
  headingSlug,
  pathCandidate,
  sentenceAround,
  splitMarkdownBlocks,
} from '../check-doc-drift'

const fixtureRoots: string[] = []

afterAll(() => {
  for (const root of fixtureRoots) rmSync(root, { recursive: true, force: true })
})

/** Materialise a throwaway repo-shaped tree from `path → contents`. */
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'doc-drift-'))
  fixtureRoots.push(root)
  for (const [relPath, contents] of Object.entries(files)) {
    const full = join(root, relPath)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, contents)
  }
  return root
}

describe('splitMarkdownBlocks', () => {
  it('splits on blank lines and keeps 1-indexed line numbers', () => {
    const blocks = splitMarkdownBlocks('first para\nstill first\n\nsecond para\n')
    expect(blocks.map((b) => [b.line, b.text])).toEqual([
      [1, 'first para\nstill first'],
      [4, 'second para'],
    ])
  })

  it('treats each list item as its own block', () => {
    const blocks = splitMarkdownBlocks('- one\n- two\n  wrapped\n- three\n')
    expect(blocks.map((b) => b.line)).toEqual([1, 2, 4])
    expect(blocks[1]?.text).toBe('- two\n  wrapped')
  })

  it('drops fenced content', () => {
    const source = 'before\n\n```\nfenced line\n```\n\nafter\n'
    expect(splitMarkdownBlocks(source).map((b) => b.text)).toEqual(['before', 'after'])
  })
})

describe('pathCandidate', () => {
  it('judges repo-rooted and workspace-relative paths', () => {
    expect(pathCandidate('.claude/skills/triage/SKILL.md')).toBe('.claude/skills/triage/SKILL.md')
    expect(pathCandidate('.github/workflows/ci.yml')).toBe('.github/workflows/ci.yml')
    expect(pathCandidate('src/lib/connection/')).toBe('src/lib/connection/')
    expect(pathCandidate('bunfig.toml')).toBe('bunfig.toml')
  })

  it('strips a line suffix and an anchor', () => {
    expect(pathCandidate('tools/check-doc-drift.ts:42')).toBe('tools/check-doc-drift.ts')
    expect(pathCandidate('docs/README.md#adrs')).toBe('docs/README.md')
  })

  it('ignores globs, placeholders, packages, refs and import specifiers', () => {
    for (const token of [
      'apps/*/wrangler.jsonc',
      'docs/adrs/ADR-<n>.md',
      '@sentry/browser',
      'origin/main',
      'convex/react',
      'https://example.com/docs/x',
      '~/.claude.json',
      'bun run test',
    ]) {
      expect(pathCandidate(token)).toBeNull()
    }
  })
})

/** Is the first backticked span of `text` excused as history or a proposal? */
function excused(text: string, token?: string): boolean {
  const span = token === undefined ? (text.match(/`[^`]*`/)?.[0] ?? '') : `\`${token}\``
  const index = text.indexOf(span)
  expect(index).toBeGreaterThanOrEqual(0)
  return citationReadsAsHistoryOrProposal(text, index, span.length)
}

describe('sentenceAround', () => {
  it('ends a sentence at a period followed by closing markup', () => {
    const text = '- **Workspaces are retired.** Resolve through `src/lib/container.ts`.'
    expect(sentenceAround(text, text.indexOf('`src'))).toBe(
      ' Resolve through `src/lib/container.ts`.'
    )
    const paren = 'See the note (it was deleted.) Then read `b.md`.'
    expect(sentenceAround(paren, paren.indexOf('`b.md`'))).toBe(' Then read `b.md`.')
  })

  it('treats every table row and list item as its own unit', () => {
    const table = '| Who may create | anyone |\n| Storage | `apps/itun/convex/schema.ts` |'
    expect(sentenceAround(table, table.indexOf('`apps'))).toBe(
      '| Storage | `apps/itun/convex/schema.ts` |'
    )
    const list = '- `a.ts` was deleted\n- `b.ts` is live'
    expect(sentenceAround(list, list.indexOf('`b.ts`'))).toBe('- `b.ts` is live')
  })
})

describe('citationReadsAsHistoryOrProposal', () => {
  it('scopes history to the sentence, not the paragraph', () => {
    const text = 'The old `a.md` was deleted. Read `b.md` for the live rules.'
    expect(excused(text, 'a.md')).toBe(true)
    expect(excused(text, 'b.md')).toBe(false)
  })

  it('judges the prose, never the path spelling', () => {
    expect(excused('Route `src/routes/npcs/new.tsx` is the wizard')).toBe(false)
    expect(excused('Route `src/routes/removed/x.tsx` is live')).toBe(false)
  })

  it('reads create as a proposal only as an imperative opening the sentence', () => {
    expect(excused('Create `test/preload.ts` in the package')).toBe(true)
    expect(excused('- Create `test/preload.ts` in the package')).toBe(true)
    expect(excused('Gated on the create path by `lib/rules/creation.ts`')).toBe(false)
    expect(excused('| Who may create | the owner, via `apps/itun/convex/publicSheet.ts` |')).toBe(
      false
    )
  })

  it('still judges live instructions that merely contain not / will / add / was', () => {
    for (const sentence of [
      'Do not edit `src/stores/entityBackend.ts` directly',
      'The hook will run `tools/check-path-filters.ts` for you',
      'Add a row to `tools/check-path-filters.ts` when you add a workspace',
      'The gate was written in `tools/check-doc-drift.ts`',
      'Use `a.ts` rather than `b.ts`',
      'There is no second copy of `tools/x.ts`',
    ]) {
      expect(excused(sentence)).toBe(false)
    }
  })

  it('skips citations marked as gone or not yet built right beside them', () => {
    for (const sentence of [
      '`tools/x.ts` was deleted with P8',
      'The old `a.md` no longer exists',
      '`b.md` used to hold this',
      '`docs/rules/` never existed',
      'The planned `tools/y.ts` does not exist yet',
      'Three tools read `old-host.toml` (since deleted) at the time',
      'the method-conditioned redirect in the since-deleted `old-host.toml` never matched',
    ]) {
      expect(excused(sentence)).toBe(true)
    }
  })

  it('does not let a history word far along the same sentence excuse a live path', () => {
    const text =
      '`Next` is gated by the step gates in `lib/rules/creation.ts` with the unmet ' +
      'requirement in the footer note, cross-step invalidation and draft-restore clamping ' +
      'are announced by toast, and the advisory `Banner` is removed from the create flow.'
    expect(excused(text, 'lib/rules/creation.ts')).toBe(false)
    expect(excused(text, 'Banner')).toBe(true)
  })
})

describe('checkBacktickedPathsExist', () => {
  it('judges a stale path in a rule sentence that only says not / will', () => {
    const root = fixture({
      '.claude/rules/x.md':
        'Do not read Dexie directly; go through `src/stores/entityBackendRenamed.ts`.\n\n' +
        'The hook will run `tools/check-path-filters-renamed.ts` for you.\n',
    })
    const { failures } = checkBacktickedPathsExist(root)
    expect(failures).toHaveLength(2)
  })

  it('fails on a .claude path a rule cites that does not exist', () => {
    const root = fixture({
      '.claude/rules/x.md': 'Follow `.claude/skills/gone/SKILL.md` before merging.\n',
    })
    const { failures } = checkBacktickedPathsExist(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('.claude/rules/x.md:1')
    expect(failures[0]).toContain('`.claude/skills/gone/SKILL.md`')
  })

  it('resolves a workspace-relative path under any workspace, with or without src/', () => {
    const root = fixture({
      'apps/itun/src/lib/rules/downtime.ts': '',
      'apps/itun/src/lib/db/broadcast.ts': '',
      '.claude/rules/x.md':
        'Downtime lives in `lib/rules/downtime.ts`, and writes publish through `lib/db/broadcast`.\n',
    })
    expect(checkBacktickedPathsExist(root).failures).toEqual([])
  })

  it('scans docs/ARCHITECTURE.md as a live-instruction doc', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md': '## Data flow\n\nWrites go through `apps/itun/src/stores/gone.ts`.\n',
    })
    const { failures } = checkBacktickedPathsExist(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('docs/ARCHITECTURE.md:3 cites `apps/itun/src/stores/gone.ts`')
  })

  it('does not scan the ADRs under # Decisions: their paths and scripts are history', () => {
    const root = fixture({
      'package.json': JSON.stringify({ scripts: {} }),
      'docs/ARCHITECTURE.md':
        '## Data flow\n\nWrites go through `apps/itun/src/stores/gone.ts`.\n\n# Decisions\n\n' +
        '## ADR-001\n\nWe kept `apps/itun/old-host/functions/` and ran `bun run old-host`.\n',
    })
    expect(checkBacktickedPathsExist(root).failures).toHaveLength(1)
    expect(checkReferencedScripts(root).failures).toEqual([])
  })

  it('does not let a negation in a NEIGHBOURING sentence excuse a stale path', () => {
    const root = fixture({
      'docs/architecture/x.md':
        'The old host is not used any more. Deploys run from `.github/workflows/deploy.yml`.\n',
    })
    expect(checkBacktickedPathsExist(root).failures).toHaveLength(1)
  })

  it('allows a path marked as history beside it, but not by its section heading alone', () => {
    const root = fixture({
      'docs/architecture/x.md':
        '`tools/sync.ts` was deleted after P6.\n\n## Old host — retired\n\nSee `apps/srd/old-host.toml`.\n',
    })
    const { failures } = checkBacktickedPathsExist(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('`apps/srd/old-host.toml`')
  })

  it('judges live paths in the shapes that used to hide them (end to end)', () => {
    const root = fixture({
      'apps/itun/src/lib/rules/creation.ts': '',
      'apps/itun/CLAUDE.md':
        '- **Workspaces are retired.** An entity lives in one container, resolved\n' +
        '  through `src/lib/containerGone.ts`, never by reading `workspaceId`.\n',
      'docs/architecture/sheets.md':
        '| Concern | Snapshot | Public sheet |\n| --- | --- | --- |\n' +
        '| Who may create | anyone | the owner, via `apps/itun/convex/publicSheetGone.ts` |\n' +
        '| Who may revoke | anyone | the owner only |\n',
      'docs/architecture/rules.md':
        '- **Wizard** enforces creation **hard** on the create path: `Next` is gated by\n' +
        '  the step gates in `lib/rules/creationGone.ts` with the unmet requirement in the\n' +
        '  footer note, cross-step invalidation is announced by toast, and the advisory\n' +
        '  banner is removed from the create flow. Gates live in `lib/rules/creation.ts`.\n',
    })
    const { failures } = checkBacktickedPathsExist(root)
    expect(failures).toHaveLength(3)
    expect(failures.join('\n')).toContain('apps/itun/CLAUDE.md:2 cites `src/lib/containerGone.ts`')
    expect(failures.join('\n')).toContain(
      'docs/architecture/sheets.md:3 cites `apps/itun/convex/publicSheetGone.ts`'
    )
    expect(failures.join('\n')).toContain(
      'docs/architecture/rules.md:2 cites `lib/rules/creationGone.ts`'
    )
  })

  it('skips a doc whose status line declares it a plan', () => {
    const root = fixture({
      'docs/architecture/plan.md':
        '# NPCs\n\n> **Status:** Plan. Nothing here is built.\n\nRoute `src/routes/npcs/new.tsx`.\n',
    })
    expect(checkBacktickedPathsExist(root).failures).toEqual([])
  })

  it('does not judge a gitignored path, which is absent in CI by design', () => {
    const root = fixture({
      '.gitignore': '# agent checkouts\n.claude/worktrees/\nrules/*\n**/coverage/\n/.profiles/\n',
      '.claude/rules/x.md':
        'Old checkouts pile up in `.claude/worktrees/`, extracts in `rules/extracted/core.txt`, ' +
        'reports in `apps/itun/coverage/lcov.info` and profiles in `.profiles/`. See `tools/gone.ts`.\n',
    })
    const { failures } = checkBacktickedPathsExist(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('`tools/gone.ts`')
  })

  it('scans agent memory as a live-instruction doc', () => {
    const root = fixture({
      '.claude/agent-memory/ux/MEMORY.md': 'Tokens live in `packages/ui/theme.css`.\n',
    })
    const { failures } = checkBacktickedPathsExist(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('.claude/agent-memory/ux/MEMORY.md:1')
  })

  it('scans workflow prompts for bare repo paths', () => {
    const root = fixture({
      '.claude/skills/stacked-pr/SKILL.md': '# skill\n',
      '.claude/workflows/w.js': [
        "const a = 'follow .claude/skills/stacked-pr/SKILL.md'",
        "const b = 'then read .claude/skills/nope/SKILL.md'",
      ].join('\n'),
    })
    expect(agentWorkflowScripts(root)).toEqual(['.claude/workflows/w.js'])
    const { failures } = checkBacktickedPathsExist(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('.claude/workflows/w.js:2')
  })
})

describe('checkReferencedScripts', () => {
  it('checks the bun scripts a workflow prompt tells a subagent to run', () => {
    const root = fixture({
      'package.json': JSON.stringify({ scripts: { test: 'x', lint: 'x' } }),
      '.claude/workflows/w.js': 'const s = \'run "bun run test" then "bun run verify"\'\n',
    })
    const { failures } = checkReferencedScripts(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('bun run verify')
  })

  it('checks the ids after `bun run check` against the tools/check.ts registry', () => {
    const root = fixture({
      'package.json': JSON.stringify({ scripts: { check: 'x' } }),
      '.claude/workflows/w.js':
        'const s = \'run "bun run check styling data" then "bun run check tokens"; `bun run check` alone\'\n',
      'CLAUDE.md':
        'Run bun run check before you push.\n\n```bash\nbun run check data   # one check\nbun run check nope\n```\n',
    })
    const { failures } = checkReferencedScripts(root)
    expect(failures).toHaveLength(2)
    expect(failures.some((f) => f.includes('`tokens` is not a check id'))).toBe(true)
    expect(failures.some((f) => f.includes('`nope` is not a check id'))).toBe(true)
  })

  it('checks hook scripts, workspace filters and unknown workspaces', () => {
    const root = fixture({
      'package.json': JSON.stringify({ scripts: { typecheck: 'x' } }),
      'apps/srd/package.json': JSON.stringify({ name: 'srd', scripts: { build: 'x' } }),
      '.claude/hooks/h.sh': 'bun run typecheck\n# `bun run check:schemas` diffs\n',
      'CLAUDE.md': 'bun --filter srd build\nbun --filter srd gate\nbun --filter nope build\n',
    })
    const failures = checkReferencedScripts(root).failures.join('\n')
    expect(failures).toContain('.claude/hooks/h.sh references `bun run check:schemas`')
    expect(failures).toContain('`bun --filter srd gate`')
    expect(failures).toContain('`bun --filter nope`')
    expect(failures).not.toContain('srd build')
  })
})

describe('checkMarkdownLinks', () => {
  it('resolves relative and root-relative links, validates anchors, and skips URLs, code and gitignored paths', () => {
    const root = fixture({
      '.gitignore': 'rules/*\n',
      'docs/adrs/ADR-025-real.md': '# real\n\n## Status\n',
      'docs/adrs/ADR-014.md': [
        'See [ADR-025](ADR-025-real.md#status) and [gone](ADR-025-versioned.md).',
        '[root](/docs/adrs/ADR-025-real.md) [web](https://example.com/x.md) [top](#context)',
        '`[code](nope.md)` and [extract](../../rules/extracted/core.txt)',
        '',
        '```md',
        '[fenced](nope.md)',
        '```',
        '',
        '[ref]: ../missing.md',
        '',
        '## Context',
      ].join('\n'),
    })
    const { failures } = checkMarkdownLinks(root, ['docs/adrs/ADR-014.md'])
    expect(failures).toHaveLength(2)
    expect(failures[0]).toContain('docs/adrs/ADR-014.md:1 links to `ADR-025-versioned.md`')
    expect(failures[1]).toContain('docs/adrs/ADR-014.md:9 links to `../missing.md`')
  })

  it('fails an anchor that is no heading in the target or the same file', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md': [
        '# Architecture',
        '## CI: reusing the PR’s run',
        '## Convex error reporting — a dashboard toggle',
        '### `@ladle/react` pin',
        '```md',
        '## Fenced is not a heading',
        '```',
        '## Notes',
        '## Notes',
        '[here](#missing) and [also](#notes-1)',
      ].join('\n'),
      'docs/README.md': [
        '[a](ARCHITECTURE.md#ci-reusing-the-prs-run) [b](ARCHITECTURE.md#convex-error-reporting--a-dashboard-toggle)',
        '[c](ARCHITECTURE.md#ladlereact-pin) [d](ARCHITECTURE.md#notes-1) [e](ARCHITECTURE.md)',
        '[f](ARCHITECTURE.md#missing) [g](ARCHITECTURE.md#fenced-is-not-a-heading)',
      ].join('\n'),
    })
    const { failures } = checkMarkdownLinks(root, ['docs/README.md', 'docs/ARCHITECTURE.md'])
    expect(failures).toEqual([
      'docs/README.md:3 links to `ARCHITECTURE.md#missing`, whose #missing is no heading in docs/ARCHITECTURE.md.',
      'docs/README.md:3 links to `ARCHITECTURE.md#fenced-is-not-a-heading`, whose #fenced-is-not-a-heading is no heading in docs/ARCHITECTURE.md.',
      'docs/ARCHITECTURE.md:10 links to `#missing`, whose #missing is no heading in docs/ARCHITECTURE.md.',
    ])
  })
})

describe('headingSlug', () => {
  it('matches the anchors GitHub renders', () => {
    expect(headingSlug('Component catalog (Ladle)')).toBe('component-catalog-ladle')
    expect(headingSlug("CI: reusing the PR's run")).toBe('ci-reusing-the-prs-run')
    expect(headingSlug('A — B')).toBe('a--b')
    expect(headingSlug('Rotating `JWT_PRIVATE_KEY` / `JWKS`')).toBe(
      'rotating-jwt_private_key--jwks'
    )
    expect(headingSlug('See [the doc](x.md) **now**')).toBe('see-the-doc-now')
  })
})

describe('checkDecisions', () => {
  const doc = (adrs: string): string => `# Architecture\n\n# Decisions\n\n${adrs}`

  it('passes ADR-001 to the floor, each one bare heading under # Decisions', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md': doc('## ADR-001\n\n**One**\n\n### Status\n\n## ADR-002\n\n**Two**\n'),
    })
    expect(checkDecisions(root, 2).failures).toEqual([])
  })

  it('fails a missing, repeated, titled or misplaced ADR, and docs/adrs/ coming back', () => {
    const root = fixture({
      'docs/adrs/ADR-005.md': '# ADR-005\n',
      'docs/ARCHITECTURE.md':
        '## ADR-001\n\n# Decisions\n\n## ADR-002: Titled\n\n## ADR-002\n\n```md\n## ADR-003\n```\n',
    })
    const failures = checkDecisions(root, 4).failures.join('\n')
    expect(failures).toContain('docs/adrs/ exists again')
    expect(failures).toContain('docs/ARCHITECTURE.md:1 is an ADR above `# Decisions`')
    expect(failures).toContain('docs/ARCHITECTURE.md:5 heads an ADR "## ADR-002: Titled"')
    expect(failures).toContain('heads `## ADR-002` 2 times')
    expect(failures).toContain('has no `## ADR-003`')
    expect(failures).toContain('has no `## ADR-004`')
  })
})

describe('checkDocSizes', () => {
  it('holds CLAUDE.md files and agents to 8,000 characters and rules to 4,000, with per-file overrides', () => {
    const root = fixture({
      'CLAUDE.md': 'x'.repeat(8_000),
      'apps/itun/CLAUDE.md': 'x'.repeat(8_001),
      'packages/ref/CLAUDE.md': 'é'.repeat(8_000),
      '.claude/rules/a.md': 'x'.repeat(4_001),
      '.claude/rules/b.md': 'x'.repeat(4_500),
      '.claude/agents/x.md': 'x'.repeat(8_001),
    })
    const failures = checkDocSizes(root, { '.claude/rules/b.md': 4_500 }, {}).failures
    expect(failures).toHaveLength(3)
    expect(failures.join('\n')).toContain('apps/itun/CLAUDE.md is 8001 characters')
    expect(failures.join('\n')).toContain('.claude/rules/a.md is 4001 characters')
    expect(failures.join('\n')).toContain('.claude/agents/x.md is 8001 characters')
    expect(checkDocSizes(root, { 'gone.md': 1 }, {}).failures.join('\n')).toContain(
      'OVER_BUDGET names gone.md'
    )
  })

  it('holds a collapsed doc to its own budget, and fails an entry whose file is gone', () => {
    const root = fixture({ 'docs/ARCHITECTURE.md': 'x'.repeat(101) })
    expect(checkDocSizes(root, {}, { 'docs/ARCHITECTURE.md': 101 }).failures).toEqual([])
    expect(checkDocSizes(root, {}, { 'docs/ARCHITECTURE.md': 100 }).failures.join('\n')).toContain(
      'docs/ARCHITECTURE.md is 101 characters, over its 100-character budget'
    )
    expect(checkDocSizes(root, {}, { 'docs/GONE.md': 1 }).failures).toEqual([
      'COLLAPSED_DOCS names docs/GONE.md, which does not exist. Remove the entry.',
    ])
  })
})

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
