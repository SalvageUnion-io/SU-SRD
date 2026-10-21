/**
 * The checks `tools/check-doc-drift.ts` runs, by id: what each asks, and the
 * fix its failures print. `bun run check doc-drift` runs them all;
 * `bun tools/check-doc-drift.ts --only=<id>[,<id>]` reruns some.
 */

const DOC_DRIFT_CHECKS = {
  paths: {
    asks: 'every backticked repo path in a live-instruction doc or a Claude hook exists, unless the words beside it mark it history or a proposal',
    fix: 'fix the path, or mark a deliberately historical one beside it ("`x.ts` (since deleted)")',
  },
  scripts: {
    asks: 'every `bun run <script>`, `bun --filter <ws> <script>` and `bun run check <id>` in those docs or a hook is real',
    fix: 'fix the command, or add the script to the package.json it names',
  },
  fixes: {
    asks: 'every path and bun command in a `tools/check.ts` fix hint exists',
    fix: 'fix the path or command in that tools/check.ts fix hint',
  },
  claims: {
    asks: 'no agent doc (the ADR entries excepted) repeats a claim the repo has retired (`RETIRED_CLAIMS`)',
    fix: 'state the current design instead of the retired claim',
  },
  links: {
    asks: 'every relative markdown link in a tracked `.md` file resolves, its `#fragment` to a heading or `<a id>` anchor',
    fix: 'fix the link or its #fragment',
  },
  areas: {
    asks: 'every `## Areas` entry carries one `<a id="slug"></a>`, and every tracked file cites an Area by that slug, never by number',
    fix: 'cite an Area as ARCHITECTURE.md#<its anchor>; end a new Area\'s headline with <a id="slug"></a>',
  },
  decisions: {
    asks: 'every ADR is entry N under `## Decisions` in docs/ARCHITECTURE.md (`N. **ADR-NNN Title**`) or named on its one `Retired …:` line, once; an entry that amends, supersedes or reverses another is named in that one; a kept full text is `docs/adr/NNN-slug.md`, opening on `# ADR-NNN: Title`, no front-matter, linked from entry N',
    fix: "keep entry N of ## Decisions as ADR-N, link its docs/adr/NNN-slug.md full text (no front-matter; the status lives in the entry) from its headline, and name the amending ADR in the amended one's entry",
  },
  shape: {
    asks: 'a terse doc (`TERSE_DOCS`) is numbered entries: a bold headline, then at most two lines',
    fix: 'cut the entry to a headline plus at most two lines',
  },
  size: {
    asks: 'CLAUDE.md files (with their `@path` imports) stay under 8,000 characters and `.claude/rules/*.md` under 4,000; `COLLAPSED_DOCS` hold their own budgets',
    fix: 'cut the doc to its size budget: no rosters, no history',
  },
  load: {
    asks: 'each session profile (`SESSION_PROFILES`) totals what it loads, held to a ratchet (`SESSION_CEILINGS`)',
    fix: "cut what the session loads, or scope a rule's paths: tighter; lower a ceiling when the check says to",
  },
  history: {
    asks: "no comment in tracked code under apps/, packages/ or tools/ narrates history (`gates/lib/commentHistory`'s phrases, at zero)",
    fix: 'rewrite the comment as what is true now (packages/gates/lib/commentHistory.ts lists the phrases)',
  },
} as const

export type DocDriftCheckId = keyof typeof DOC_DRIFT_CHECKS

/** The ids `--only=a,b` names among `checks`, or undefined without the flag; throws on one it does not know. */
export function onlyIds(
  argv: readonly string[],
  checks: readonly { id: string }[]
): string[] | undefined {
  const ids = checks.map((c) => c.id)
  const only = argv
    .find((a) => a.startsWith('--only='))
    ?.slice('--only='.length)
    .split(',')
  const unknown = only?.filter((id) => !ids.includes(id)) ?? []
  if (unknown.length > 0)
    throw new Error(`unknown doc-drift check ${unknown.join(', ')}: one of ${ids.join(', ')}`)
  return only
}

/** What a failing check prints after its failures: its fix, and how to rerun it alone. */
export function fixLines(id: string): string[] {
  const fix = (DOC_DRIFT_CHECKS as Record<string, { fix: string }>)[id]?.fix
  return [
    ...(fix ? [`  fix (${id}): ${fix}`] : []),
    `  rerun: bun tools/check-doc-drift.ts --only=${id}`,
  ]
}
