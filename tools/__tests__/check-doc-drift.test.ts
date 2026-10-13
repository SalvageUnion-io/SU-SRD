/**
 * Tests for `tools/check-doc-drift.ts`. Every case runs against a throwaway
 * fixture tree; the repo's own state is what `bun run check doc-drift` asserts.
 */

import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  checkAreaCitations,
  checkBacktickedPathsExist,
  checkDecisions,
  checkDocSizes,
  checkFixHints,
  checkMarkdownLinks,
  checkReferencedScripts,
  checkRetiredClaims,
  checkTerseShape,
  citationReadsAsHistoryOrProposal,
  headingSlug,
  pathCandidate,
  sentenceBounds,
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

const sentenceAround = (text: string, index: number): string =>
  text.slice(...sentenceBounds(text, index))

describe('sentenceBounds', () => {
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

  it('scans the ADR entries as live text, paths and scripts alike', () => {
    const root = fixture({
      'package.json': JSON.stringify({ scripts: {} }),
      'docs/ARCHITECTURE.md': [
        '## Decisions',
        '',
        '1. **ADR-001 Old host**',
        '   Superseded. Its `apps/itun/old-host/` was removed.',
        '2. **ADR-002 New host**',
        '   Accepted: `bun run new-host` over `apps/itun/src/host.ts`.',
      ].join('\n'),
    })
    const paths = checkBacktickedPathsExist(root).failures.join('\n')
    expect(paths).toContain('docs/ARCHITECTURE.md:6 cites `apps/itun/src/host.ts`')
    expect(paths).not.toContain('old-host')
    const scripts = checkReferencedScripts(root).failures
    expect(scripts).toHaveLength(1)
    expect(scripts[0]).toContain('`bun run new-host`')
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

  it('scans skills as live-instruction docs', () => {
    const root = fixture({
      '.claude/skills/ux/SKILL.md': 'Tokens live in `packages/ui/theme.css`.\n',
    })
    const { failures } = checkBacktickedPathsExist(root)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('.claude/skills/ux/SKILL.md:1')
  })
})

describe('checkRetiredClaims', () => {
  it('fails an agent doc that repeats a retired claim, and leaves the ADRs their history', () => {
    const root = fixture({
      '.claude/rules/x.md': 'Signed out, writes go to the in-memory backend.\n',
      '.claude/hooks/h.sh': '# formats with prettier\n',
      '.env.example': '# unset = in-memory only\n',
      'CLAUDE.md': 'Commit with /ship.\n',
      'docs/ARCHITECTURE.md':
        '# Architecture\n\n## Decisions\n\n1. **ADR-001 Local-first, no backend**\n   Superseded.\n',
    })
    const failures = checkRetiredClaims(root).failures.join('\n')
    expect(failures).toContain('.claude/rules/x.md:1 matches /in-memory (?:backend|only)/i')
    expect(failures).toContain('.claude/hooks/h.sh:1 matches /prettier/i')
    expect(failures).toContain('.env.example:1 matches /in-memory (?:backend|only)/i')
    expect(failures).toContain('CLAUDE.md:1 matches /\\/ship\\b/')
    expect(failures).not.toContain('ARCHITECTURE')
  })

  it('fails each claim the account-gated, Convex-only design retired', () => {
    const root = fixture({
      '.claude/rules/a.md': 'Anonymous play stays first-class.\n',
      '.claude/rules/b.md': 'Signing in is optional: first-class for *building*.\n',
      '.claude/rules/c.md': 'Signed out, in-memory work is lost on reload.\n',
      '.claude/rules/d.md': 'A Solo build has no Convex URL.\n',
      '.claude/rules/e.md': 'Guard on isConvexConfigured().\n',
      '.claude/rules/f.md': 'Reads are salvage-tolerant.\n',
      'docs/ARCHITECTURE.md':
        '# Architecture\n\n## Decisions\n\n1. **ADR-001 Old**\n   Superseded: anonymous play stayed first-class.\n',
    })
    const failures = checkRetiredClaims(root).failures
    for (const doc of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect(failures.some((f) => f.startsWith(`.claude/rules/${doc}.md:1 matches`))).toBe(true)
    }
    expect(failures.join('\n')).not.toContain('ARCHITECTURE')
  })

  it('passes a doc that states the current design', () => {
    const root = fixture({
      'CLAUDE.md':
        'Signed out, ITUN is read-only. Use `bun run test`.\n' +
        'The bot is a first-class authenticated client.\n',
    })
    expect(checkRetiredClaims(root).failures).toEqual([])
  })
})

describe('checkBacktickedPathsExist on hook scripts', () => {
  it('judges a path a hook comment or message cites, at its line', () => {
    const root = fixture({
      'tools/real.ts': '',
      '.claude/hooks/h.sh': [
        '#!/bin/bash',
        '# The guard is `tools/real.ts`; the fixer is',
        '# `tools/gone.ts`, which runs first.',
        'echo "see `tools/also-gone.ts`"',
        '#',
        '# `tools/old.ts` (since deleted) used to do this.',
      ].join('\n'),
    })
    const failures = checkBacktickedPathsExist(root).failures
    expect(failures).toHaveLength(2)
    expect(failures[0]).toContain('.claude/hooks/h.sh:3 cites `tools/gone.ts`')
    expect(failures[1]).toContain('.claude/hooks/h.sh:4 cites `tools/also-gone.ts`')
  })
})

describe('checkFixHints', () => {
  it('judges every repo path and bun command a fix hint names', () => {
    const root = fixture({
      'package.json': JSON.stringify({ scripts: { check: 'x', format: 'x' } }),
      'apps/srd/package.json': JSON.stringify({ name: 'srd', scripts: { test: 'x' } }),
      'tools/check-real.ts': '',
      'docs/ARCHITECTURE.md': '## Dead code\n',
    })
    const hints = [
      {
        id: 'ok',
        fix: '`bun run format`; see docs/ARCHITECTURE.md#dead-code and tools/check-real.ts',
      },
      {
        id: 'template',
        fix: 'link a docs/adr/NNN-slug.md full text; `bun --filter <workspace> test`',
      },
      { id: 'stale', fix: '`bun tools/check-gone.ts --update`, then `bun run lint`' },
      { id: 'filter', fix: '`bun --filter srd gate`; `bun run check nope`' },
    ]
    const failures = checkFixHints(root, hints).failures
    expect(failures).toHaveLength(4)
    const text = failures.join('\n')
    expect(text).toContain('fix hint for `stale` names tools/check-gone.ts')
    expect(text).toContain('fix hint for `stale` references `bun run lint`')
    expect(text).toContain('`bun --filter srd gate`')
    expect(text).toContain('`nope` is not a check id')
    expect(text).not.toContain('`ok`')
    expect(text).not.toContain('`template`')
  })

  it('passes on the real registry', () => {
    expect(checkFixHints(join(import.meta.dir, '..', '..')).failures).toEqual([])
  })
})

describe('checkReferencedScripts', () => {
  it('checks the ids after `bun run check` against the tools/check.ts registry', () => {
    const root = fixture({
      'package.json': JSON.stringify({ scripts: { check: 'x' } }),
      '.claude/hooks/h.sh':
        "echo \"run 'bun run check styling data' then 'bun run check tokens'; `bun run check` alone\"\n",
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

  it('fails an anchor that is no heading or <a id> in the target or the same file', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md': [
        '# Architecture',
        '## CI: reusing the PR’s run',
        '## Convex error reporting — a dashboard toggle',
        '### `@vitejs/plugin-react` pin',
        '```md',
        '## Fenced is not a heading',
        '```',
        '## Notes',
        '## Notes',
        '[here](#missing) and [also](#notes-1)',
        '1. **CI** <a id="ci"></a> `<a id="in-code"></a>`',
      ].join('\n'),
      'docs/README.md': [
        '[a](ARCHITECTURE.md#ci-reusing-the-prs-run) [b](ARCHITECTURE.md#convex-error-reporting--a-dashboard-toggle)',
        '[c](ARCHITECTURE.md#vitejsplugin-react-pin) [d](ARCHITECTURE.md#notes-1) [e](ARCHITECTURE.md)',
        '[f](ARCHITECTURE.md#missing) [g](ARCHITECTURE.md#fenced-is-not-a-heading)',
        '[h](ARCHITECTURE.md#ci) [i](ARCHITECTURE.md#in-code)',
      ].join('\n'),
    })
    const { failures } = checkMarkdownLinks(root, ['docs/README.md', 'docs/ARCHITECTURE.md'])
    expect(failures).toEqual([
      'docs/README.md:3 links to `ARCHITECTURE.md#missing`, whose #missing is no heading or anchor in docs/ARCHITECTURE.md.',
      'docs/README.md:3 links to `ARCHITECTURE.md#fenced-is-not-a-heading`, whose #fenced-is-not-a-heading is no heading or anchor in docs/ARCHITECTURE.md.',
      'docs/README.md:4 links to `ARCHITECTURE.md#in-code`, whose #in-code is no heading or anchor in docs/ARCHITECTURE.md.',
      'docs/ARCHITECTURE.md:10 links to `#missing`, whose #missing is no heading or anchor in docs/ARCHITECTURE.md.',
    ])
  })
})

describe('checkAreaCitations', () => {
  const doc = (areas: string): string =>
    ['# Architecture', '', '## Areas', '', areas, '## Decisions', ''].join('\n')

  it('passes anchored Areas cited by slug, and the section headings', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md': doc(
        '1. **CI** <a id="ci"></a>\n   Runs.\n2. **Repository settings** <a id="repo-settings"></a>\n   Pinned.\n'
      ),
      'ci.yml': '# why: docs/ARCHITECTURE.md#ci and ARCHITECTURE.md#repo-settings.\n',
      'docs/README.md': '[CI](ARCHITECTURE.md#ci); [ADRs](ARCHITECTURE.md#decisions).\n',
    })
    const result = checkAreaCitations(root, ['ci.yml', 'docs/README.md'])
    expect(result.failures).toEqual([])
    expect(result.ok).toContain('2 Areas anchored; 4 ARCHITECTURE.md# citations in 2 files')
  })

  it('fails an Area with no anchor, a repeated or malformed one', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md': doc(
        [
          '1. **CI** <a id="ci"></a>',
          '2. **Deploy**',
          '3. **Previews** <a id="ci"></a>',
          '4. **Sentry** <a id="Sentry"></a>',
          '',
        ].join('\n')
      ),
    })
    expect(checkAreaCitations(root, []).failures).toEqual([
      'docs/ARCHITECTURE.md:6 is an Area with no anchor. End its headline line with ` <a id="slug"></a>` (lowercase, hyphenated).',
      'docs/ARCHITECTURE.md:7 repeats the anchor #ci. Give each Area its own.',
      'docs/ARCHITECTURE.md:8 is an Area with no anchor. End its headline line with ` <a id="slug"></a>` (lowercase, hyphenated).',
    ])
  })

  it('fails an Area cited by number, by title, by the whole section, or by a slug that does not exist', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md': doc('1. **CI** <a id="ci"></a>\n'),
      'docs/README.md': 'Combat: Areas 17\u201320; settings: Area 9.\n[x](ARCHITECTURE.md#areas)\n',
      'tools/x.ts':
        '// see docs/ARCHITECTURE.md#ci-runs.\n// docs/ARCHITECTURE.md ("CI gate"); ARCHITECTURE.md § CI\n',
    })
    expect(checkAreaCitations(root, ['docs/README.md', 'tools/x.ts']).failures).toEqual([
      'docs/README.md:1 cites "Areas 17" by number, which shifts when an Area is inserted. Cite its anchor: `ARCHITECTURE.md#slug`.',
      'docs/README.md:1 cites "Area 9" by number, which shifts when an Area is inserted. Cite its anchor: `ARCHITECTURE.md#slug`.',
      "docs/README.md:2 cites ARCHITECTURE.md#areas, the whole section. Cite the Area's own anchor.",
      'tools/x.ts:1 cites ARCHITECTURE.md#ci-runs, which is no heading or anchor in docs/ARCHITECTURE.md.',
      'tools/x.ts:2 cites ARCHITECTURE.md by a section title (` ("`), which nothing resolves. Cite its anchor: `ARCHITECTURE.md#slug`.',
      'tools/x.ts:2 cites ARCHITECTURE.md by a section title (` §`), which nothing resolves. Cite its anchor: `ARCHITECTURE.md#slug`.',
    ])
  })

  it('fails a doc with no Areas', () => {
    const root = fixture({ 'docs/ARCHITECTURE.md': doc('') })
    expect(checkAreaCitations(root, []).failures).toEqual([
      'docs/ARCHITECTURE.md has no numbered entries under `## Areas`.',
    ])
  })
})

