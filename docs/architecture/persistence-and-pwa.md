# Account-Required Persistence and the PWA Posture

The executable plan for
[ADR-034](../adrs/ADR-034-account-required-persistence.md) — making Convex the
only source of truth for every persisted record, gating persistence on an
account, and settling both apps as ordinary installable PWAs.

**ADR-034 holds the decisions and their reasoning. This document holds the
sequence, the gates and the progress.**

Drafted against `91a45464` on 2026-08-19. Repository claims below were read from
source, not from prose — every "today" statement names the file it came from so
it can be re-checked rather than believed.

---

## The rule that governs everything else

> **A failed gate halts the phase.**
>
> No gate is worked around or relaxed to obtain a pass. No later phase begins
> while an earlier gate is red.

One addition specific to this plan, because it is the failure mode that would
hurt most:

> **No phase may leave a user's data reachable from fewer places than before it
> ran.** Every phase that touches storage states what happens to a roster that
> exists only in IndexedDB when that phase ships. "It is claimed" and "it stays
> readable" are acceptable answers. "It is gone" is not, at any phase.

---

## Progress

Update this table as part of each phase's PR. It is the only place that answers
"which phase are we on".

| Phase | What                                                      | Reversible | Status      |
| ----- | --------------------------------------------------------- | ---------- | ----------- |
| P0    | Close the DB-backing gaps (patterns, encounter NPCs, log)  | yes        | not started |
| P1    | Test and e2e path that does not depend on Solo             | yes        | not started |
| P2    | In-memory anonymous mode                                   | yes        | not started |
| P3    | Gate persistence on an account                             | **no**     | not started |
| P4    | Demote IndexedDB to a cache                                | **no**     | not started |
| P5    | Claim-on-sign-in coverage and the decline path             | yes        | not started |
| P6    | ITUN install-triggered offline                             | yes        | not started |
| P7    | `srd` install-triggered offline (**blocked on ADR-033 P7**) | yes       | blocked     |

P0–P2 are all reversible and all buy information. P3 and P4 are the one-way
doors and they are deliberately late.

---

## What is not DB-backed today

This is the inventory ADR-034 decision 2 exists to close. Every row was read
from source at `91a45464`.

| Store              | Local writer                          | Convex table       | Mirrored?                                                    |
| ------------------ | ------------------------------------- | ------------------ | ------------------------------------------------------------ |
| `pilots`           | `entityStore`                         | `pilots`           | **yes** — `mirrorWrite`                                       |
| `mechs`            | `entityStore`                         | `mechs`            | **yes** — `mirrorWrite`                                       |
| `crawlers`         | `entityStore`                         | `crawlers`         | **yes** — `mirrorCrawlerWrite`, shelf included since #871     |
| `softLinks`        | `entityStore`                         | `softLinks`        | **yes** — `mirrorSoftLinkWrite`                               |
| `mechPatterns`     | `patternStore` → `db.mechPatterns`    | `mechPatterns`     | **NO** — server rows only ever inserted by `claimLocal`       |
| `encounterNpcs`    | `encounterStore` → `db.encounterNpcs` | `encounterNpcs`    | **NO** — server table written only by `mediator.ts`, disjoint |
| `changeLog`        | `db/changeLog.ts` `append`            | `changeLog`        | **NO** — server rows only from `ownership`/`proposals`/bot    |
| `workspaces`       | retired                               | —                  | n/a — object store survives only so migrations v10/v13 run    |

Three real gaps, and they are not equivalent:

- **`mechPatterns` is a straightforward miss.** The table exists, the shape
  matches, and nothing mirrors. A pattern saved while signed in is lost on any
  other device. Lowest-risk of the three to close.
- **`encounterNpcs` is worse than a miss — it is a name collision.** The client
  store and the Convex table have the same name and hold different things: the
  client's are a local GM tray, the server's are `mediator.ts`'s prepared
  opposition, scoped to a Game. Closing this is a **modelling** job first. Do not
  start by wiring a mirror between two things that are not the same set.
