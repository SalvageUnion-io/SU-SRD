/**
 * Tests for the doc-drift guard's newer checks (4–6), which judge prose rather
 * than JSON and so have real logic worth pinning: what counts as a block, what
 * counts as an acknowledged supersession, and which docs are allowed to name
 * dead things on purpose.
 *
 * Every case runs against a throwaway fixture tree, never the real repo — the
 * repo's own state is what `bun run validate:doc-drift` asserts.
 */

import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  agentWorkflowScripts,
  barrelExports,
  checkBacktickedPathsExist,
  checkComponentLibSymbolNames,
  checkFrameworkVersions,
  checkReferencedScripts,
  checkSupersededAdrCitations,
  citationReadsAsHistoryOrProposal,
  gitignoredMatcher,
  pathCandidate,
  sentenceAround,
  splitMarkdownBlocks,
  supersededAdrs,
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

const ADR_001_SUPERSEDED = `# ADR-001: Local-First

## Status

**Superseded by [ADR-030](ADR-030-accounts.md)** (accounts and a server of record).

## Context

Some context.
`

const ADR_030_GOVERNING = `# ADR-030: Accounts

## Status

**Accepted — governing ADR.** Supersedes [ADR-001](ADR-001-local-first.md).
`

const ADR_FIXTURE = {
  'docs/adrs/ADR-001-local-first.md': ADR_001_SUPERSEDED,
  'docs/adrs/ADR-030-accounts.md': ADR_030_GOVERNING,
}

describe('splitMarkdownBlocks', () => {
  it('splits on blank lines and keeps 1-indexed line numbers', () => {
    const blocks = splitMarkdownBlocks('a.md', 'first para\nstill first\n\nsecond para\n')
    expect(blocks.map((b) => [b.line, b.text])).toEqual([
      [1, 'first para\nstill first'],
      [4, 'second para'],
    ])
  })

  it('treats each list item as its own block', () => {
    const blocks = splitMarkdownBlocks('a.md', '- one\n- two\n  wrapped\n- three\n')
    expect(blocks.map((b) => b.line)).toEqual([1, 2, 4])
    expect(blocks[1]?.text).toBe('- two\n  wrapped')
  })

  it('records the heading trail above a block', () => {
    const blocks = splitMarkdownBlocks('a.md', '# Top\n\n## component-lib\n\nbody text\n')
    expect(blocks.at(-1)?.headings).toEqual(['Top', 'component-lib'])
  })

  it('drops fenced content by default and keeps it on request', () => {
    const source = 'before\n\n```\nfenced line\n```\n\nafter\n'
    expect(splitMarkdownBlocks('a.md', source).map((b) => b.text)).toEqual(['before', 'after'])
    expect(splitMarkdownBlocks('a.md', source, { includeFences: true }).map((b) => b.text)).toEqual(
      ['before', '```\nfenced line\n```', 'after']
    )
  })
})

describe('supersededAdrs', () => {
  it('reads the superseded set out of each ADR Status block', () => {
    expect([...supersededAdrs(fixture(ADR_FIXTURE))]).toEqual([['ADR-001', 'ADR-030']])
  })

  it('reads a Status block that is the last section in the file', () => {
    const root = fixture({
      'docs/adrs/ADR-001-local-first.md':
        '# ADR-001\n\n## Status\n\nSuperseded by [ADR-030](ADR-030-accounts.md).\n',
    })
    expect([...supersededAdrs(root)]).toEqual([['ADR-001', 'ADR-030']])
  })

  it('does not mistake "supersedes" for "superseded by"', () => {
    const root = fixture({
      'docs/adrs/ADR-014-json-api.md': '# ADR-014\n\n## Status\n\nAccepted.\n',
      'docs/adrs/ADR-025-releases.md':
        '# ADR-025\n\n## Status\n\nAccepted. **Partially supersedes [ADR-014](ADR-014-json-api.md)**.\n',
    })
    expect(supersededAdrs(root).size).toBe(0)
  })
})

