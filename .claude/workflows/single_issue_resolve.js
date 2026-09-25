export const meta = {
  name: 'single_issue_resolve',
  description:
    'Resolve one piece of ITUN feedback in an isolated git worktree off fresh main, open a PR, and post a review comment with an explicit approval status',
  phases: [
    {
      title: 'Implement',
      detail: 'fresh worktree off origin/main → fix → validate → push → open PR',
    },
    {
      title: 'Review',
      detail: 'independently review the PR diff and post an approval-status comment',
    },
  ],
}

// ── args contract ────────────────────────────────────────────────────────────
//   string  → raw feedback text (this workflow infers the UX area + rules itself)
//   object  → a triage record from batch_issue_response:
//             { title, summary, uxArea, files?, rules?, approach?, inScope?, source?, baseBranch?,
//               stackDepth? }
//             baseBranch: if set (and not "main"), this PR is STACKED on that branch — the new branch
//             is cut from origin/<baseBranch> and the PR opened with --base <baseBranch>, so a chain of
//             dependent items lands as a stack rather than as conflicting independent diffs off main.
//             stackDepth: how many PRs the whole stack holds; at 3+ the PR names `gh stack` as its
//             recovery procedure instead of a manual `rebase --onto` (the /stacked-pr threshold).
const input = args
const triage =
  typeof input === 'string'
    ? {
        title: input.slice(0, 60),
        summary: input,
        uxArea: '(identify it yourself)',
        rules: [],
        approach: '',
      }
    : input || {}

if (!triage.summary && !triage.title) {
  throw new Error('single_issue_resolve requires feedback text or a triage object as args')
}

// Base branch for this PR: "main" normally, or the previous item's branch when stacking.
const baseBranch = (triage.baseBranch && String(triage.baseBranch)) || 'main'
const stacked = baseBranch !== 'main'
// How deep the whole stack this item belongs to is (1 = not stacked). Set by
// batch_issue_response; it decides which recovery procedure the PR body names.
const stackDepth = Number(triage.stackDepth) || (stacked ? 2 : 1)

// GitHub access. Both workflows used to assume the `gh` CLI, which a cloud
// session does not have — so every PR, diff and comment step failed there. The
// GitHub MCP tools are the fallback, and they are deferred: a subagent has to
// load them before it can call one.
const GITHUB_ACCESS =
  'GitHub access: use the `gh` CLI if `command -v gh` finds it. If it does not (the usual case ' +
  'in a cloud session), use the GitHub MCP tools instead — they are deferred, so load them first ' +
  'with ToolSearch, e.g. "select:mcp__github__create_pull_request,mcp__github__pull_request_read,' +
  'mcp__github__add_issue_comment". The repository is owner "SalvageUnion-io", repo "SU-SRD". ' +
  'Never skip or fake a GitHub step because `gh` is missing.'

// What to do when a layer beneath this PR squash-merges. Two layers: a manual
// `rebase --onto`. Three or more: `gh stack`, which owns the cascading rebase —
// the /stacked-pr skill's own threshold.
const STACK_RECOVERY =
  stackDepth >= 3
    ? `This stack is ${stackDepth} PRs deep, so it is managed with \`gh stack\` (see /stacked-pr §5): ` +
      'after a layer beneath merges, run `gh stack checkout <this branch>` then `gh stack sync` — never ' +
      'hand-rebase inside a gh-managed stack. Without the `gh` CLI, fall back to the manual ' +
      '`git rebase --onto` procedure in the same skill.'
    : 'When the layer beneath yours squash-merges, the fix is `git rebase --onto` from the recorded ' +
      'parent tip (see /stacked-pr), never `gh pr update-branch` (which fails on the duplicated ' +
      'commit) and never a bare `--force` (which on this repo can resurrect an already-merged branch).'