- **`changeLog` is append-only and cross-device ordering is the hard part.**
  ADR-030's amendment already claims the log "is now synchronized". It is not,
  client-side, and that stale claim should be corrected in the same PR that
  fixes it — not before.

**The crawler is the worked example, and it is already done.** #871 made
`crawlers` shelf-able specifically so that a crawler moved out of a deleted Game
lands in Convex rather than in a browser. Use it as the pattern for the three
above: if the schema cannot express where a record needs to live, the schema
moves — the record does not fall back to local-only.

---

## P0 — Close the DB-backing gaps

**Goal.** Every persisted record has a Convex row, before anything changes about
who may persist. Doing this first means P3 does not have to reason about
partially-backed data.

**Work.** Three jobs, and they are not the same size.

- **`mechPatterns` — mirror only.** The table already carries `ownerId` and a
  nullable `gameId`, so the container model is right. It lacks an `appId`, which
  is why `claimLocal` matches a pattern by reading an id out of the opaque body.
  Add `appId` + `by_app_id`, then mirror on the `mirrorWrite` pattern.
- **`encounterNpcs` — the #871 move, verbatim.** The model is settled (ADR-034
  decision 2): one table, two containers. Today it is
  `gameId: v.id('games')` with no `ownerId` — *exactly* the shape `crawlers` had
  before #871. Give it a nullable `gameId`, an `ownerId`, `by_owner`, and an
  `appId`; a Game-scoped NPC keeps `ownerId: null` the way a communal crawler
  does, and a shelf NPC takes an owner. Then fold the client's local tray onto
  it. Read #871's diff before starting — this is the same change twice.
- **`changeLog` — mirror the client appends**, and correct ADR-030's "now
  synchronized" claim in the same PR. Cross-device ordering is the hard part
  here; the log is append-only and keyed by an autoincrement `seq` locally, which
  does not survive being merged with another device's sequence.

**Gate.**

- A signed-in user creating a pattern, an encounter NPC, and an entity edit that
  writes a log entry, on device A, sees all three on device B after a reload.
  Verified by doing it, not by asserting the mirror was called.
- `bun run check:all` green.
- No new local-only store has appeared: a test asserts the set of IndexedDB
  stores that have no Convex counterpart is exactly `{workspaces}`.

That last gate is the one worth keeping forever — it is what stops gap four.

---

## P1 — A test and e2e path that does not depend on Solo

**Goal.** Be able to verify P3 before shipping P3.

**Why it is this early.** CI has no `VITE_CONVEX_URL`
(`src/lib/connection/convexClient.ts` reads it; `connectionMode.ts` returns
`'solo'` when it is absent), so **every Playwright e2e today runs permanently
Solo**, and 15 of the 16 specs build an entity and expect it to persist
(`bundle-budget.e2e.ts` is the exception; it measures bundle size). Removing Solo
without this phase does not fail a test — it fails nearly all of them at once, in
a way that looks like the feature is broken rather than the harness.

**Work.** Two paths, because the suite asks two different questions. Tests that
only need a working app run against the in-memory mode from P2. Tests that
assert *durability* need a signed-in session against a disposable Convex
deployment, with a per-run teardown.

**Gate.**

- The full e2e suite passes with `VITE_CONVEX_URL` set and a signed-in fixture.
- The full e2e suite passes with it unset, exercising in-memory mode.
- At least one e2e asserts durability across a reload — the assertion P3 is
  actually about.
- Teardown verified: a second consecutive run is not polluted by the first.

---

## P2 — In-memory anonymous mode

**Goal.** An anonymous visitor can build a complete pilot, mech and crawler
without writing to any durable store.

**Work.** A backend implementation behind the existing `selectBackend()` seam in
`stores/entityBackend.ts`. That seam is the whole reason this is tractable: the
store's public API, its lazy hydration, its in-memory cache and its broadcast
behaviour do not change, and neither does any component. Add a memory backend;
do not add a second store.

