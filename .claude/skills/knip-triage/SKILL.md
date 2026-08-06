---
name: knip-triage
description: Resolve a knip dead-code failure correctly — delete by default, and use @public / @knipignore only in the two cases that justify them
allowed-tools: Bash, Read, Edit, Grep
---

# Knip Triage

The command is one line — `bun run knip`. The failure mode is **applying the
wrong rule**, not running the wrong command: 72 dead exports once accumulated in
`salvageunion-reference` while this gate was green. So this skill is a decision
procedure.

## The default is DELETE

When knip flags something, delete it. Reach for a tag only in the two cases
below. Everything else is deletion.

**Deletions cascade** — removing an export usually makes its callees dead in
turn. **Re-run `bun run knip` after each removal** rather than batching, or you
will miss the second and third waves.

## The only two escape hatches

Both are tags in the source, configured via `"tags": ["-public", "-knipignore"]`
in `knip.json`:

| Tag           | Use when                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@public`     | The export is deliberately public, or is a **framework contract invoked rather than imported** — a Netlify Functions handler, a platform entry point. |
| `@knipignore` | A genuine knip false positive. **Only** when you can show the export _is_ consumed — e.g. deleting it fails typecheck — and you say so in the comment. |

`@knipignore` without that demonstration is how dead code gets laundered into
permanent code. If you cannot show the consumer, it is not a false positive.

## Why entry exports are reported at all

`knip.json` sets **`includeEntryExports: true`** repo-wide, so unused exports of
_entry_ files are reported too — which is exactly where a workspace-internal
package's whole public API lives. Without it, knip stays green while an entire
export surface rots.

Four workspaces opt out per-workspace with `includeEntryExports: false`, because
their entry file legitimately **is** the public surface:

- `packages/component-lib` — the barrel is the library API
- `apps/srd` — `*.page.tsx` route + endpoint modules, consumed by `ssg/routes.ts`
  and `ssg/endpoints.ts`
- `apps/su-assets` — platform handlers

If a flagged export is in one of those, check whether it is genuinely reachable
before assuming the config is wrong.

## Procedure

1. `bun run knip` — read the whole report, not just the first entry.
2. For each finding, ask in order:
   - Is it a framework contract or deliberate public API? → `@public`
   - Can I **demonstrate** it is consumed? → `@knipignore`, with the evidence in
     the comment.
   - Otherwise → **delete it.**
3. After each deletion, re-run `bun run knip`, and run `bun run typecheck` before
   concluding — a deletion that breaks types is a deletion you got wrong.
4. Repeat until clean.

## Report

Say how many findings there were, how many you deleted, and name every tag you
added with the justification. A tag added without a stated reason should be
treated as an unresolved finding, not a fix.