// Canonical Salvage Union rules.
//
// This used to read "~/Documents/SURules (…), outside the repo so always present
// in a fresh worktree" — which is exactly backwards. A machine-local absolute
// path is present on ONE machine and absent in every container, worktree and CI
// runner, which is where this workflow actually runs.
//
// The in-repo path is `bun run rules:extract`, which turns the copyright-bearing
// PDFs in `rules/` into `rules/extracted/*.txt` with `<!-- page N -->` markers so
// a citation can name a real page. Those PDFs are gitignored and absent in CI, so
// this is best-effort by design — and the instruction below says what to do when
// it is unavailable, rather than leaving an agent to invent a rule.
const RULES =
  'the extracted rules text at `rules/extracted/*.txt` — run `bun run rules:extract` first ' +
  '(it converts the PDFs in `rules/`, which are gitignored and may be absent). ' +
  'If the extract is unavailable, say so explicitly in your output and do NOT invent a ' +
  'rule or a page number: an unsourced citation is worse than none'

const RESOLVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    prNumber: {
      type: ['number', 'null'],
      description: 'GitHub PR number, or null if no PR was opened',
    },
    prUrl: { type: ['string', 'null'] },
    branch: { type: 'string' },
    validated: { type: 'boolean', description: 'whether typecheck + test + lint all passed' },
    summary: { type: 'string', description: 'what changed and why' },
    notes: {
      type: 'string',
      description: 'caveats, skipped checks, follow-ups, or why no PR was opened',
    },
  },
  required: ['prNumber', 'prUrl', 'branch', 'validated', 'summary', 'notes'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    approval: { type: 'string', enum: ['approved', 'changes_requested', 'rejected'] },
    commentUrl: {
      type: ['string', 'null'],
      description: 'url of the review comment that was posted',
    },
    rationale: { type: 'string', description: 'one-paragraph justification for the verdict' },
  },
  required: ['approval', 'commentUrl', 'rationale'],
}

// ── Phase 1: implement in an isolated worktree and open a PR ──────────────────
phase('Implement')
const impl = await agent(
  [
    'You are resolving ONE piece of user feedback for the In-The-Union-Now (ITUN) app',
    '(apps/itun) in the SU-SRD bun monorepo. You are running in a FRESH git worktree',
    `branched off the latest origin/main — this is your isolated copy; do not touch other worktrees.`,
    stacked
      ? `THIS PR IS STACKED on "${baseBranch}" (a previous item in the same dependency chain). Your ` +
        `work must build ON TOP of that branch, not main: run "git fetch origin ${baseBranch}" and ` +
        `cut your new branch from "origin/${baseBranch}" (e.g. "git checkout -B fix/itun-<slug> ` +
        `origin/${baseBranch}"). Do NOT merge or rebase onto main. Your diff must contain ONLY your ` +
        `own change on top of "${baseBranch}".`
      : '',
    '',
    'FEEDBACK / ISSUE',
    `  Title:   ${triage.title || '(none)'}`,
    `  Summary: ${triage.summary || triage.title}`,
    `  UX area: ${triage.uxArea || '(identify it yourself)'}`,
    triage.approach ? `  Suggested approach: ${triage.approach}` : '',
    triage.files && triage.files.length ? `  Candidate files: ${triage.files.join(', ')}` : '',
    triage.rules && triage.rules.length
      ? '  Relevant Salvage Union rules:\n' +
        triage.rules
          .map((r) => `    - ${r.source || ''} ${r.citation || ''} — ${r.relevance || ''}`.trim())
          .join('\n')
      : '',
    '',
    'STEPS',
    '1. Pinpoint the exact UX this concerns in apps/itun/src — the route under',
    '   src/routes (pilots / mechs / crawlers / sheet / s), the component(s) under src/components,',
    '   and/or the store under src/stores. Read the code before changing it.',
    `2. Confirm the governing game rules by consulting ${RULES}.`,
    '   Cite book + page for any rule the change depends on.',
    '3. Implement the SMALLEST change that addresses the feedback. Reuse existing shared components —',
    '   ReferenceEntityCard for any SRD entity, Card for everything else, and the primitives exported',
    '   from packages/component-lib/src/index.ts (read the barrel; never trust a component name from',
    '   memory). Do NOT add unrequested features, schema, or UI.',
    '   Persistence is account-gated (ADR-030, ADR-034, ADR-035): signed in, Convex is the server of',
    '   record and IndexedDB is its cache; anonymous work is in-memory only. Read apps/itun/CLAUDE.md',
    '   and .claude/rules/itun-data-access.md before touching data, go through the existing stores and',
    '   Convex functions, and never add a device-only store or a second persistence path.',
    '4. Validate: "bun run check:fast" while iterating, then "bun run check" (the full gate) before',
    '   pushing — or at minimum "bun run typecheck", "bun run test" (not a bare root bun test, which',
    '   is not the gate) and "bun run lint". If you touched salvageunion-reference schemas or data, run',
    '   "bun run build:package" first and commit the regenerated schemas. Biome is the only formatter:',
    '   run "bun run format" (the pre-commit hook also formats staged files).',
    `5. Commit on a new branch named fix/itun-<short-slug>${stacked ? ` cut from origin/${baseBranch} (see above)` : ''}. Use a conventional-commit message and the`,
    '   commit trailers your session attribution instructions require.',
    `6. Push the branch and open a PR against base "${baseBranch}" ("gh pr create --base ${baseBranch}", or`,
    '   mcp__github__create_pull_request without gh).',
    stacked
      ? `   This is a STACKED PR: follow the /stacked-pr skill (.claude/skills/stacked-pr/SKILL.md) before doing anything to it later. ${STACK_RECOVERY}`
      : '',
    '   The PR body MUST: restate the feedback, name the UX area changed, cite the rules reference(s),',
    `   summarize the fix, and list which checks passed.${stacked ? ` Note at the top that this PR is STACKED on "${baseBranch}" and should merge after it, and include the recovery procedure above.` : ''}`,
    '   End the body with the PR footer your session attribution instructions require.',
    GITHUB_ACCESS,
    '',
    'Return the PR number and url. If you could not open a PR (e.g. no actionable change, checks fail',
    'and cannot be fixed in scope), set prNumber and prUrl to null and explain why in notes.',
  ]
    .filter(Boolean)
    .join('\n'),
  {
    label: `resolve:${(triage.title || 'feedback').slice(0, 40)}`,
    phase: 'Implement',
    isolation: 'worktree',
    schema: RESOLVE_SCHEMA,
  }
)