describe('headingSlug', () => {
  it('matches the anchors GitHub renders', () => {
    expect(headingSlug('Combat loop (ITUN)')).toBe('combat-loop-itun')
    expect(headingSlug("CI: reusing the PR's run")).toBe('ci-reusing-the-prs-run')
    expect(headingSlug('A — B')).toBe('a--b')
    expect(headingSlug('Rotating `JWT_PRIVATE_KEY` / `JWKS`')).toBe(
      'rotating-jwt_private_key--jwks'
    )
    expect(headingSlug('See [the doc](x.md) **now**')).toBe('see-the-doc-now')
  })
})

describe('checkDecisions', () => {
  const doc = (entries: string): string => `# Architecture\n\n## Decisions\n\n${entries}`
  const entry = (n: number, text: string): string =>
    `${n}. **ADR-${String(n).padStart(3, '0')} Title**\n   ${text}\n`

  it('passes ADR-001 to the floor, entry N naming ADR-N under ## Decisions', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md': doc(entry(1, 'Accepted.') + entry(2, 'Accepted.')),
    })
    expect(checkDecisions(root, 2).failures).toEqual([])
  })

  it('fails a missing, repeated, misnumbered, misplaced or headed ADR', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md': [
        '## Areas',
        '',
        '1. **ADR-001 Misplaced**',
        '',
        '## Decisions',
        '',
        '2. **ADR-002 Two**',
        '2. **ADR-002 Again**',
        '4. **ADR-003 Misnumbered**',
        '',
        '## ADR-006',
        '',
        '```md',
        '7. **ADR-007 Fenced**',
        '```',
      ].join('\n'),
    })
    const failures = checkDecisions(root, 4).failures.join('\n')
    expect(failures).toContain('docs/ARCHITECTURE.md:3 is an ADR entry outside `## Decisions`')
    expect(failures).toContain('lists ADR-002 2 times')
    expect(failures).toContain('docs/ARCHITECTURE.md:9 numbers ADR-003 as entry 4')
    expect(failures).toContain('has no ADR-004 entry')
    expect(failures).toContain('docs/ARCHITECTURE.md:11 heads an ADR')
    expect(failures).not.toContain('ADR-007')
  })

  it('fails an amendment the amended entry does not name', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md': doc(
        entry(1, 'Accepted; amended by ADR-003.') +
          entry(2, 'Accepted.') +
          entry(3, 'Accepted. Amends ADR-001; supersedes ADR-002.')
      ),
    })
    expect(checkDecisions(root, 3).failures).toEqual([
      "docs/ARCHITECTURE.md: ADR-003 supersedes ADR-002, but ADR-002's entry does not name " +
        'ADR-003. Add "amended by ADR-003" there.',
    ])
  })
  it('passes a full-text ADR file linked from its entry', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md': doc(
        `1. **ADR-001 Title** · [full text](adr/001-one.md)\n   Accepted.\n${entry(2, 'Accepted.')}`
      ),
      'docs/adr/001-one.md': '---\nstatus: accepted\n---\n\n# ADR-001: One\n\nBody.\n',
    })
    expect(checkDecisions(root, 2).failures).toEqual([])
  })

  it('fails an ADR file that is misnamed, unlinked, orphaned, repeated or malformed', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md': doc(entry(1, 'Accepted.') + entry(2, 'Accepted.')),
      'docs/adr/001-one.md': '---\nstatus: accepted\n---\n\n# ADR-001: One\n',
      'docs/adr/002-two.md': '---\nstatus: superseded\n---\n\n# ADR-003: Wrong\n',
      'docs/adr/002-again.md': '# ADR-002: No front-matter\n',
      'docs/adr/009-orphan.md': '---\nstatus: accepted\n---\n\n# ADR-009: Orphan\n',
      'docs/adr/ADR-004.md': '# ADR-004\n',
    })
    const failures = checkDecisions(root, 2).failures.join('\n')
    expect(failures).toContain('docs/adr/ADR-004.md is not an ADR file')
    expect(failures).toContain(
      'docs/ARCHITECTURE.md:5 is ADR-001, whose full text is docs/adr/001-one.md'
    )
    expect(failures).toContain(
      'ADR-002 has two files, docs/adr/002-again.md and docs/adr/002-two.md'
    )
    expect(failures).toContain('docs/adr/002-two.md needs front-matter')
    expect(failures).toContain('docs/adr/002-again.md needs front-matter')
    expect(failures).toContain('docs/adr/002-two.md opens on "# ADR-003: Wrong"')
    expect(failures).toContain('docs/adr/009-orphan.md has no ADR-009 entry')
  })
})

