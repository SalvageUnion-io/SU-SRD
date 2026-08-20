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
| P0    | Make every container model expressible (schema only)       | yes        | **done**    |
| P1    | Test and e2e path that does not depend on Solo             | yes        | **provider done** — fixture with P3 |
| P2    | In-memory anonymous mode (backend built, flag OFF)         | yes        | **done**    |
| P3    | Gate persistence on an account (mechanism; flip deferred)  | yes        | **done**    |
| P4    | Demote IndexedDB to a cache (**read path done**; prune + mirror removal await the flip) | **no** | part done |
| P5    | Claim-on-sign-in coverage and the decline path             | yes        | **done**    |
| —     | **The flip** — account required in production, legacy-guarded | **no**   | **done**    |
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

## P0 — Make every container model expressible (schema only)

**Goal.** Every store has a Convex shape that can hold what it needs to hold, so
that later phases are wiring and nothing else.

**Why this phase carries no wiring.** The obvious move is to mirror the three
un-backed stores the way `entityStore` mirrors the other four. That is the wrong
shape, and it is wrong for the reason ADR-034 decision 2 gives: **a mirror is a
bridge that exists only because Solo exists.** It upserts because a Solo entity
has no server row yet, and it is fire-and-forget because the local write has
already succeeded and is what the UI reads. Both properties are indefensible once
the local store is a cache — a cache cannot be ahead, so a refused write must
fail the user's action rather than become a console warning.

Building two new mirrors here would ship a known-lossy path into two stores *as
their fix*, and then delete it at P4. The schema work below is needed under any
sequencing and is not throwaway; the wiring waits and is written once.

**Work.** Three jobs, and they are not the same size.

- **`encounterNpcs` — the #871 move, verbatim.** The model is settled (ADR-034
  decision 2): one table, two containers. Today it is `gameId: v.id('games')`
  with no `ownerId` — *exactly* the shape `crawlers` had before #871. Give it a
  nullable `gameId`, an `ownerId` and a `by_owner` index; a Game-scoped NPC keeps
  `ownerId: null` the way a communal crawler does, and a shelf NPC takes an
  owner. Read #871's diff before starting — this is the same change twice.
- **`mechPatterns` — nothing to do.** It already carries `ownerId` and a nullable
  `gameId`, so its container model is already right. It has no `appId`, which is
  why `claimLocal` matches a pattern by digging an id out of the opaque body —
  but `appId` is part of the mirror bridge, so it is **not** added here. If the
  wiring at P4 needs client-minted ids at all, that is the phase to decide it in.
- **`changeLog` — decide the ordering rule, write it down, build nothing.**
  Done, below: `seq` does not travel, `ts` does, and the append-only log
  interleaves rather than conflicts. **No schema change proved necessary** — both
  sides already carry `ts` and neither server row carries `seq`. Correct
  ADR-030's "now synchronized" claim in the same PR as the wiring.

### The Change Log ordering rule

Written down here because it is the design question P4 would otherwise discover
late. **No schema change is needed — the model already turned out to be right**,
which was worth checking before proposing one.

- **`seq` does not travel.** It is the IndexedDB autoincrement primary key, and
  its doc comment calls it "the total order" — true on one device and meaningless
  across two, since each device numbers from its own 1. It is a *storage* key,
  not part of the record. It is never sent, never received, and is re-assigned by
  the local store when the cache is filled.
- **`ts` travels, and it is already on both sides.** The local entry carries
  `ts` (epoch ms at write time) and so does the Convex row. That is when the
  change actually happened, on the device that made it.
- **Order for display by `ts`; paginate and reconcile by Convex's
  `_creationTime`.** They answer different questions. `ts` is when the player did
  it; `_creationTime` is when the server heard about it, and it is the only
  monotonic server-assigned value, so it is the one a cursor can trust.
- **The two disagreeing is expected, not a bug.** A device that was offline for
  an hour lands entries whose `ts` precedes rows already stored. Because the log
  is **append-only and every entry immutable**, that is *interleaving* — there is
  nothing to merge, only to sort. This is the whole reason the log is the easy
  one of the three gaps despite looking like the hard one.
- **`ts` is unauthenticated client input and must never be trusted for anything
  but display order.** A wrong device clock — or a hostile one — puts an entry
  anywhere in the sequence. It must not drive authorization, cursors, or
  supersession (`supersededBy` is an explicit pointer precisely so ordering never
  has to imply it).

**Gate.**

- Every IndexedDB store has a Convex table whose columns can express the same
  containers. Asserted by a test over the two schemas, not by reading them.
- No new local-only store has appeared: a test asserts the set of IndexedDB
  stores with no Convex counterpart is exactly `{workspaces}`.
