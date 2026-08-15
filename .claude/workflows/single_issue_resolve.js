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
//             { title, summary, uxArea, files?, rules?, approach?, inScope?, source?, baseBranch? }
//             baseBranch: if set (and not "main"), this PR is STACKED on that branch — the new branch
//             is cut from origin/<baseBranch> and the PR opened with --base <baseBranch>, so a chain of
//             dependent items lands as a stack rather than as conflicting independent diffs off main.
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

// Canonical Salvage Union rules, outside the repo so always present in a fresh worktree.
const RULES =
  '~/Documents/SURules (Salvage Union Core Book Digital Edition 2.0a.pdf, ' +
  'SU_Quick Ref Sheets Digital 2.0.pdf, and the "Salvage Union Starter Set 1.0/" folder)'

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
    `2. Confirm the governing game rules by consulting the Salvage Union rulebooks in ${RULES}.`,
    '   Cite book + page/section for any rule the change depends on. (docs/rules/ digest is gitignored',
    '   and absent in a fresh worktree — the PDFs are canonical; Read them with the pages parameter.)',
    '3. Implement the SMALLEST change that addresses the feedback. Reuse existing shared components',
    '   (EntityDisplay, DisplayCard, component-lib primitives) — do NOT add unrequested features, schema,',
    '   or UI. ITUN is local-first (IndexedDB, no auth/backend); do not introduce a backend.',
    '4. Validate: run "bun run typecheck", "bun test", and "bun run lint" (or "bun run check").',
    '   If you touched the salvageunion-reference package, "bun run build:package" first.',
    '   Run "bun run format" before committing (the PostToolUse prettier hook uses defaults, not the',
    '   repo .prettierrc, so format explicitly).',
    `5. Commit on a new branch named fix/itun-<short-slug>${stacked ? ` cut from origin/${baseBranch} (see above)` : ''}. Use a conventional-commit message and the`,
    '   Co-Authored-By / Claude-Session trailers required by CLAUDE.md.',
    `6. Push the branch and open a PR with "gh pr create --base ${baseBranch}". The PR body MUST: restate`,
    '   the feedback, name the UX area changed, cite the SURules reference(s), summarize the fix, and list',
    `   which checks passed.${stacked ? ` Note at the top that this PR is STACKED on "${baseBranch}" and should merge after it.` : ''}`,
    '   End the body with the "Generated with Claude Code" footer from CLAUDE.md.',
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
    `1. Read the diff ("gh pr diff ${impl.prNumber}") and the body ("gh pr view ${impl.prNumber}").`,
    '2. Check: does it resolve the feedback? Is it scoped (no unrequested features/schema/backend)?',
    `   Does it respect the cited Salvage Union rules (re-check against the rulebooks in ${RULES} if a`,
    '   rule claim is load-bearing)? Does it reuse shared components instead of one-off UI? Are the',
    '   checks green per the PR body?',
    `3. Post your review as a PR comment: "gh pr comment ${impl.prNumber} --body <review>". The comment`,
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