Cross-tab broadcast is deliberately **off** for this backend — two tabs of an
anonymous session are two sessions, because there is nothing durable tying them
together, and pretending otherwise invents exactly the local-only semantics
ADR-034 forbids.

**Gate.**

- With no account, the three wizards complete and render a finished sheet.
- **Nothing is written.** Verified by inspecting IndexedDB after a full anonymous
  session: the database either does not exist or holds no entity rows. This gate
  is the point of the phase; assert absence, not behaviour.
- A reload loses the work, and the UI said it would beforehand.

---

## P3 — Gate persistence on an account

**One-way door.** This is the phase that withdraws ADR-030 §1's guarantee.

**Work.** Save requires a session. The ask arrives at the save, naming what is
being kept — not on load, and not in front of the wizard. Anonymous work
survives the sign-in round trip and is written after it: a user who builds, is
asked to sign in, and signs in must not come back to an empty screen. That
hand-off is the whole risk of this phase.

**The account gate must offer the export escape hatch at the same moment.**
Sign-in is Discord-only and stays that way (ADR-034 decision 1), so this dialog
is a hard wall for anybody without a Discord account. Export is what makes that
acceptable, which means it belongs *in the gate itself* — "sign in to save, or
download it" — not buried on another screen a blocked user has no reason to
visit.

**Gate.**

- Build anonymously → save → sign in → the build is in Convex, complete, once.
- The same flow with sign-in **cancelled** returns the user to their work intact
  and unsaved.
- The same flow with the network dropped mid-sign-in loses nothing.
- No path writes an entity to IndexedDB while signed out.
- **Export is reachable from the account gate**, and the bundle it produces
  imports back cleanly after signing in. Verified round-trip, not just that the
  button exists.
- **The bundle is complete.** A test asserts `buildExportBundle` covers every
  entity kind, and fails when a kind is added without being exported. Today it
  covers pilots, mechs, crawlers, soft links, patterns and encounter NPCs;
  `changeLog` is the open question below.

---

## P4 — Demote IndexedDB to a cache

**One-way door.**

**Work.** Make the demotion true in code rather than in prose: the local store is
populated from Convex and read for speed, and nothing treats it as authoritative.
`writesAllowed()`'s Solo branch goes; `resolveConnectionMode`'s two `'solo'`
returns collapse. Reconciliation is a plain rule — the server wins — because
there is no longer a second writer to conflict with, which is the entire benefit
being bought.

**Gate.**

- Clearing site data and reloading, signed in, restores the full roster from
  Convex.
- A row present locally and absent server-side does not survive a reload. This is
  the assertion that IndexedDB is a cache; it should feel uncomfortable and it
  should pass.
- `bun run check:all` green, and the `apps/itun` coverage ratchet is not
  regressed.

---

## P5 — Claim-on-sign-in coverage and the decline path

**Goal.** Nobody's existing local roster is stranded.

**Work.** `ClaimLocalData` and `entities.claimLocal` already do the core of this,
already offered-not-automatic, and already idempotent — `claimLocal` skips what
it already holds, so re-claiming is a no-op. Two things are missing. It must
cover **everything** P0 made mirrorable, including patterns and the log. And
**declining must be survivable**: today declining leaves a full local roster
beside an empty account, which after P4 is a roster the app no longer reads.

**The decline path is settled: offer the export hard, then stop asking.** A user
who declines the claim is pushed to download a bundle, and after that the app
does not raise it again. This is the least-nagging option and it was chosen
knowing its edge — somebody who declines, does not export, and later clears
their browser storage has genuinely lost that roster.

That edge is what the gate below closes. **"Offered" is not enough; the app may
only stop asking once an export has actually been produced, or the user has
explicitly refused the export too.** A decline dialog that quietly counts as
"asked" and moves on is the failure mode this phase exists to prevent.

**Gate.**

