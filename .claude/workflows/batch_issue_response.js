export const meta = {
  name: 'batch_issue_response',
  description:
    'Triage a batch of ITUN feedback — identify the UX area and the governing Salvage Union rules per item, work out how the items depend on / relate to each other — then dispatch single_issue_resolve to land a reviewed PR per in-scope item, stacking dependent PRs in order',
  phases: [
    {
      title: 'Collect',
      detail: 'gather feedback items (args string/array, or open GitHub issues)',
    },
    { title: 'Triage', detail: 'per item: identify the ITUN UX area + relevant SURules rules' },
    {
      title: 'Relate',
      detail: 'find dependencies/relations between items; order them into stacks',
    },
    {
      title: 'Resolve',
      detail: 'dispatch single_issue_resolve per in-scope item; dependent PRs stacked base-first',
    },
  ],
}

// ── args contract ────────────────────────────────────────────────────────────
//   string                         → one raw batch of feedback; split into discrete items
//   string[]                       → list of raw feedback items
//   { feedback: string|string[]|object[], → explicit feedback ({title,summary} objects also accepted;
//                                           a bare string is split into items, never sent to GitHub)
//     triageOnly?: boolean,        → stop after Relate, open NO PRs (default false)
//     label?: string }             → if feedback is omitted, the gh issue label to pull from
//   undefined                      → fall back to open GitHub issues labelled "itun-revamp"
//
// NOTE: a raw string (whether `args` itself or `cfg.feedback`) is feedback to be triaged — it is
// split into items by an agent and NEVER falls through to the GitHub-issue fallback. The fallback
// fires only when there is genuinely no feedback to work from (undefined / empty).
const cfg = Array.isArray(args)
  ? { feedback: args }
  : typeof args === 'string'
    ? { feedback: args }
    : args || {}
const triageOnly = !!cfg.triageOnly

// ── Phase 1: collect feedback ─────────────────────────────────────────────────
phase('Collect')
let items = cfg.feedback

// A single raw string may pack several numbered items plus shared context/UX direction.
// Split it into discrete, individually-actionable items rather than triaging it as one blob.
if (typeof items === 'string') {
  const raw = items
  const split = await agent(
    [
      'Split this raw batch of ITUN (In-The-Union-Now) user feedback into discrete, individually-',
      'actionable feedback items — one entry per distinct problem the user raised.',
      'Some lines may be shared context or UX direction that applies to SEVERAL items rather than',
      'being an item of their own. When so, do NOT emit them as a separate item — fold that context',
      'into the summary of each item it applies to, so every item is self-contained.',
      '',
      'RAW FEEDBACK',
      raw,
    ].join('\n'),
    {
      label: 'collect:split-batch',
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
                title: { type: 'string', description: 'concise title for this single item' },
                summary: {
                  type: 'string',
                  description: 'the item restated, with any shared context folded in',
                },
              },
              required: ['title', 'summary'],
            },
          },
        },
        required: ['items'],
      },
    }
  )
  items = (split && split.items && split.items.length && split.items) || [raw]
}

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
  return { triaged: [], relations: [], resolved: [] }
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

// ── Phase 2: triage every item (barrier — Relate needs them all together) ─────
phase('Triage')
const triaged = (await parallel(feedback.map((fb) => () => triageAgent(fb))))
  .filter(Boolean)
  .map((t, i) => ({ ...t, id: i }))

if (!triaged.length) {
  log('Nothing triaged.')
  return { triaged: [], relations: [], resolved: [] }
}

// ── Phase 3: relate — how do the items depend on / overlap each other? ─────────
// This is what lets dependent PRs stack instead of racing independent diffs off main.
phase('Relate')
const RELATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    groups: {
      type: 'array',
      description:
        'Partition of the items. Each group is an ORDERED stack of related items that must land in ' +
        'sequence (e.g. they touch the same component and one builds on another). Items with no ' +
        'dependency are their own single-element group. Every in-scope item id appears in exactly one group.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          order: {
            type: 'array',
            items: { type: 'integer' },
            description: 'item ids in dependency order — the base of the stack first',
          },
          relation: {
            type: 'string',
            description:
              'why these items stack (shared component/file, one enables the other, …) — "" for a singleton',
          },
        },
        required: ['order', 'relation'],
      },
    },
  },
  required: ['groups'],
}

