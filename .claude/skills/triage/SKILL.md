---
name: triage
description: Use at the start of a working session, or when asked "what should I work on" / "what is broken". Reads nightly E2E, Sentry, deploys, dependency PRs and in-flight work, reports any signal it could not reach, and proposes at most five items in priority order.
allowed-tools: Bash, Read, ToolSearch, mcp__github__actions_list, mcp__github__list_issues, mcp__github__list_pull_requests
---

# Triage

Read what the systems are actually reporting, then propose what to work on. Run
this before starting work, not after deciding what to do.

This exists because the repo has a **backlog problem, not a capacity problem**.
Throughput is ~3 PRs/day with a 40-minute median cycle time; the constraint is
knowing which change is worth making. Nothing currently routes an observed
production signal into the work queue — zero of the last 60 merged PRs
referenced an issue, and the open backlog is mostly issues filed on one day in
March. This closes that loop by hand until it earns being automated.

## Steps

Gather all of these before proposing anything. A signal you skipped is a
recommendation you cannot justify.

**A signal you could not reach is a finding, not a skip.** In a cloud session
the `gh` CLI is usually absent and the `cloudflare-*`, `sentry` and `context7`
MCP servers fail to connect through the egress proxy (see "Cloud sessions" in
[`docs/architecture/agent-tooling.md`](../../../docs/architecture/agent-tooling.md)).
For every step, use the first route that works and record which one you used:

| Signal | Route 1 | Route 2 (no `gh`) |
| --- | --- | --- |
| Workflow runs (steps 1, 3, 4) | `gh run list …` | `mcp__github__actions_list` (load it with ToolSearch) |
| Issues and PRs (steps 1, 4, 5) | `gh issue list …` / `gh pr list …` | `mcp__github__list_issues` / `mcp__github__list_pull_requests` |
| Production errors (step 2) | `sentry` MCP | none — record it as unread |
| Worker logs (step 3) | `cloudflare-observability` MCP | none — the deploy workflow's smoke step still counts |

1. **Nightly E2E** — did last night's run pass?

   ```bash
   gh run list --workflow=e2e-nightly.yml --limit 5 \
     --json conclusion,createdAt,displayTitle
   gh issue list --label nightly-e2e-failure --state open
   ```

   A failure here outranks almost everything: the suite is the only automated
   check on whole user journeys, and a suite that stays red stops being read.

2. **Production error tracking** — is it reporting, and what did it report?

   ```bash
   bun run check:observability:live   # is the SDK actually being served?
   ```

   If this fails, production is blind and that is the finding. Once a Sentry
   DSN is provisioned, read the new issues since yesterday and treat anything
   affecting more than one user as a candidate for today.

3. **Deploys** — did the last deploy succeed? All four surfaces ship from one
   workflow, `.github/workflows/deploy-cloudflare.yml`, so check that workflow's
   most recent run rather than four dashboards. Its post-deploy smoke step is
   the useful part: it asserts the production hostnames, the rotated-chunk 404,
   `robots.txt` by body, and that CSP and HSTS actually reach the browser.
   `cloudflare-observability` (MCP) gives Worker errors and logs on top.

   A green deploy with a red smoke step means the code shipped and something
   about routing, headers or a zone rule did not — that is a finding, not noise.

   This step used to name the Netlify and Render MCP servers, which were deleted
   with the hosts they reached. A skill is executed rather than read, so that
   made step 3 unrunnable; `tools/check-doc-drift.ts` now asserts MCP names in
   docs against `.mcp.json`.

4. **Dependency and security PRs**

   ```bash
   gh pr list --author app/dependabot --state open
   gh run list --workflow=codeql.yml --limit 3 --json conclusion
   ```

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
2. A merge gate is red (nightly E2E, CI on main, a failed deploy).
3. Security and dependency updates.
4. In-flight work that is one step from landing.
5. New feature work.

If every signal you read is green, say so in one line and propose feature work
from the open backlog — but never call the day green while a signal was unread.
Do not manufacture findings — "nothing is wrong" is a valid and useful triage
result.