- A pre-ADR-030 IndexedDB fixture claims completely: pilots, mechs, crawlers,
  soft links, patterns, encounter NPCs, log entries, with counts asserted per
  kind.
- Claiming twice produces no duplicates (already covered by an existing test —
  extend it to the new kinds rather than writing a second one).
- Declining, then reloading, then accepting, still claims everything — declining
  must not be sticky against a later change of mind, only against being nagged.
- **Declining without exporting does not silence the prompt.** The app keeps
  asking until a bundle is produced or the export is explicitly refused.
- The data is never deleted by any path in this phase.

---

## P6 — ITUN install-triggered offline

**Goal.** Deliver ADR-034 decision 3 for ITUN: installable, and installed means
offline-capable in full.

**Work.** ITUN is already installable and already precaches its shell. What is
missing is the *account data* half: an installed app should hold the signed-in
user's own roster for offline reading. Detection is by installed state
(`display-mode: standalone`, `appinstalled`), not by visit count.

`registerType: 'prompt'` **does not change**, for the reason ADR-034 gives.
`chunkRecovery.ts` stays as the backstop.

**Gate.**

- Installed, then offline: the roster opens and reads.
- **Browser tab, online: no bulk download.** Measured against the existing
  bundle-budget e2e, so a regression here fails an existing gate rather than
  needing a new one.
- Offline is read-only, and says so — the ADR-030 rule is unchanged.

---

## P7 — `srd` install-triggered offline

**Blocked on [ADR-033](../adrs/ADR-033-cloudflare-hosting.md) P7.**
`salvageunion.io` is still on Netlify pending support ticket #1093312. Changing
service-worker behaviour mid-host-move makes any failure ambiguous between two
causes, and a bad service worker outlives the deploy that caused it.

**Work.** `srd` is already installable (`site.webmanifest`, 192/512 icons,
`ssg/pwa.ts` workbox worker). The gap is that `navigateFallback: null` and a
`globPatterns` of js/css/woff2/svg mean an unvisited page 404s offline — correct
for a browser visitor, wrong for an installed app.

Add an install-triggered fetch of the reference set. Prefer the **899 JSON
endpoints** over 1,039 HTML pages if measurement supports it: the endpoints
already exist, they are what the search index reads, and they are far smaller
than rendered HTML.

**Gate.**

- Measure first. The install-time payload is written into this document before
  the code ships, with a stated ceiling. **An unmeasured "download everything"
  does not pass**; a worse-than-404 experience is a real possible outcome.
- Installed, then offline: an unvisited entity page renders.
- Browser tab, online: byte-for-byte the same network profile as today.
  `ssg/snapshot.ts` must be green, and any change to the emitted file set is
  re-blessed deliberately with the diff read.

---

## Resolved (2026-08-19)

The four questions this plan opened with are answered. Recorded here with the
phase each one unblocks, so a reader does not have to reconstruct them from the
ADR.

1. **Declining the claim → offer the export hard, then stop asking.** Unblocks
   P5, and is why that phase's gate insists the export be *taken* rather than
   merely offered.
2. **Anonymous users get export to file.** Unblocks P3, and it is what makes a
   Discord-only gate defensible rather than a wall.
3. **`encounterNpcs` is one table with two containers** — the #871 crawler move
   applied again. Unblocks P0.
4. **Discord stays the only sign-in provider.** Unblocks P3. The exclusion is
   real and accepted: no Discord account means no saving, mitigated only by (2).

## Still open

One, and it is new — it follows from (1) and (2) both resting on export.

1. **Does the export bundle need to carry the Change Log?** `buildExportBundle`
   covers pilots, mechs, crawlers, soft links, patterns and encounter NPCs, and
   **not `changeLog`**. Harmless while export was a backup; not obviously
   harmless now that it is the way out. The log is provenance rather than the
   build itself, so dropping it may well be right — but it should be decided out
   loud. **Needed before P3**, since that is where export becomes a promise.