describe('checkTerseShape', () => {
  it('passes headline entries of at most two indented lines', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md':
        '# A\n\nIntro.\n\n## Areas\n\n1. **One**\n   a\n   b\n10. **Ten**\n    c\n',
    })
    expect(checkTerseShape(root, ['docs/ARCHITECTURE.md']).failures).toEqual([])
  })

  it('fails a long entry, prose between entries, and a missing doc', () => {
    const root = fixture({
      'docs/ARCHITECTURE.md':
        '## Areas\n\n1. **One**\n   a\n   b\n   c\n2. **Two**\n\nA paragraph.\n',
    })
    const failures = checkTerseShape(root, ['docs/ARCHITECTURE.md', 'docs/GONE.md']).failures
    expect(failures).toEqual([
      'docs/ARCHITECTURE.md:3 runs 3 lines under its headline; the limit is 2. Cut it: history is in git.',
      'docs/ARCHITECTURE.md:9 is prose between entries. Fold it into an entry or cut it.',
      'TERSE_DOCS names docs/GONE.md, which does not exist. Remove the entry.',
    ])
  })
})

describe('checkDocSizes', () => {
  it('holds CLAUDE.md files to 8,000 characters and rules to 4,000, with per-file overrides', () => {
    const root = fixture({
      'CLAUDE.md': 'x'.repeat(8_000),
      'apps/itun/CLAUDE.md': 'x'.repeat(8_001),
      'packages/ref/CLAUDE.md': 'é'.repeat(8_000),
      '.claude/rules/a.md': 'x'.repeat(4_001),
      '.claude/rules/b.md': 'x'.repeat(4_500),
    })
    const failures = checkDocSizes(root, { '.claude/rules/b.md': 4_500 }, {}).failures
    expect(failures).toHaveLength(2)
    expect(failures.join('\n')).toContain('apps/itun/CLAUDE.md is 8001 characters')
    expect(failures.join('\n')).toContain('.claude/rules/a.md is 4001 characters')
    expect(checkDocSizes(root, { 'gone.md': 1 }, {}).failures.join('\n')).toContain(
      'OVER_BUDGET names gone.md'
    )
  })

  it('counts the files a CLAUDE.md imports by an @path line against its budget', () => {
    const root = fixture({
      'CLAUDE.md': '# CLAUDE.md\n\n@AGENTS.md\n',
      'AGENTS.md': 'x'.repeat(8_000),
      'apps/itun/CLAUDE.md': '@../../GONE.md\n',
    })
    const failures = checkDocSizes(root, {}, {}).failures.join('\n')
    expect(failures).toContain('CLAUDE.md with AGENTS.md is 8024 characters')
    expect(failures).toContain('apps/itun/CLAUDE.md imports @GONE.md, which does not exist.')
    expect(checkDocSizes(root, { 'CLAUDE.md': 8_024 }, {}).failures).toEqual([
      'apps/itun/CLAUDE.md imports @GONE.md, which does not exist.',
    ])
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
