# ADR-033: Hosting Moves to Cloudflare

## Status

**Accepted. Delivery is phased — see
[architecture/cloudflare-cutover.md](../architecture/cloudflare-cutover.md) for
the executable plan, its per-phase gates and current progress.**

Amends [ADR-004](ADR-004-snapshot-netlify-functions.md): snapshots keep the
endpoint shape, the ID scheme, the payload cap and the unauthenticated contract
that ADR-004 decided, and change only the platform underneath them — Netlify
Functions + Blobs become a Cloudflare Worker + R2.

Re-affirms [ADR-031](ADR-031-srd-vite-ssg.md) and
[ADR-030](ADR-030-accounts-games-server-of-record.md) without changing either.
`srd` remains a statically pre-rendered no-backend site; Convex remains the
server of record for identity, ownership and sharing. **Only the host changes.**

Supersedes nothing.

## Context

Hosting is currently split three ways: Netlify serves `apps/srd`, `apps/itun`
(SPA + three Functions + two Blobs stores) and `apps/su-assets`; Render runs
`apps/discord-bot` as a gateway worker; Convex runs the accounts backend.

Issue #830 proposed consolidating the first two onto Cloudflare. An audit
against `1366cfdf` found the proposal sound in outline and wrong in four
premises, and unexecutable in five respects — no acceptance criteria, no data
migration procedure, no credential story, an unmeasured cost claim, and a
storage choice that breaks a documented client invariant.

The financial case is thin on its own: Render's worker is the only line item at
$7/mo, and Workers Static Assets requests are free at this traffic. The reasons
that survive scrutiny are consolidation onto one platform and the elimination of
an entire class of Discord gateway failure.

Three facts shaped the decision more than cost did.

**`lp-assets` has no second copy.** The Leyline Press artwork behind
`assets.salvageunion.io` exists only in Netlify Blobs, cannot enter this
repository, and serves both production domains. The tool that uploaded it,
`tools/upload-lp-assets.ts`, was deleted in #725 as dead code — so the store had
no backup, no export path and no ingest path. That is a standing risk
independent of this decision, and acting on it is the first phase of the plan.

**The bot's data layer fits Workers Free, measured rather than assumed.** A
probe carrying the reference corpus and the portable Discord dependencies
deployed at 549.6 KiB compressed (18% of the 3 MB Free ceiling) with a Cloudflare-
reported startup of 141 ms (14% of the 1 s budget). Cloudflare's deploy-time
startup enforcement accepted it.

**The bot already has a transport seam.** `apps/discord-bot/src/commands/interactions.ts`
defines three narrow structural types that `discord.js` satisfies without
adapters, and every runtime `discord.js` import outside `index.ts` and
`events/ready.ts` has a portable equivalent in `@discordjs/builders`,
`@discordjs/collection`, `@discordjs/rest` or `discord-api-types`.

## Decision

**1. Hosting consolidates onto Cloudflare. Netlify and Render are retired.**
`srd` and the `itun` SPA move to Workers Static Assets; the `itun` snapshot API
and `su-assets` become Workers; both Blobs stores become R2 buckets; the Discord
bot moves from a Render gateway worker to Workers HTTP interactions.

**2. This is a hard cutover with no rollback.** Deliberate. The consequence is
that per-phase verification is the only safety mechanism, which is why every
phase in the plan carries a gate written so that it can fail.

**3. Snapshots use R2, not KV.** This reverses #830's proposal and is the single
most consequential decision here, because the naive reading favours KV — payloads
cap at 256 KB against a 25 MB value limit and access is by short ID.

The disqualifying property is consistency, not shape. Cloudflare documents that
KV writes take **up to 60 seconds to propagate globally** and that **negative
lookups are cached**. The publish flow reads a key twice before creating it —
once in `generateUniqueId`, once in `put`'s `onlyIfNew` check — so it primes a
negative-cache entry for exactly the key it is about to write, and the client
then immediately requests that key, because publish-then-share *is* the feature.

