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
  barrelExports,
  checkComponentLibSymbolNames,
  checkFrameworkVersions,
  checkSupersededAdrCitations,
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

const MANIFEST_FIXTURE = {
  'package.json': JSON.stringify({ devDependencies: { tailwindcss: '4.3.3' } }),
  'apps/srd/package.json': JSON.stringify({ dependencies: { astro: '^7.1.4' } }),
  'apps/itun/package.json': JSON.stringify({ dependencies: { react: '19.2.0' } }),
}

describe('checkFrameworkVersions', () => {
  it('fails when a doc names a major the manifest disagrees with', () => {
    const root = fixture({
      ...MANIFEST_FIXTURE,
      'apps/srd/README.md': 'Static SRD site. Astro 5 + React 19 islands, Tailwind v4.\n',
    })
    const { failures } = checkFrameworkVersions(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('apps/srd/README.md:1')
    expect(failures[0]).toContain('says "Astro 5"')
    expect(failures[0]).toContain('astro 7.x')
  })

  it('accepts the current major, including a dotted one', () => {
    const root = fixture({
      ...MANIFEST_FIXTURE,
      'CLAUDE.md': 'Astro 7 with React 19.2.0+ islands and Tailwind CSS v4.\n',
    })
    expect(checkFrameworkVersions(root).failures).toEqual([])
  })

  it('allows an old major that is contextualised by the current one', () => {
    const root = fixture({
      ...MANIFEST_FIXTURE,
      'docs/adrs/ADR-012-astro.md':
        '# ADR-012\n\n> `srd` was on **Astro 5** when this was written;\n> it runs **Astro 7** today.\n',
    })
    expect(checkFrameworkVersions(root).failures).toEqual([])
  })

  it('reads versions stated inside ASCII diagrams', () => {
    const root = fixture({
      ...MANIFEST_FIXTURE,
      'README.md': '# Repo\n\n```\n+--- srd (static site, Astro 5)\n```\n',
    })
    const { failures } = checkFrameworkVersions(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('README.md:4')
  })

  it('fails loudly when the manifest no longer installs the framework', () => {
    const root = fixture({ 'package.json': '{}', 'apps/srd/package.json': '{}' })
    const { failures } = checkFrameworkVersions(root)
    expect(failures.some((f) => f.includes('Could not read the installed "astro" version'))).toBe(
      true
    )
  })
})