const relation = await agent(
  [
    'You are sequencing a batch of already-triaged ITUN feedback items into PR stacks. Analysis only.',
    'Decide how the items DEPEND ON and RELATE TO each other so dependent PRs can be stacked (each',
    'branched off the previous one) instead of opening conflicting independent diffs off main.',
    '',
    'RULES FOR GROUPING',
    '- Keep ONE PR per feedback item — do not merge items together. You only decide ordering + stacking.',
    '- Put items that touch the SAME component/files, or where one item builds on the change another',
    '  introduces, in the SAME group, ordered base-first (the prerequisite change before the dependent one).',
    '- Items that are independent (different area, no shared files) each get their OWN single-item group.',
    '- Every in-scope item id MUST appear in exactly one group. Ignore out-of-scope items (inScope=false).',
    '',
    'ITEMS (triage summaries)',
    ...triaged.map(
      (t) =>
        `  [${t.id}] inScope=${t.inScope} | ${t.title}\n` +
        `       uxArea: ${t.uxArea}\n` +
        `       files:  ${(t.files || []).join(', ') || '(none named)'}\n` +
        `       approach: ${t.approach}`
    ),
  ].join('\n'),
  { label: 'relate:dependency-graph', phase: 'Relate', schema: RELATION_SCHEMA }
)

const byId = Object.fromEntries(triaged.map((t) => [t.id, t]))
// Build the working groups from the relation result, then make sure every in-scope item is covered
// (defensive: if the relation agent dropped one, it falls back to its own singleton stack).
let groups = (relation && relation.groups ? relation.groups : [])
  .map((g) => ({
    relation: g.relation || '',
    order: (g.order || []).filter((id) => byId[id] && byId[id].inScope),
  }))
  .filter((g) => g.order.length)
const covered = new Set(groups.flatMap((g) => g.order))
for (const t of triaged) {
  if (t.inScope && !covered.has(t.id)) {
    groups.push({ relation: '', order: [t.id] })
    covered.add(t.id)
  }
}

for (const t of triaged.filter((t) => !t.inScope)) {
  log(`"${t.title}" judged out of ITUN scope — triaged only, no PR.`)
}
log(
  `${covered.size} in-scope item(s) in ${groups.length} group(s): ` +
    groups
      .map((g) => (g.order.length > 1 ? `[stack: ${g.order.join('→')}]` : `[${g.order[0]}]`))
      .join(' ')
)

// ── triageOnly: stop here, open no PRs ─────────────────────────────────────────
if (triageOnly) {
  log('triageOnly set — no PRs opened.')
  return { triaged, relations: groups, resolved: [] }
}

// ── Phase 4: resolve — groups run in parallel; within a group, items resolve in
// order and each dependent PR is branched off (stacked on) the previous item's branch.
phase('Resolve')
const groupResults = await parallel(
  groups.map((group) => async () => {
    const out = []
    let base = null // null → branch off main; otherwise the previous PR's branch
    for (const id of group.order) {
      const triage = byId[id]
      // one-level nesting: batch (parent) → single_issue_resolve (child)
      const childArgs = base ? { ...triage, baseBranch: base } : triage
      const result = await workflow('single_issue_resolve', childArgs)
      const branch = result && result.implementation ? result.implementation.branch : null
      out.push({ triage, dispatched: true, base, result })
      // Next item in this stack bases off this branch — only advance if we actually got one.
      if (branch) base = branch
    }
    return out
  })
)

const clean = groupResults.flat().filter(Boolean)
const dispatched = clean.filter((r) => r.dispatched)
log(`Done: ${triaged.length} triaged, ${dispatched.length} dispatched to single_issue_resolve.`)

return {
  triaged,
  relations: groups,
  resolved: dispatched.map((r) => ({
    title: r.triage.title,
    stackedOn: r.base || 'main',
    pr: r.result && r.result.implementation ? r.result.implementation.prUrl : null,
    branch: r.result && r.result.implementation ? r.result.implementation.branch : null,
    approval: r.result && r.result.review ? r.result.review.approval : null,
  })),
}
