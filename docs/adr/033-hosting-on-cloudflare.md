---
status: accepted
---

# ADR-033: Hosting Moves to Cloudflare

## Status

**Accepted and delivered.** Every production hostname is served by a
Cloudflare Worker: `intheunionnow.com` since 2026-08-19, `salvageunion.io` and
`assets.salvageunion.io` since 2026-08-31; Netlify and Render serve none of them.
Code comments that cite a cutover phase (`ADR-033 P4`) mean the deleted plan:
`git show c2476d1c:docs/architecture/cloudflare-cutover.md`. The decision as
first written, with the cutover's context and hazards:
`git show bc9f08ce:docs/ARCHITECTURE.md`. Current identifiers (Workers,
buckets, zones) are in [services and agent tooling](../ARCHITECTURE.md#services-and-agent-tooling).

**Amended 2026-10-06 — §Credentials: the deploy secrets move into a `production`
GitHub Environment** restricted to `main`, so a workflow copy
dispatched from a branch cannot read them.

**Amended 2026-10-08 — §Credentials: the deploy runs on `push` to `main`**,
gated by the strict `main` ruleset.

**Amended 2026-10-09 — `srd` gains a Worker script that answers misses.**
`_headers` matches by path, not status, and Static Assets applied its
`/assets/*` rule to the `404-page` response, so a missing chunk's 404 was
`immutable` for a year. The zone Transform Rule meant to override that was not
in effect on `salvageunion.io` (production answered `immutable`, and the deploy
smoke failed on it). `src/worker/index.ts` now runs for every miss, as itun's
does, and answers it with `no-store`; real files never run it. No rule outside
the repo is relied on for this any more.

**Amended 2026-10-10 — §Credentials: a second Environment, `preview`.** The
[preview slot](../ARCHITECTURE.md#preview-deploys) is dispatched from any branch, so its
Environment admits every branch and holds a copy of the Cloudflare token
(which cannot be narrowed to the preview) behind a required reviewer, the
owner. Production's Environment, its branch policy and its no-reviewer
deploys are unchanged.

**§3 is history since [ADR-036](036-retire-snapshot-shares.md)** retired snapshots: nothing reads
or binds the snapshot bucket.

Amends [ADR-004](004-snapshot-netlify-functions.md), since superseded: snapshots moved from Netlify
Functions + Blobs to a Worker + R2 with ADR-004's contract unchanged.

Re-affirms [ADR-031](031-srd-in-house-vite-ssg.md) and
[ADR-030](030-accounts-games-server-of-record.md) without changing either.
`srd` remains a statically pre-rendered no-backend site; Convex remains the
server of record for identity, ownership and sharing. **Only the host changed.**

## Context

Hosting was split three ways: Netlify served `srd`, `itun` and `su-assets`,
Render ran the Discord bot as a gateway worker, and Convex ran the accounts
backend. Cost was not the reason to move (Render's $7/mo worker was the only
line item). Consolidating onto one platform was, together with ending a class
of Discord gateway failure. The bot's data layer fit Workers Free, measured
rather than assumed: 549.6 KiB compressed and a 141 ms startup.

## Decision

**1. Hosting is Cloudflare.** `srd` and `itun` are Workers Static Assets,
`su-assets` is a Worker over R2, and the Discord bot is a Worker answering HTTP
interactions.

**2. The cutover was hard, with no rollback.** Per-phase verification was the
only safety mechanism, so every phase carried a gate written so that it could
fail.

**3. Snapshots used R2, not KV.** KV's up-to-60-second propagation and cached
negative lookups would have turned publish-then-read into a hard not-found.

**4. Builds run in GitHub Actions; deploys use `wrangler`.** Workers Builds is
not adopted: `srd`'s build provisions Chromium to render per-entity OG images,
and one build path keeps one place for path filtering and the CI gates in front
of every deploy.

**5. Convex stays, and nothing here may foreclose moving it.** Replacing Convex
with D1 is a separate decision needing its own ADR (see the follow-up below).
So the Worker↔Convex boundary stays plain HTTP with a bearer token.

**6. Everything runs on the existing `alxjrvs@gmail.com` account.** A dedicated
account was declined. Cloudflare isolates by account, not project, so this
project shares the Workers Free quota (100k requests/day, 10 ms CPU) and the
`alxjrvs.workers.dev` subdomain with RANDSUM's two Workers, `randsum-rdn` and
`randsum-site`; preview URLs are `<worker>.alxjrvs.workers.dev`, and renaming
the subdomain would move RANDSUM's Workers.

**7. A failed gate halts the deploy.** No gate is worked around, relaxed, or
retried with different parameters to obtain a pass. With no rollback, treating
a red gate as an obstacle converts a caught problem into an unrecoverable one.
This rule exists to be cited.

## Consequences

- **The Discord bot displays as permanently offline** in every server:
  presence needs a gateway session, which an HTTP-interactions app never has.
  It works when invoked. Liveness is the bot's `/health`, which
  `tools/smoke-production.sh` checks after every deploy and nightly, so a
  revoked token surfaces up to a day later.
- **The bot's endpoint is application-level**, so a change reaches every server
  at once, with no canary. Its pre-deploy gate is a signed replay harness, not
  a staged rollout.
- **Module scope on Workers forbids timers, async I/O and randomness.**
  `new REST()` throws at startup, and so would any module-scope observability
  initialisation.
- **Zod's `jitless` configuration is load-bearing for the runtime**, not only
  for CSP: workerd bans `new Function`. Do not revert
  `packages/salvageunion-reference/lib/zod.ts` as an optimisation.

## Credentials

Only GitHub Actions holds deploy credentials (decision 4), so CI holds a token
that can deploy production. The bar it is held to:

- A Cloudflare API token scoped to *Workers Scripts: Edit* and, for R2,
  **narrowed to the named buckets** rather than account-wide. Cloudflare scopes
  R2 per bucket but not Workers per script, so the Workers half can edit any
  Worker on the account (§6). Narrow the half that can be narrowed, and do not
  describe the other half as contained.
- Stored as a secret of the `production` GitHub Environment, restricted to
  `main`, with no reviewers. Never at repository
  level, in a `wrangler.jsonc`, or in a `.env` git can see.
- Every deploy follows a merge, and the `main` ruleset merges only a branch
  that is up to date with `main` and passed `CI Success`, so a red gate cannot
  deploy. A green gate suffices: production deploys need no environment
  approval.

## Accepted risks

- **No rollback**, chosen deliberately.
- **The CI token reaches the whole personal account**, RANDSUM's two Workers
  included. With an agent PAT carrying `workflow` scope and no required human
  review, "merge a PR" reaches production with no human in it, and not only
  this project's. Revisit if RANDSUM's deployments become something this
  repository must not be able to touch; adding anything else to the account
  widens it.
- **The bot displays permanently offline** in every server.

## Configuration outside the repo

Three things are configured in the Cloudflare dashboard and are invisible to
`grep`: Images Transformations (enabled per zone), **Always Use HTTPS** (SSL/TLS
→ Edge Certificates, on both zones), and one **Redirect Rule** per zone sending
`www` to the apex.

A missing chunk's 404 is NOT among them: each app's Worker answers every miss
with `no-store`, where `_headers`' `/assets/*` `immutable` rule does not reach,
and `tools/smoke-production.sh` asserts it on both sites. A Response Header
Transform Rule doing the same, if one exists on either zone, is redundant.

Always Use HTTPS answers every plain-http request on either zone, `www` and
`assets.` included, with a 301 to its https twin. Without it plaintext reaches
the Workers and is served as-is: HSTS protects only a browser that has already
seen an https response, and the Redirect Rule matches `www` over https only.
`tools/smoke-production.sh` asserts the 301 on all five hostnames.

| Zone                | When host equals        | Then                                          |
| ------------------- | ----------------------- | --------------------------------------------- |
| `salvageunion.io`   | `www.salvageunion.io`   | 301 → `https://salvageunion.io` + path, query |
| `intheunionnow.com` | `www.intheunionnow.com` | 301 → `https://intheunionnow.com` + path, query |

`_redirects` cannot do this: Cloudflare lists domain-level redirects as
unsupported and ignores malformed rules silently. Built from the dashboard's
"Redirect from WWW to root" template, two settings matter: tick **Preserve query
string** (off by default; srd has `/search?q=…`), and when it offers to create a
proxied `www` record, **decline** — wrangler's custom-domain attach creates that
record and fails with 409 Conflict if one already exists. `www` stays attached
as a Worker custom domain so that a missing rule serves the site, with correct
canonicals, rather than an error.

## Follow-up: Convex → D1

Out of scope, with its own future ADR; recorded because decision 5 binds today.
Schema translation to SQLite is the easy part. Three things are not:

1. **Reactivity.** D1 has no subscriptions, and ADR-030 makes the reactive model
   the product feature. Cloudflare's answer is Durable Objects with hibernating
   WebSockets (a real design exercise) or polling (a product downgrade).
2. **Auth.** Discord OAuth terminates on Convex via `@convex-dev/auth`.
   Replacing it means owning the OAuth flow, session issuance and refresh, and
   the `authAccounts` lookup the Discord bot uses to resolve a snowflake.
3. **Transactions.** Convex mutations are serializable by default; invariants
   the platform guarantees today would have to become explicit.