- The `changeLog` ordering rule is written down and reviewed.
- `bun run check:all` green.

The second gate is the one worth keeping forever — it is what stops gap four.

**Note what this phase deliberately does NOT fix.** Patterns, encounter NPCs and
log entries still do not reach the server when it ends. That divergence is live
today and stays live until P4. It is accepted because the alternative is two
throwaway lossy bridges, and because the exposure is narrow: those records are on
the user's device, they are covered by the export bundle, and nothing deletes
them. If that judgement is wrong, the thing to change is the phase *order* — do
the demotion sooner — not to add the mirrors back.

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

**Work.** Two paths, because the suite asks two different questions — and they
turn out to be in very different states.

**Server-side durability is already solved and needs nothing.** The
`test/convex/*` suite runs on `convex-test` with `t.withIdentity({ subject })`,
so a signed-in user's mutations are exercised today with no deployment, no
credentials and no network. Anything of the form "does this write reach Convex
and come back" can be asserted there, and that is most of what P3 and P4 change.

**Browser-level e2e with an account is blocked**, and it is blocked by a
decision rather than by effort. Sign-in is **Discord OAuth and nothing else**
(ADR-034 decision 1), so there is no scriptable credential a Playwright fixture
could use — and confirmed by reading the suite, **no e2e file authenticates at
all today**. Nothing in the repo has ever needed to, because everything ran Solo.

### The decision P1 needed — **taken: option 1, a test-only auth provider**

Chosen because it is the only one of the three that covers P3's actual risk: the
anonymous-build → sign-in → save hand-off, end to end, in a browser. The two
cheaper routes leave exactly that untested, and it is the step most likely to
lose somebody's work.

**It is an auth bypass, so it is gated like one.** The provider is live only
under a test flag, and a test asserts a production-shaped build does not expose
it — asserted, not commented. If that gate cannot be made to fail convincingly,
fall back to option 3 rather than shipping an ungated second door.

The alternatives, kept because the reasoning matters if this is ever revisited:

1. **A test-only auth provider.** (chosen) Add Convex Auth's Password provider, enabled
   only when a test flag is set. Cheapest to write and the most conventional.
   The risk is obvious and must be gated hard: a second door into every account
   if it is ever live in production.
2. **A test-only session mint.** An internal mutation that issues a session for
   a seeded user, reachable only from a test build. Narrower than a whole
   provider, but it is still an auth bypass and wants the same care.
3. **Accept the split.** Browser e2e covers the anonymous path only; durability
   is asserted in `convex-test` and never in a browser. Costs nothing and adds
   no bypass — the honest cost is that the sign-in-then-save hand-off, which is
   exactly what P3 risks getting wrong, would have no end-to-end test.

Option 3 is the status quo made explicit and is defensible; option 1 is the one
that actually covers P3's risk, and is what was chosen.

