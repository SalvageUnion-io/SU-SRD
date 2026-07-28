---
name: triage
description: Morning triage — read every production and CI signal, then propose the day's work in priority order
allowed-tools: Bash, Read
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
   bun run validate:observability:live   # is the SDK actually being served?
   ```

   If this fails, production is blind and that is the finding. Once a Sentry
   DSN is provisioned, read the new issues since yesterday and treat anything
   affecting more than one user as a candidate for today.

3. **Deploys** — did the last deploy of each site succeed? Use the Netlify MCP
   (`suindex` → salvageunion.io, `in-the-union-now` → intheunionnow.com) and
   the Render MCP for `suref-discord-bot`. A site whose last deploy failed is
   serving stale code and nobody was told.

4. **Dependency and security PRs**

   ```bash
   gh pr list --author app/dependabot --state open
   gh run list --workflow=codeql.yml --limit 3 --json conclusion
   ```

5. **In-flight work** — what is already open, and is any of it stuck?

   ```bash
   gh pr list --state open --json number,title,isDraft,statusCheckRollup
   ```

6. **Agent fleet health** — only when something feels slow or wasteful:

   ```bash
   bun tools/agent-digest.ts --days 7
   ```

## Output

Propose an ordered list of at most **five** items. For each: the signal that
produced it, why it ranks where it does, and a rough size. Then state plainly
what you are NOT proposing and why — an unranked list of everything wrong is
the backlog problem restated, not triage.

Rank by this order unless there is a stated reason to depart from it:

1. Production is broken or blind for real users.
2. A merge gate is red (nightly E2E, CI on main, a failed deploy).
3. Security and dependency updates.
4. In-flight work that is one step from landing.
5. New feature work.

If every signal is green, say so in one line and propose feature work from the
open backlog. Do not manufacture findings — "nothing is wrong" is a valid and
useful triage result.
