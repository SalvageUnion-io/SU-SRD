---
name: triage
description: Use at the start of a working session, or when asked "what should I work on" / "what is broken" / "any Sentry issues" / "is prod healthy". Reads nightly E2E, Sentry, deploys, dependency PRs and in-flight work, reports any signal it could not reach, and proposes at most five items in priority order.
allowed-tools: Bash, Read, ToolSearch, mcp__sentry__search_issues, mcp__sentry__get_sentry_resource, mcp__github__actions_list, mcp__github__list_issues, mcp__github__list_pull_requests
---

# Triage

Read what the systems are actually reporting, then propose what to work on. Run
this before starting work, not after deciding what to do.

## Steps

Gather all of these before proposing anything. A signal you skipped is a
recommendation you cannot justify.

**A signal you could not reach is a finding, not a skip.** In a cloud session
`gh` answers REST only (`gh pr` and `gh issue` get 403) and the `cloudflare-*`
and `sentry` MCP servers cannot authenticate (see
[cloud sessions](../../../docs/ARCHITECTURE.md#cloud-sessions)).
For every step, use the first route that works and record which one you used:

| Signal | Route 1 | Route 2 (`gh` fails) |
| --- | --- | --- |
| Workflow runs (steps 1, 3, 4) | `gh run list …` | `mcp__github__actions_list` (load it with ToolSearch) |
| Issues and PRs (steps 1, 4, 5) | `gh issue list …` / `gh pr list …` | `mcp__github__list_issues` / `mcp__github__list_pull_requests` |
| Production errors (step 2) | `sentry` MCP | none — record it as unread |
| Worker logs (step 3) | `cloudflare-observability` MCP | none — the deploy workflow's smoke job still counts |

1. **Nightly E2E** — did last night's run pass?

   ```bash
   gh run list --workflow=e2e-nightly.yml --limit 5 \
     --json conclusion,createdAt,displayTitle
   gh issue list --label nightly-e2e-failure --state open
   ```

   A failure here outranks almost everything: the suite is the only automated
   check on whole user journeys, and a suite that stays red stops being read.

2. **Production error tracking** — what is Sentry reporting?

   Call `mcp__sentry__search_issues` (load it with ToolSearch) with
   `organizationSlug: susrd`, `regionUrl: https://de.sentry.io`,
   `query: is:unresolved` and `sort: freq`, and no project or `environment:`
   filter: `itun-convex` reports as `prod` and every other project as
   `production`, so an environment filter silently drops the backend. Rank
   anything affecting more than one user first; `mcp__sentry__get_sentry_resource`
   opens one issue. Whether production can report at all is gated elsewhere:
   each deploy greps its built bundles for an inlined DSN, and
   `tools/smoke-production.sh` (post-deploy and nightly) asserts each served
   CSP admits the ingest host. A red run of either is the "production is
   blind" finding.

3. **Deploys** — did the last deploy succeed? All four surfaces ship from one
   workflow, `.github/workflows/deploy-cloudflare.yml`, so check that workflow's
   most recent run rather than four dashboards. Its `smoke` job is
   the useful part: it asserts the production hostnames, the rotated-chunk 404,
   `robots.txt` by body, and that CSP and HSTS actually reach the browser.
   `cloudflare-observability` (MCP) gives Worker errors and logs on top.

   Green `deploy` legs with a red `smoke` job mean the code shipped and something
   about routing, headers or a zone rule did not — that is a finding, not noise.

4. **Dependency and security PRs**

   ```bash
   gh pr list --author app/dependabot --state open
   gh run list --workflow=codeql.yml --limit 3 --json conclusion
   bun outdated --filter='*'
   ```

   Dependabot covers Actions only; Bun dependencies are updated by hand, and
   `bun outdated` is the only thing that shows how far they have drifted.

5. **In-flight work** — what is already open, and is any of it stuck?

   ```bash
   gh pr list --state open --json number,title,isDraft,statusCheckRollup
   ```

## Output

Open with a **Signals** line that names every signal you read and every one
you could not, with the reason (`gh` absent, MCP server failed to connect,
secret not available). "Sentry: unread — MCP blocked by proxy" is a result the
reader can act on; a triage that silently drops Sentry reads as "production is
clean", which is the one conclusion it has no evidence for.

Then propose an ordered list of at most **five** items. For each: the signal that
produced it, why it ranks where it does, and a rough size. Then state plainly
what you are NOT proposing and why — an unranked list of everything wrong is
the backlog problem restated, not triage.

Rank by this order unless there is a stated reason to depart from it:

1. Production is broken or blind for real users.
2. A merge gate is red (nightly E2E, a failed deploy).
3. Security and dependency updates.
4. In-flight work that is one step from landing.
5. New feature work.

If every signal you read is green, say so in one line and propose feature work
from the open backlog — but never call the day green while a signal was unread.
Do not manufacture findings — "nothing is wrong" is a valid and useful triage
result.