describe('checkSupersededAdrCitations', () => {
  it('fails when a live-instruction doc cites a superseded ADR bare', () => {
    const root = fixture({
      ...ADR_FIXTURE,
      'docs/architecture/combat-loop.md':
        '# Combat Loop\n\nIt is local-first ([ADR-001](../adrs/ADR-001-local-first.md)).\n',
    })
    const { failures } = checkSupersededAdrCitations(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('docs/architecture/combat-loop.md:3')
    expect(failures[0]).toContain('Superseded by ADR-030')
  })

  it('passes when the same block acknowledges the supersession', () => {
    const root = fixture({
      ...ADR_FIXTURE,
      'CLAUDE.md': 'Two storage modes ([ADR-030], which supersedes ADR-001).\n',
    })
    expect(checkSupersededAdrCitations(root).failures).toEqual([])
  })

  it('passes when the block names the superseding ADR without the word', () => {
    const root = fixture({
      ...ADR_FIXTURE,
      'CLAUDE.md': 'ADR-001 was replaced wholesale by ADR-030 in the accounts work.\n',
    })
    expect(checkSupersededAdrCitations(root).failures).toEqual([])
  })

  it('ignores link-reference definitions, which are targets and not claims', () => {
    const root = fixture({
      ...ADR_FIXTURE,
      'docs/architecture/dashboard.md':
        '# Dashboard\n\nSome prose.\n\n[adr-001]: ../adrs/ADR-001-local-first.md\n',
    })
    expect(checkSupersededAdrCitations(root).failures).toEqual([])
  })

  it('leaves bannered historical docs alone', () => {
    const root = fixture({
      ...ADR_FIXTURE,
      'docs/architecture/dashboard-display-completion-plan.md':
        '# Plan\n\nBuilt against [ADR-001](../adrs/ADR-001-local-first.md).\n',
    })
    expect(checkSupersededAdrCitations(root).failures).toEqual([])
  })

  it('fails loudly when there are no ADRs to parse', () => {
    const { failures } = checkSupersededAdrCitations(fixture({ 'CLAUDE.md': '# Root\n' }))
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('Found no docs/adrs/ADR-NNN-*.md files')
  })
})

const COMPONENT_LIB_FIXTURE = {
  'packages/component-lib/src/index.ts': [
    '// Shared components',
    "export { Card } from './components/shared/Card'",
    "export { FilterRow as FilterRow } from './components/shared/FilterRow'",
    "export type { CardFootMeta } from './components/shared/Card'",
    "export const cn = () => ''",
  ].join('\n'),
  'packages/component-lib/src/components/shared/Card.tsx': 'export const Card = () => null\n',
  'packages/component-lib/src/components/shared/EntityTooltip.tsx':
    'export const EntityTooltip = () => null\n',
  'packages/salvageunion-reference/lib/index.ts':
    "export { SalvageUnionReference } from './reference'\n",
}

describe('checkComponentLibSymbolNames', () => {
  it('fails on a symbol that is neither a barrel export nor a source file', () => {
    const root = fixture({
      ...COMPONENT_LIB_FIXTURE,
      'CLAUDE.md': 'The component-lib barrel ships `Card` and `FilterChip`.\n',
    })
    const { failures } = checkComponentLibSymbolNames(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('CLAUDE.md:1')
    expect(failures[0]).toContain('`FilterChip`')
  })

  it('accepts a barrel export and an unexported-but-real source file', () => {
    const root = fixture({
      ...COMPONENT_LIB_FIXTURE,
      'CLAUDE.md': 'In component-lib, `FilterRow` is public and `EntityTooltip` is internal.\n',
    })
    expect(checkComponentLibSymbolNames(root).failures).toEqual([])
  })

  it('attributes symbols by heading when the block itself is silent', () => {
    const root = fixture({
      ...COMPONENT_LIB_FIXTURE,
      'docs/architecture/package-contracts.md': '## component-lib\n\n- `Card`, `FilterChip`\n',
    })
    const { failures } = checkComponentLibSymbolNames(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('`FilterChip`')
  })

  it('leaves a block that is explicitly naming dead things alone', () => {
    const root = fixture({
      ...COMPONENT_LIB_FIXTURE,
      '.claude/rules/display-system.md':
        'An earlier component-lib revision documented `StatsBar`, which was deleted.\n',
    })
    expect(checkComponentLibSymbolNames(root).failures).toEqual([])
  })

  it('does not claim a sibling package export for component-lib', () => {
    const root = fixture({
      ...COMPONENT_LIB_FIXTURE,
      'docs/architecture/package-contracts.md':
        'All consumers (`component-lib`, `srd`) touching `SalvageUnionReference` must preload.\n',
    })
    expect(checkComponentLibSymbolNames(root).failures).toEqual([])
  })

  it('ignores blocks that never mention component-lib', () => {
    const root = fixture({
      ...COMPONENT_LIB_FIXTURE,
      'CLAUDE.md': 'The ITUN app renders `GameRoster` from its own tree.\n',
    })
    expect(checkComponentLibSymbolNames(root).failures).toEqual([])
  })

  it('ignores acronyms, single letters and SCREAMING_CASE', () => {
    const root = fixture({
      ...COMPONENT_LIB_FIXTURE,
      'CLAUDE.md': 'component-lib exposes `UI` helpers, a `T` generic and `TECH_LEVEL_STYLES`.\n',
    })
    expect(checkComponentLibSymbolNames(root).failures).toEqual([])
  })
})

describe('barrelExports', () => {
  it('reads braced re-exports, aliases and declarations, skipping comments', () => {
    const root = fixture(COMPONENT_LIB_FIXTURE)
    const names = barrelExports(root, 'packages/component-lib/src/index.ts')
    expect([...names].sort()).toEqual(['Card', 'CardFootMeta', 'FilterRow', 'cn'])
  })
})

// These exercised Astro as the srd-anchored framework until srd moved off it.
// The logic under test is unchanged — only the framework the fixtures name.
// srd's tracked major is now Vite's, per FRAMEWORKS in check-doc-drift.ts.
const MANIFEST_FIXTURE = {
  'package.json': JSON.stringify({ devDependencies: { tailwindcss: '4.3.3' } }),
  'apps/srd/package.json': JSON.stringify({ devDependencies: { vite: '^8.1.5' } }),
  'apps/itun/package.json': JSON.stringify({ dependencies: { react: '19.2.0' } }),
}

describe('checkFrameworkVersions', () => {
  it('fails when a doc names a major the manifest disagrees with', () => {
    const root = fixture({
      ...MANIFEST_FIXTURE,
      'apps/srd/README.md': 'Static SRD site. Vite 6 + React 19 islands, Tailwind v4.\n',
    })
    const { failures } = checkFrameworkVersions(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('apps/srd/README.md:1')
    expect(failures[0]).toContain('says "Vite 6"')
    expect(failures[0]).toContain('vite 8.x')
  })

  it('accepts the current major, including a dotted one', () => {
    const root = fixture({
      ...MANIFEST_FIXTURE,
      'CLAUDE.md': 'Vite 8 with React 19.2.0+ islands and Tailwind CSS v4.\n',
    })
    expect(checkFrameworkVersions(root).failures).toEqual([])
  })

  it('allows an old major that is contextualised by the current one', () => {
    const root = fixture({
      ...MANIFEST_FIXTURE,
      'docs/adrs/ADR-031-srd-vite.md':
        '# ADR-031\n\n> `srd` was on **Vite 6** when this was written;\n> it runs **Vite 8** today.\n',
    })
    expect(checkFrameworkVersions(root).failures).toEqual([])
  })

  it('reads versions stated inside ASCII diagrams', () => {
    const root = fixture({
      ...MANIFEST_FIXTURE,
      'README.md': '# Repo\n\n```\n+--- srd (static site, Vite 6)\n```\n',
    })
    const { failures } = checkFrameworkVersions(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('README.md:4')
  })

  it('fails loudly when the manifest no longer installs the framework', () => {
    const root = fixture({ 'package.json': '{}', 'apps/srd/package.json': '{}' })
    const { failures } = checkFrameworkVersions(root)
    expect(failures.some((f) => f.includes('Could not read the installed "vite" version'))).toBe(
      true
    )
  })
})

describe('pathCandidate', () => {
  it('judges repo-rooted and workspace-relative paths', () => {
    expect(pathCandidate('.claude/skills/srd-gate/SKILL.md')).toBe(
      '.claude/skills/srd-gate/SKILL.md'
    )
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
      'Three tools read `netlify.toml` (since deleted) at the time',
      'the method-conditioned redirect in the since-deleted `netlify.toml` never matched',
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

  it('does not let a negation in a NEIGHBOURING sentence excuse a stale path', () => {
    const root = fixture({
      'docs/architecture/x.md':
        'Netlify is not a host any more. Deploys run from `.github/workflows/deploy.yml`.\n',
    })
    expect(checkBacktickedPathsExist(root).failures).toHaveLength(1)
  })

  it('allows a path marked as history beside it, but not by its section heading alone', () => {
    const root = fixture({
      'docs/architecture/x.md':
        '`tools/sync.ts` was deleted after P6.\n\n## Netlify — retired\n\nSee `apps/srd/netlify.toml`.\n',
    })
    const { failures } = checkBacktickedPathsExist(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('`apps/srd/netlify.toml`')
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
