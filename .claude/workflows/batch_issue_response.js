export const meta = {
  name: 'batch_issue_response',
  description:
    'Triage a batch of ITUN feedback — identify the UX area and the governing Salvage Union rules per item — then dispatch single_issue_resolve to land a reviewed PR for each in-scope item',
  phases: [
    { title: 'Collect', detail: 'gather feedback items (args, or open GitHub issues)' },
    { title: 'Triage', detail: 'per item: identify the ITUN UX area + relevant SURules rules' },
    { title: 'Resolve', detail: 'dispatch single_issue_resolve per in-scope item' },
  ],
}

// ── args contract ────────────────────────────────────────────────────────────
//   string[]                       → list of raw feedback items
//   { feedback: string[]|object[], → explicit feedback list ({title,summary} objects also accepted)
//     triageOnly?: boolean,        → stop after triage, open NO PRs (default false)
//     label?: string }             → if feedback is omitted, the gh issue label to pull from
//   undefined                      → fall back to open GitHub issues labelled "itun-revamp"
const cfg = Array.isArray(args) ? { feedback: args } : args || {}
const triageOnly = !!cfg.triageOnly

// ── Phase 1: collect feedback ─────────────────────────────────────────────────
phase('Collect')
let items = cfg.feedback
if (!items || !items.length) {
  const label = cfg.label || 'itun-revamp'
  log(`No feedback passed in args — pulling open GitHub issues labelled "${label}".`)
  const collector = await agent(
    `Run: gh issue list --label "${label}" --state open --limit 50 --json number,title,body. ` +
      'Return every issue as a feedback item. Each item: ref = "#<number>", title = the issue title, ' +
      'summary = the issue title followed by the issue body.',
    {
      label: 'collect:github-issues',
      phase: 'Collect',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                ref: { type: ['string', 'null'] },
                title: { type: 'string' },
                summary: { type: 'string' },
              },
              required: ['title', 'summary'],
            },
          },
        },
        required: ['items'],
      },
    }
  )
  items = (collector && collector.items) || []
}

// Normalise to a uniform { title, summary, source } shape.
const feedback = items.map((it, i) =>
  typeof it === 'string'
    ? { title: `Feedback ${i + 1}`, summary: it, source: 'inline' }
    : {
        title: it.title || `Feedback ${i + 1}`,
        summary: it.summary || it.body || it.title || '',
        source: it.ref || it.source || 'inline',
      }
)

if (!feedback.length) {
  log('No feedback items to triage.')
  return { triaged: [], resolved: [] }
}
log(`Triaging ${feedback.length} feedback item(s)${triageOnly ? ' (triageOnly — no PRs)' : ''}.`)

const TRIAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: 'concise, PR-able title for this item' },
    summary: { type: 'string', description: 'the problem restated in your own words' },
    uxArea: {
      type: 'string',
      description: 'the specific ITUN route/component/store this concerns',
    },
    files: {
      type: 'array',
      items: { type: 'string' },
      description: 'candidate files under apps/in-the-union-now to change',
    },
    rules: {
      type: 'array',
      description:
        'governing Salvage Union rules (empty if this is pure UX/usability with no rule)',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          source: { type: 'string', description: 'which SURules book/sheet' },
          citation: { type: 'string', description: 'page or section' },
          relevance: { type: 'string', description: 'why it governs this change' },
        },
        required: ['source', 'relevance'],
      },
    },
    approach: { type: 'string', description: 'the smallest proposed fix' },
    inScope: {
      type: 'boolean',
      description: 'actionable within ITUN local-first scope (no auth/backend) and worth a PR?',
    },
  },
  required: ['title', 'summary', 'uxArea', 'rules', 'approach', 'inScope'],
}

// One triage agent per feedback item. Analysis only — never writes code.
const triageAgent = (fb) =>
  agent(
    [
      'Triage ONE piece of ITUN (In-The-Union-Now) user feedback. Do NOT write code — analysis only.',
      '',
      'FEEDBACK',
      `  ${fb.title}`,
      `  ${fb.summary}`,
      fb.source && fb.source !== 'inline' ? `  (source: ${fb.source})` : '',
      '',
      '1. UX: pinpoint the exact place in apps/in-the-union-now/src this concerns — the route under',
      '   src/routes (pilots / mechs / crawlers / sheet / s), the component(s) under src/components,',
      '   and/or the store under src/stores. Name concrete files where you can.',
      '2. RULES: identify the Salvage Union rule(s) that govern the correct behaviour, consulting the',
      '   rulebooks in ~/Documents/SURules (Salvage Union Core Book Digital Edition 2.0a.pdf,',
      '   SU_Quick Ref Sheets Digital 2.0.pdf, "Salvage Union Starter Set 1.0/"). Cite book + page/',
      '   section. If no game rule applies (pure UX/usability), return an empty rules list.',
      '3. Propose the smallest in-scope fix. ITUN is local-first (IndexedDB, no auth/backend) — set',
      '   inScope=false for anything needing a backend or out of ITUN scope, and explain in approach.',
    ]
      .filter(Boolean)
      .join('\n'),
    { label: `triage:${fb.title.slice(0, 40)}`, phase: 'Triage', schema: TRIAGE_SCHEMA }
  ).then((t) => (t ? { ...t, source: fb.source } : null))

// ── triageOnly: stop after triage, open no PRs ────────────────────────────────
if (triageOnly) {
  const triaged = (await parallel(feedback.map((fb) => () => triageAgent(fb)))).filter(Boolean)
  log(`Triaged ${triaged.length} item(s); triageOnly set, so no PRs were opened.`)
  return { triaged, resolved: [] }
}

// ── Phase 2+3: pipeline — each item triages, then dispatches single_issue_resolve.
// No barrier: item B can still be triaging while item A is already resolving.
const results = await pipeline(
  feedback,
  (fb) => triageAgent(fb),
  (triage) => {
    if (!triage) return null
    if (!triage.inScope) {
      log(`"${triage.title}" judged out of ITUN scope — triaged only, no PR.`)
      return { triage, dispatched: false, result: null }
    }
    // one-level nesting: batch (parent) → single_issue_resolve (child)
    return workflow('single_issue_resolve', triage).then((result) => ({
      triage,
      dispatched: true,
      result,
    }))
  }
)

const clean = results.filter(Boolean)
const resolved = clean.filter((r) => r.dispatched)
log(`Done: ${clean.length} triaged, ${resolved.length} dispatched to single_issue_resolve.`)

return {
  triaged: clean.map((r) => r.triage),
  resolved: resolved.map((r) => ({
    title: r.triage.title,
    pr: r.result && r.result.implementation ? r.result.implementation.prUrl : null,
    approval: r.result && r.result.review ? r.result.review.approval : null,
  })),
}