**Status.** The provider and its production gate are built (#874). The Playwright
fixture that *uses* it lands with P3, because until the account gate exists there
is no sign-in flow for a fixture to drive — a fixture that signed in and did
nothing would assert nothing.

**Gate.** Depends on which option above is chosen. Under 1 or 2:

- The full e2e suite passes with `VITE_CONVEX_URL` set and a signed-in fixture.
- The full e2e suite passes with it unset, exercising in-memory mode.
- At least one e2e asserts durability across a reload — the assertion P3 is
  actually about.
- Teardown verified: a second consecutive run is not polluted by the first.
- **The bypass cannot reach production.** Asserted by a test, not by a comment:
  a production-shaped build must not expose the provider or the mutation.

Under option 3, the gate is smaller and honest about what it does not cover:

- The full e2e suite passes with `VITE_CONVEX_URL` unset, exercising in-memory
  mode.
- Durability is asserted in `test/convex/*` for every store P4 rewires.
- The sign-in-then-save hand-off is covered by unit and component tests, and the
  plan records that it has no end-to-end coverage.

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

**Ships behind `VITE_REQUIRE_ACCOUNT`, default off.** That is what keeps this
phase reversible, as the table claims: the backend exists and is selectable, but
an anonymous visitor still gets Solo until P3 flips it and adds the UI that
explains what is happening. A backend nobody is routed to yet cannot strand
anyone.

**Gate.**

- The memory store satisfies the same CRUD contract as the IDB store — id and
  timestamps minted on create, `updatedAt` bumped, id immutable through a patch,
  update on a missing id throws, delete a silent no-op, `list()` newest-first,
  strict Zod on every write. Asserted case by case, because `entityStore` is
  written against that contract and must not learn which backend it has.
- **Nothing can be written.** Asserted against the module *source*: it imports
  no `idb`, and names neither `indexedDB` nor `localStorage` nor
  `sessionStorage`. Behaviour can be right today and one refactor from wrong;
  this is the assertion that does not rot.
- Two stores share nothing — an anonymous session is per tab, which is also why
  `entityStore` routes every broadcast through a guard that no-ops for this
  backend.
- **The flag is still off.** A test asserts `backendForMode('solo', false)` is
  `'local'` and that `selectBackend()` agrees, so opening the one-way door by
  accident fails a test.
- The flag changes nothing for a signed-in user: `connected` stays `remote` and
  `disconnected` stays `blocked` under both flag values.

**Deferred to P3 deliberately:** the wizards-complete-anonymously and
reload-loses-the-work checks, which need the flag on and the UI that warns
first. Asserting them now would mean shipping the gate with no way to explain it.

---

## P3 — Gate persistence on an account

**Deliberately NOT the one-way door any more — the plan was wrong about this.**

As written, P3 both built the gate and flipped the switch. Trying to execute it
surfaced the problem: flipping the switch routes anonymous users to the memory
backend, and **an existing Solo user's IndexedDB roster then stops being read**.
That breaks this plan's own rule that no phase may leave data reachable from
fewer places than before it ran — and it breaks it *before* P5, which is the
phase that gives those users a claim path.

So P3 is split. This phase builds the whole mechanism — gate, promotion, and the
stores that still wrote durably while signed out — and leaves
`VITE_REQUIRE_ACCOUNT` **off**. The flip becomes its own small, deliberate layer
**after P5**, when there is a claim path for every existing roster to take.

That is strictly safer and costs nothing: a mechanism nobody is routed to yet
cannot strand anyone, and the flip is then one line whose blast radius is
obvious.

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

**One-way door — and it splits, because half of it cannot precede the flip.**

**Done now (the read path).** A cache is something that can be *filled*, and
until this there was nothing to fill it from: writes have mirrored **up** since
ADR-030 but nothing outside a Game ever read back **down**, so a signed-in player
opening ITUN on a second device saw an **empty roster** while their builds sat in
Convex. `entities.listMine` + `ShelfSync` close that, server-wins, with no merge
— there is no second writer to conflict with, which is the benefit ADR-034 buys.

**Waiting for the flip.** Two pieces cannot land while Solo still exists, and
attempting them early is how a roster gets deleted:

- **Pruning local rows the server does not return.** That is the honest
  completion of "the cache is a reflection", and today it would delete a Solo
  user's entire IndexedDB, which the server has never heard of.
- **Removing the mirrors.** `mirrorWrite` upserts *because* a Solo entity has no
  server row yet, and is fire-and-forget *because* the local write is the one the
  UI reads. Both premises are still true until the flip; removing them first
  would break the mode that is still shipping.

**Work still outstanding.** Make the demotion true in code rather than in prose: the local store is
populated from Convex and read for speed, and nothing treats it as authoritative.
`writesAllowed()`'s Solo branch goes; `resolveConnectionMode`'s two `'solo'`
returns collapse. Reconciliation is a plain rule — the server wins — because
there is no longer a second writer to conflict with, which is the entire benefit
being bought.

**This is where all six stores are wired, in one shape, once.** The four that
mirror today stop mirroring; the three that do not reach the server at all are
wired for the first time. They get the same treatment because after this phase
they are the same kind of thing: a write goes to Convex and its failure is the
user's failure, rather than a local success plus a swallowed warning.

The bridge comes out with them. `mirrorWrite`, `mirrorCrawlerWrite` and
`mirrorSoftLinkWrite` have no remaining premise — and `appId` is on the same
list, since it exists only because the client mints ids as the source of truth.
Removing it is a bigger change than the mirrors (`claimLocal`, `byAppId`,
`upsertByAppId`, the bot's lookups and the public-sheet route all address rows by
it), so it may deserve its own follow-up phase rather than riding along here.
**Decide that explicitly when scoping P4 — do not let it happen by accident.**

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
  soft links, patterns and encounter NPCs, with counts asserted per kind.
  - **The Change Log is deliberately not claimed here.** Its client appends do
    not reach the server at all yet, and the wiring that changes that lands with
    P4's second half together with the ordering rule — claiming a log into a
    table nothing else writes would be a one-off import with no ongoing sync
    behind it. Recorded so this reads as sequencing rather than an omission.
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

5. **The export bundle does not carry the Change Log**, and that is now a
   decision rather than an oversight — see ADR-034's consequences for the
   reasoning and for the `mergeImport` id-remapping problem that makes reversing
   it real work. Unblocks P3. The cost is stated: a user who leaves via export
   loses their provenance history.

## Still open

Nothing blocking. The remaining unknowns are inside phases and are named in the
phase that owns them — most substantially, **which of P1's three routes to
take**, which is a security-shaped choice and gates the two one-way doors.
