# Cloudflare Cutover

The executable plan for [ADR-033](../adrs/ADR-033-cloudflare-hosting.md) —
retiring Netlify and Render in favour of Cloudflare Workers, R2 and Workers
Static Assets. Hard cutover, no rollback. Convex stays.

**ADR-033 holds the decisions and their reasoning. This document holds the
sequence, the gates and the progress.** Supersedes issue #830, which remains open
for discussion history and should not be executed from.

Drafted against `1366cfdf` on 2026-08-18. Cloudflare and Discord platform limits
verified against vendor documentation on that date; repository claims read from
source.

---

## The rule that governs everything else

> **A failed gate halts the phase.**
>
> No gate is worked around, relaxed, or retried with different parameters to
> obtain a pass. No later phase begins while an earlier gate is red. Report the
> failure and stop.

There is no rollback. Every gate below is written so that it can fail, and a gate
that cannot fail is not a gate. If a gate looks wrong, change it in a PR and say
why — do not route around it in the moment.

---

## Progress

Update this table as part of each phase's PR. It is the only place that answers
"which phase are we on".

| Phase | What                                     | Reversible | Status                    |
| ----- | ---------------------------------------- | ---------- | ------------------------- |
| P0    | Port the CI guards                       | yes        | not started               |
| P1    | Export `lp-assets`, restore ingest tool  | blocking   | not started               |
| P2    | Measure the bot on real workerd          | throwaway  | **passed** — see Appendix |
| P3    | R2 `SnapshotStorage`                     | yes        | not started               |
| P4    | Three web surfaces on `workers.dev`      | yes        | not started               |
| P5    | Bot on HTTP interactions                 | until flip | not started               |
| P6    | Data sync and write freeze               | **no**     | not started               |
| P7    | Cutover                                  | **no**     | not started               |
| P8    | Decommission and tooling cleanup         | **no**     | not started               |

**Blocked on a human decision:** the dedicated Cloudflare account (D5 below)
blocks P4, because the `workers.dev` subdomain is account-scoped and effectively
permanent.

---

## Measured facts

Do not re-derive these; do re-verify them if more than a release cycle has
passed. The probe that produced them is in the Appendix.

| Quantity                             | Measured                | Free limit | Used   |
| ------------------------------------ | ----------------------- | ---------- | ------ |
| Worker size, compressed              | 549.6 KiB               | 3 MB       | 18%    |
| Worker size, uncompressed            | 3,061 KiB               | 64 MB      | 5%     |
| Startup, reported by Cloudflare      | **141 ms**              | 1,000 ms   | 14%    |
| Startup, local workerd               | 28–32 ms (4 cold starts)| —          | —      |
| Warm request CPU                     | below timer resolution  | 10 ms      | —      |
| `preload('all')` under Bun           | 81.6 ms                 | —          | —      |
| All 27 data JSON files, gzipped      | 268 KB                  | —          | —      |
| Workers Free requests / subrequests  | —                       | 100k/day · 50 | —   |
| KV global propagation                | up to 60 s              | —          | —      |

Cloudflare's 3 MB Worker limit is measured **after compression**; the
uncompressed ceiling is 64 MB and is not a constraint here.

Workers freeze `Date.now()` between I/O as a Spectre mitigation, so per-request
CPU cannot be timed from inside a Worker. The authoritative reading is
`cpuTime` from `wrangler tail` against a deployed Worker.

---

## Phases

### P0 — Port the CI guards · reversible · ½ day

Three tools read `netlify.toml`, and each exists because of a documented
silent-production incident. A hard cutover deletes that file, so they are ported
**first**, not during.

- `tools/check-observability.ts` — CSP `connect-src` per browser app. It also
  carries a `netlifyBundled` flag per surface and a hardcoded `FUNCTION_DIRS`.
- `tools/check-bun-version.ts` — the `BUN_VERSION` pin.
- `tools/check-convex-parity.ts` — asserts the build command refuses to ship
  without `CONVEX_DEPLOY_KEY`. That command moves into Actions, making this the
  sharpest of the three.

`FUNCTION_DIRS` is a **retirement, not a port** — a Worker declares one entry
point, so the failure class it guards ceases to exist. Delete it deliberately,
with the reason recorded in the diff.