`apps/itun/src/lib/snapshot/client.ts` makes this concrete. Its retry policy
(#791) is `TRANSIENT_STATUSES = new Set([502, 504])`, and it excludes 404 with a
written justification: *"not a blip, so retrying 400ms later just asks a store
that has already said no."* That reasoning is true for Netlify Blobs and false
for KV. **Choosing KV would silently invalidate a documented invariant in the
client**, and the failure would reach users as a hard not-found with the retry
deliberately disabled.

**Do not revisit this without re-reading that comment.**

**4. Builds run in GitHub Actions; deploys use `wrangler`.** Workers Builds is
not adopted. `srd` forces this — its build provisions Chromium to render
per-entity OG images — and applying it to all three surfaces keeps one build
path, one place for path filtering, and the existing CI gates in front of every
deploy.

**5. Convex stays, and nothing here may foreclose moving it.** Replacing Convex
with D1 is a separate decision requiring its own ADR. It is materially harder
than this migration — 15 application tables plus `@convex-dev/auth`'s own,
18 function modules across 4,589 lines, Discord OAuth, and 27 `useQuery` call
sites consuming a reactive model that D1 has no equivalent for.

Two constraints follow and are binding on this migration: **snapshots go to R2
and not into Convex**, and the Worker↔Convex boundary stays plain HTTP with a
bearer token. Both keep the option open at no cost today.

**6. Everything runs on the existing `alxjrvs@gmail.com` account.** A dedicated
account was considered and declined.

Cloudflare's isolation boundary is the account — members and roles scope who may
act, not which resources belong to which project, so there is no in-account
"team". A separate account would therefore have been the only way to isolate the
Workers Free quota and to scope the CI token so it could not reach anything else.
Cloudflare also cannot create a second account on the same email, so it would
have meant a second address and an invitation back.

**Correction, 2026-08-18.** This section first claimed the account "holds no
Workers, no KV namespaces, no D1 databases and no `workers.dev` subdomain, so
the per-account Free quota is shared with nothing". **Two-thirds of that was
wrong**, and the error is worth recording because of how it was made: KV and D1
were verified directly (`wrangler kv namespace list`, `wrangler d1 list`, both
empty), the attempt to list Workers was blocked, and "empty" was *inferred* from
the other two rather than checked. An inference was written down in the voice of
a measurement.

What is actually on the account:

- **Two Workers**, `randsum-rdn` (`notation.randsum.dev`) and `randsum-site`
  (`randsum.dev` + one more route) — so `RANDSUM/randsum` is already hosted here.
- **A `workers.dev` subdomain already registered: `alxjrvs.workers.dev`.** There
  is one per account, so this project takes preview URLs under it rather than
  choosing its own name. Renaming it would move RANDSUM's Workers.
- KV and D1 remain empty, as verified.

So the Free quota (100k requests/day, 10 ms CPU) **is** shared, with a project
that is already live. That does not reverse the decision — the traffic on both
sides is far from those ceilings — but it does mean the credential blast radius
under Consequences is a live concern rather than a theoretical one, and it
removes the argument that a dedicated account would isolate nothing.

**R2 is not yet enabled on the account** and must be activated in the dashboard
before P1, P3 or P6 can run. KV and D1 are already available.

**7. A failed gate halts the phase.** No gate is worked around, relaxed, or
retried with different parameters to obtain a pass, and no later phase begins
while an earlier gate is red. With no rollback, an agent or engineer who treats
a red gate as an obstacle converts a caught problem into an unrecoverable one.
This rule exists to be cited.

## Consequences

**The Discord bot will display as permanently offline** in every server. Presence
requires an identified gateway session, which an HTTP-interactions app never has.
It works when invoked. `setPresence` and the `client.guilds.cache.size` liveness
signal both go away; the latter needs rethinking rather than deleting.

**The bot cutover is atomic across every server.** Gateway and HTTP interactions
are mutually exclusive — Discord: *"you can only receive Interactions one of the
two ways"* — and the Interactions Endpoint URL is application-level, not
per-guild. There is no canary and no test guild. Verification is therefore a
signed offline replay harness, not a staged rollout.

**Three CI guards must be ported before the config they read is deleted.**
`tools/check-observability.ts`, `tools/check-bun-version.ts` and
`tools/check-convex-parity.ts` all read `netlify.toml`, and each exists because
of a documented silent-production incident. A fourth,
`tools/check-ci-aggregator.ts`, will correctly fire as jobs are added and removed.

`check-observability.ts`'s `FUNCTION_DIRS` check is a **retirement rather than a
port**: a Worker declares one entry point, so the "every file in a functions
directory is a public endpoint" failure class ceases to exist.

**Module scope on Workers forbids timers, async I/O and randomness.**
`new REST()` throws outright — its constructor registers sweeper timers — and the
failure occurs at startup, not at build. This also applies to any module-scope
observability initialisation.

**Zod's `jitless` configuration becomes load-bearing for the runtime, not only
for CSP.** Zod v4's JIT parser compiles validators with `new Function`, which
workerd bans. `packages/salvageunion-reference/lib/zod.ts` already disables it;
that must not be reverted as an optimisation.

**Removing `@netlify/blobs` retires two standing security suppressions.**
`check:audit` currently ignores `GHSA-w3rx-r6r6-pgpr` and `GHSA-5p2g-fcmc-qvqq`,
both reachable only via `@netlify/blobs → @netlify/dev-utils → image-size`. Once
that dependency is gone, both `--ignore` flags come out and the CLAUDE.md section
documenting them is deleted.

**The CI token's blast radius is the whole personal account** (§6), and that now
includes **two live RANDSUM Workers**. Cloudflare API tokens scope by permission
group and account, so *Workers Scripts: Edit* on this account authorises editing
`randsum-rdn` and `randsum-site` as well as anything this project deploys.
Cloudflare supports per-bucket R2 scoping but not per-Worker scoping, so that
half cannot be narrowed; narrow the R2 half, and do not describe the other half
as contained.

This compounds with an agent PAT carrying `workflow` scope, no required human
review, and pre-authorized `gh pr merge` — the path from "merge a PR" to "deploy
production" closes with no human in it, and the production it can reach is not
only this project's. **Accepted, not solved.** Revisit if RANDSUM's deployments
ever become something this repository must not be able to touch.

**The `workers.dev` subdomain is `alxjrvs.workers.dev`, already registered.**
One per account, so this project takes preview URLs beneath it
(`<worker>.alxjrvs.workers.dev`) rather than choosing its own. Renaming it would
move RANDSUM's Workers and is out of scope.

**Netlify deploy previews disappear** when the sites do. The Workers preview-URL
equivalent must be working beforehand.

**DNS is two zones, not one.** `salvageunion.io` and `intheunionnow.com` are both
on Netlify DNS. Neither carries MX, TXT, DMARC or a DNSSEC DS record, so the two
classic nameserver-migration hazards do not apply here — but both zones move.

**Snapshots published during DNS propagation would otherwise be lost.** This is
not a rollback concern; both origins answer for the length of the TTL regardless.
The plan freezes snapshot writes at a known instant and reconciles a final delta
before the flip.