if (!impl || impl.prNumber == null) {
  log(`No PR opened for "${triage.title || triage.summary}" — skipping review.`)
  return { triage, implementation: impl, review: null }
}

// ── Phase 2: independent review → approval-status comment on the PR ───────────
phase('Review')
const review = await agent(
  [
    `Independently review pull request #${impl.prNumber} (${impl.prUrl}) in the SU-SRD repo.`,
    'Be skeptical: verify the change actually resolves the feedback and respects the game rules.',
    '',
    'ORIGINAL FEEDBACK',
    `  ${triage.summary || triage.title}`,
    triage.rules && triage.rules.length
      ? 'RULES IT MUST RESPECT\n' +
        triage.rules.map((r) => `  - ${r.source || ''} ${r.citation || ''}`.trim()).join('\n')
      : '',
    '',
    'STEPS',
    GITHUB_ACCESS,
    `1. Read the diff ("gh pr diff ${impl.prNumber}") and the body ("gh pr view ${impl.prNumber}"),`,
    '   or mcp__github__pull_request_read (methods get_diff and get) without gh.',
    '2. Check: does it resolve the feedback? Is it scoped (no unrequested features, schema, or new',
    '   persistence path — ADR-030/034/035 make Convex the server of record)?',
    `   Does it respect the cited Salvage Union rules (re-check against ${RULES}, if a`,
    '   rule claim is load-bearing)? Does it reuse shared components instead of one-off UI? Are the',
    '   checks green per the PR body?',
    `3. Post your review as a PR comment: "gh pr comment ${impl.prNumber} --body <review>", or`,
    '   mcp__github__add_issue_comment without gh. The comment',
    '   must be a short structured review (what you checked, any concerns) and END with one explicit',
    '   status line, exactly one of:',
    '     **Review status: ✅ Approved**',
    '     **Review status: 🔄 Changes requested**',
    '     **Review status: ❌ Rejected**',
    '   Do NOT use "gh pr review --approve" — GitHub forbids approving an own PR, and a comment with a',
    '   clear status is what is wanted here.',
    '',
    'Return your approval verdict and the url of the comment you posted.',
  ]
    .filter(Boolean)
    .join('\n'),
  { label: `review:#${impl.prNumber}`, phase: 'Review', schema: REVIEW_SCHEMA }
)

log(`PR #${impl.prNumber} → ${review ? review.approval : 'review failed'}`)
return { triage, implementation: impl, review }