`tools/check-ci-aggregator.ts` (#812) fails when a job is missing from the
`quality-checks` aggregate's `needs:`. It will fire as jobs change. That is
correct; do not suppress it.

**Gate**

- [ ] `bun run check:all` green with both a `netlify.toml` and a `wrangler.jsonc`
      present.
- [ ] Each ported guard is demonstrated to **fail** when its asserted property is
      removed. Test the guard, not just the run.
- [ ] The `FUNCTION_DIRS` deletion carries a comment explaining why the class is
      gone.

### P1 — Export `lp-assets` and restore its ingest tool · blocking · 1 day

Do this whether or not the migration proceeds. It depends on no other decision.

Once Netlify is gone, R2 becomes the only copy of licensed artwork that cannot
enter this repository. An export gives a second.

- Restore `tools/upload-lp-assets.ts` from `8b678bbd` — it is the restore path.
- Write `tools/export-lp-assets.ts` as its mirror.
  `tools/convert-lp-assets-to-webp.ts` already has the scaffold:
  `netlify blobs:list lp-assets --json` → keys → `blobs:get`.
- Store the export encrypted, off Netlify, outside this repository.

**Gate**

- [ ] Export object count equals the `blobs:list` manifest count.
- [ ] Every key's SHA-256 matches a fresh re-download. Not a spot check.
- [ ] A restore has been rehearsed into a throwaway store and verified by the
      same hash comparison.
- [ ] The export lives somewhere durable and access-controlled that is neither
      Netlify nor this repository.

### P2 — Measure the bot on real workerd · throwaway · **passed**

Ran 2026-08-18. See Measured facts and the Appendix. Cloudflare's deploy-time
startup enforcement accepted the probe at 141 ms; the probe was deleted
afterwards.

Four constraints surfaced that Phase 5 must honour:

1. **Module scope forbids timers, async I/O and randomness.** `new REST()` throws
   with *"Disallowed operation called within global scope"* — its constructor
   registers sweeper timers. Construct it lazily inside the handler. This also
   applies to module-scope `initObservability()`.
2. **`ButtonStyle` is exported by `discord-api-types`, not `@discordjs/builders`.**
   The import rewrite is not a pure name-for-name swap.
3. **Zod's `jitless` config is load-bearing for Workers**, not only for CSP.
4. **Top-level `await` works at module scope**, which is what allows the preload
   to be charged against the 1 s startup budget instead of the 10 ms request
   budget.

**Residual, deferred to P5:** per-request `cpuTime` read from `wrangler tail`
against a deployed Worker carrying the real command handlers.

### P3 — R2 `SnapshotStorage` · reversible · ½ day

`SnapshotStorage` is three methods with two existing implementations, so this is
a drop-in third. Run the **existing**
`apps/itun/netlify/functions/__tests__/snapshot.test.ts` against it by swapping
the injected storage — the suite becomes a conformance suite at no cost.

Then add the test that justifies ADR-033 §3: publish, immediately retrieve, from
a different colo. Run it against both R2 and KV.

Revisit the rate limiter here. It is a module-scope `RateLimiter{10/min}` keyed
on `x-nf-client-connection-ip`, already approximate, behind an enforced 256 KB
payload cap. It is decorative. Either drop it and rely on the cap, or use
Cloudflare's Rate Limiting binding. **Do not port the in-process version** — it
would look like a control without being one.

**Gate**

- [ ] The existing snapshot suite passes **unmodified** against the R2
      implementation.
- [ ] Publish → immediate retrieve returns 200 from a different colo, 20
      consecutive runs.
- [ ] The same test against KV is observed to fail, or ADR-033 §3 is revisited on
      the evidence.
- [ ] A decision on the rate limiter is recorded either way.

### P4 — Three web surfaces on `workers.dev` · reversible · 2 days

**Blocked on D5** (the dedicated Cloudflare account) — the `workers.dev`
subdomain is account-scoped and effectively permanent.

Everything except DNS runs in parallel with production, at zero customer
exposure. This is the acceptance gate for the whole migration.

Two enabling changes first, each worth landing on its own:

- `ASSET_BASE_URL` (`packages/salvageunion-reference/lib/assets.ts`) is a
  compile-time constant. Make it env-overridable, or the artwork path cannot be
  exercised end-to-end on `workers.dev`.
- `apps/srd/playwright.config.ts` hardcodes `localhost:4321`. Give it the
  `E2E_BASE_URL` support `apps/itun` already has.

The routing table must be ported **in order**. Order is load-bearing at four
points, each with an incident behind it:

1. Retired-URL 301 — `/sheet/:kind/:id/share` → the sheet (#797).
2. The four method-conditioned `/api/snapshots` rules, which become `req.method`
   switching inside the Worker.
3. `/assets/*` → **404**, never 200.
4. SPA fallback.

> `not_found_handling: "single-page-application"` answers **200** for a missing
> hashed chunk, silently reintroducing the #759 cache-poisoning bug. `/assets/*`
> must be handled Worker-first, and the curl assertion below is the only thing
> that proves it.

**Gate**

- [ ] `bun --filter srd gate` clean against Cloudflare-served output — 1,039
      pages and 899 endpoints compared byte-for-byte.
- [ ] Both Playwright suites green against `workers.dev` via `E2E_BASE_URL`.
- [ ] curl: a real hashed chunk returns 200 `application/javascript`; a missing
      one returns **404, not 200**; `/`, `/s/<id>` and `/p/pilot/<id>` return 200
      HTML.
- [ ] All **three** header sets served correctly, including `su-assets`' (#778) —
      verified by response, not by reading config.
- [ ] The four redirect rules resolve in the documented order.

### P5 — Bot on HTTP interactions · reversible until flip · 3 days

Write one adapter satisfying the three types in `commands/interactions.ts` over
`@discordjs/builders` + `@discordjs/rest`. The gateway half of `discord.js` does
not run on workerd; the rest is portable. `index.ts` and `events/ready.ts` are
the only genuinely gateway-bound modules.

Port items:

- `interaction.client.user?.displayAvatarURL()` (`buttons.ts`, `itunReply.ts`)
  reads the bot's own user from the gateway cache. Hardcode or fetch once.
- `EmbedBuilder` instances passed as `embeds: [embed]` need `.toJSON()`.
- Every deferred command (`game.ts`, `itunReply.ts`) needs `ctx.waitUntil()`.
- `getClientIp()`'s `x-nf-client-connection-ip` becomes `CF-Connecting-IP`.
- Everything in P2's constraint list.

> The cutover is **atomic across every server**. Gateway and HTTP interactions are
> mutually exclusive and the Interactions Endpoint URL is application-level, not
> per-guild. There is no canary, no percentage rollout and no test guild.

**Gate**

- [ ] A signed replay harness passes for every command shape in a corpus
      harvested from the live bot. Ed25519 keypair generated locally; no second
      Discord application.
- [ ] Deferred commands acknowledge inside Discord's 3-second window and complete
      via `waitUntil`.
- [ ] Embed payloads diff clean against the JSON the gateway bot produces for the
      same input.
- [ ] `cpuTime` from `wrangler tail` is under 10 ms for every command shape.
- [ ] Server admins have been told the bot will display permanently offline.

### P6 — Data sync and write freeze · **irreversible** · ½ day

Two stores move, and writes landing on Netlify after the final sync are lost.

- Seed R2 artwork from the P1 export. Reconcile by count and per-key SHA-256.
- Copy the `snapshots` store to R2. Reconcile by count and payload hash.
- Ship a Netlify build where `POST` and `DELETE /api/snapshots` return 503, so
  writes stop at a known instant while reads keep working from both origins.
- Run a final delta sync.

**Gate**

- [ ] R2 artwork object count and every per-key hash match the manifest.
- [ ] Snapshot count matches and payload hashes match.
- [ ] `POST /api/snapshots` observed returning 503 in production.
- [ ] The final delta sync reconciles to **zero** objects, verified after the
      freeze rather than before.

### P7 — Cutover · **irreversible** · 1 hour + propagation

DNS propagation is not a rollback window, it is a physics window. Both origins
answer for the length of the TTL, so the Netlify sites must keep serving until
propagation completes — deleting them at the moment of the flip is strictly
worse, because resolvers holding old records get errors rather than a
stale-but-working site.

| When   | Step                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------- |
| −48 h  | Reduce TTLs on both zones to 300 s. Confirm the reduction has propagated.                                                   |
| −2 h   | Transcribe every record in both zones into Cloudflare, grey-cloud. Diff against `dig` by hand — the auto-scan misses CNAMEs. |
| −1 h   | Execute P6.                                                                                                                 |
| 0      | Flip nameservers on `salvageunion.io`. This moves `srd` and `assets.salvageunion.io` together, because `ASSET_BASE_URL` is compile-time. |
| +15 m  | Verify from multiple resolvers. Re-run the P4 curl assertions against real hostnames, including the missing-chunk 404.       |
| +30 m  | Flip nameservers on `intheunionnow.com`. Re-run the itun Playwright suite against production.                               |
| +1 h   | Lift the snapshot write freeze once both origins resolve to Cloudflare.                                                     |
| +2 h   | Set the Discord Interactions Endpoint URL. Verify PING/PONG, then one command of each shape in a real server.               |
| +24 h  | Proxy (orange-cloud) once verified. Raise TTLs back.                                                                        |

**Gate**

- [ ] Every gate P0–P6 green, recorded and dated in the Progress table.
- [ ] TTLs reduced at least 48 h prior and observed in effect.
- [ ] Every record in both zones transcribed by hand and diffed against `dig`.
- [ ] All open decisions below are closed.

### P8 — Decommission and tooling cleanup · **irreversible**

Only after P7 has been stable for 24 h.

- Delete the three Netlify sites and the Render service.
- `.mcp.json`: remove `netlify` and `render`; add
  `https://bindings.mcp.cloudflare.com/mcp` and
  `https://observability.mcp.cloudflare.com/mcp`. Both authenticate by OAuth on
  first connect, so **`.mcp.json` stays secret-free** — #291 removed `${VAR}`
  placeholders deliberately; do not reintroduce them. Keep `convex`.
- Add one project skill, `/cloudflare-deploy-verify`, the sibling of
  `/convex-deploy-verify`. **One, not a suite** — the repository's bar is that a
  skill encodes a decision procedure or a silent failure mode, never frontmatter
  around a command, and six wrapper skills were deleted for failing that test.
  The four qualifying failure modes are P4's 200-vs-404 trap, P2's module-scope
  restriction, ADR-033 §3's KV consistency trap, and redirect ordering.
- Port or delete `tools/convert-lp-assets-to-webp.ts` and
  `tools/upload-lp-assets.ts`. **Not before P1's export is verified.**
- Remove `@netlify/blobs`, then delete both `--ignore` flags from `check:audit`
  and the CLAUDE.md section documenting them.
- Update CLAUDE.md, `docs/README.md` and
  [`agent-tooling.md`](agent-tooling.md) to describe Cloudflare.

**Gate**

- [ ] `bun run check:all` green with no `netlify.toml` anywhere in the tree.
- [ ] `claude mcp list` shows the Cloudflare servers connected — zero tool calls
      means "broken or unused" and the two are indistinguishable from usage data
      alone.
- [ ] `bun audit --audit-level=high` passes with **no** `--ignore` flags.
- [ ] No document still describes Netlify or Render as a host.

**30 days after P7:** audit skills by counted invocation — `"skill": "<name>:` in
the session transcripts — not by intuition; a skill's own prompt injection makes
it look ubiquitous. Anything at zero goes.

---

## Credentials

Today Netlify holds its own build credentials and this repository holds **no
deploy credentials at all**. Building in Actions means CI holds a token that can
deploy production, alongside an agent PAT with `workflow` scope, no required human
review, and pre-authorized `gh pr merge`.

Minimum bar before P4 ships to any real hostname:

- A Cloudflare API token scoped to *Workers Scripts: Edit* and the specific R2
  buckets **in the dedicated account** — never an account-global token, and never
  a token on the personal account.
- Stored as an Actions secret. Never in `wrangler.jsonc`, never in a `.env` git
  can see.
- Deploy steps gated on the `quality-checks` aggregate, so a red gate cannot
  deploy.
- D3 below decides whether production deploys additionally require an environment
  approval.

---

## Open decisions

| #   | Decision                                                                          | Blocks    | Default if unanswered          |
| --- | --------------------------------------------------------------------------------- | --------- | ------------------------------ |
| D1  | Netlify account plan type — credit-based plans fail hard rather than billing over | nothing   | closeable with an account read |
| D2  | Snapshot write freeze, or accept losing links published during propagation?       | P6        | freeze — it costs minutes      |
| D3  | Do production deploys require environment approval, or does a green gate suffice? | P4        | green gate suffices            |
| D4  | Announce the bot's permanent-offline display before the flip, or after?           | P5 gate   | before                         |
| D5  | Dedicated Cloudflare account — name and owning email                              | **P4**    | none; must be answered         |

**Closed by audit.** `lp-assets` has no backup and its ingest tool was deleted, so
P1 grows rather than shrinks. The snapshot rate limit is decorative. The bot is
independent of the web surfaces and P2 settled it on measured evidence.

**On D5:** Cloudflare cannot create a second account on the same email from the
dashboard. A dedicated account is registered under a different address, then
`alxjrvs@gmail.com` is invited as Super Administrator and it appears in the
normal account switcher.

---

## Accepted risks

- **No rollback**, chosen deliberately. Every gate is load-bearing.
- **The bot displays permanently offline** in every server.
- **Netlify deploy previews disappear** when the sites do.
- **Sentry liveness telemetry changes shape** — `client.guilds.cache.size` does
  not exist under HTTP interactions.
- **This document will drift.** #830's premises drifted twice — once at
  authoring, once within a day of the audit. Re-verify against `main` before
  executing any phase.

---

## Follow-up: Convex → D1

Out of scope, with its own future ADR. Sized here only because the constraint it
places on this migration is binding today.

| Surface                                 | Size                              |
| --------------------------------------- | --------------------------------- |
| Application tables                      | 15                                |
| Auth tables from `@convex-dev/auth`     | 6 (approx.)                       |
| Function modules / total LOC            | 18 · 4,589                        |
| Client reactive call sites              | 27 `useQuery` · 27 `useMutation`  |
| Files importing `convex/react`          | 20                                |

Schema translation to SQLite is the easy part. Three things are not:

1. **Reactivity.** D1 has no subscriptions. ADR-030 identifies the reactive model
   as the actual product feature and 27 call sites consume it. Cloudflare's answer
   is Durable Objects with hibernating WebSockets, or polling — the first is a
   real design exercise, the second is a product downgrade.
2. **Auth.** Discord OAuth terminates on Convex via `@convex-dev/auth`. Replacing
   it means owning the OAuth flow, session issuance and refresh, plus the
   `authAccounts` lookup the Discord bot uses to resolve a snowflake to a user.
3. **Transactions.** Convex mutations are serializable by default; invariants the
   platform currently guarantees would have to become explicit.

**Binding on this migration** (ADR-033 §5): snapshots go to R2 and not into
Convex, and the Worker↔Convex boundary stays plain HTTP with a bearer token.

---

## Appendix — the P2 probe

Deliberately **not** committed as a tool. It is a throwaway that answered a
question, and keeping it as a permanent `tools/` entry would create maintenance
surface — typecheck, knip and lint would all want to own a file whose runtime is
workerd rather than Bun. Recorded here so it is reproducible instead.

`wrangler.jsonc`:

```jsonc
{
  "name": "su-p2-throwaway-probe",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-13"
}
```

`src/index.ts` — imports the reference corpus and the portable Discord
dependencies the command layer actually uses, preloads at module scope, and
returns a lookup:

```ts
import { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder } from '@discordjs/builders'
import { Collection } from '@discordjs/collection'
import { REST } from '@discordjs/rest'
import { MessageFlags, InteractionResponseType, ButtonStyle } from 'discord-api-types/v10'
import { SalvageUnionReference } from '<abs path>/packages/salvageunion-reference/lib/index.ts'

const t0 = Date.now()
await SalvageUnionReference.preload('all')
const startupPreloadMs = Date.now() - t0

// REST must NOT be constructed at module scope — its constructor registers
// sweeper timers, which workerd forbids in global scope.
let rest: REST | null = null
const getRest = () => (rest ??= new REST({ version: '10' }))

export default {
  async fetch(): Promise<Response> {
    const chassis = SalvageUnionReference.Chassis.all()
    const embed = new EmbedBuilder().setTitle(chassis[0]?.name ?? 'none')
    return Response.json({ startupPreloadMs, chassisCount: chassis.length })
  },
}
```

Run:

```bash
bunx wrangler deploy --dry-run --outdir=dist   # bundle size, no account needed
bunx wrangler dev --port 8799                  # real workerd, locally
bunx wrangler deploy                           # prints "Worker Startup Time: N ms"
bunx wrangler delete --name su-p2-throwaway-probe --force
```

`wrangler deploy` is the authoritative startup measurement: Cloudflare enforces
the startup budget at deploy time and reports the figure on success. Do not
register a `workers.dev` subdomain to route a probe — that name is account-scoped
and effectively permanent (see D5).
