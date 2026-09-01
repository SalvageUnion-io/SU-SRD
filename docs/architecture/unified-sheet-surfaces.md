# Unified Sheet Surfaces — Current and Historical

A plan for unifying ITUN's **two account-free ways to share a sheet**: the
frozen snapshot at `/s/:id` ([ADR-004](../adrs/ADR-004-snapshot-netlify-functions.md),
amended by [ADR-033](../adrs/ADR-033-cloudflare-hosting.md) — same contract, now
a Worker and R2) and the live public sheet at `/p/:kind/:appId`
([ADR-032](../adrs/ADR-032-public-read-only-sheets.md)).

**There is no ADR for this yet, and that is deliberate.** The framing that
started this work — "is the difference historical? We should combine these, so
it is a question of Current or Historical views" — is right about what a player
sees and wrong about what the code is doing, and the difference matters enough
that four questions have to be settled by a human before any of the one-way
phases below can begin. Those questions are in **Open decisions**; they belong
to a future ADR-036. This document holds the sequence, the gates, the progress
and a **recommendation**. A recommendation is not a decision.

Drafted against `main` on 2026-09-01. Every claim about the repository below was
read from source and names the file it came from, so it can be re-checked rather
than believed.

---

## The rule that governs everything else

> **A failed gate halts the phase.**
>
> No gate is worked around, relaxed, or retried with different parameters to
> obtain a pass. No later phase begins while an earlier gate is red.

One addition specific to this plan, because it is the failure mode that would
hurt most and the one nothing currently protects against:

> **No phase may make an existing shared link stop resolving.**
>
> Shared links are already in the wild — in Discord channels, forum signatures
> and bios — and **nothing in this system indexes them**. There is no list to
> notify, no owner to warn and no expiry to wait out. A link that 404s cannot be
> discovered as broken by anyone except the person holding it, who has no way to
> report it and no reason to assume the fault is ours. "Resolving" means
> serving the sheet it served before, or serving a page that explains what
> happened; it does not mean a redirect to the roster and it does not mean a
> generic not-found.

That rule is stronger than "don't delete data", and the distinction is the
point: a snapshot object that survives in R2 behind a route pattern that no
longer matches is data that was kept and a link that was broken.

---

## Progress

Update this table as part of each phase's PR. It is the only place that answers
"which phase are we on".

| Phase | What                                                           | Reversible | Status          |
| ----- | -------------------------------------------------------------- | ---------- | --------------- |
| P0    | Inventory the links that exist — measure, change nothing        | yes        | **not started** |
| P1    | A CI guard that an existing share link still resolves           | yes        | **not started** |
| P2    | One share surface, both models named on the right axis          | yes        | **not started** |
| —     | **ADR-036** — settle the four open decisions below              | —          | **not started** |
| P3    | An entity → snapshot index                                      | **no**     | **not started** |
| P4    | One route family with a Current \| Historical toggle            | **no**     | **not started** |
| P5    | Revocation reconciled across both models                        | **no**     | **not started** |

P0–P2 are all reversible and all buy information; none of them needs a decision
this document is not allowed to take. **P3 onward are blocked on ADR-036** and
must not start before it — P3 in particular decides whether a snapshot has an
owner, which is the question every later phase inherits.

---

## What is already shared, precisely

The renderer is common. Almost nothing else is. This section exists so the
scope argument is made from source rather than from an impression.

### Shared today

- **The parse.** `apps/itun/src/lib/schemas/frozenEntity.ts` exports
  `parseFrozenEntity`, which validates an untrusted body against the Zod schema
  for its kind. It is deliberately its own module so the snapshot **publish**
  handler can use it without dragging Zustand into the Worker bundle — see
  `apps/itun/src/lib/snapshot/payload.ts`, which enforces the invariant that a
  snapshot which cannot be rendered cannot be minted.
- **The frozen store.** `apps/itun/src/components/sheet/frozenSheet.ts` exports
  `makeFrozenStore`, a read-only single-entity store whose every write throws.
  It has exactly three consumers: `apps/itun/src/components/sheet/SnapshotSheet.tsx`
  (the snapshot page), `apps/itun/src/components/sheet/PublicSheet.tsx` (the
  public sheet) and `apps/itun/src/components/games/GameEntitySheet.tsx` (the
  Game crew view).
- **The presentation.** All three thread that store through the same `Sheet` the
  live surfaces use, in read-only mode. Read-only is the constant across every
  shared surface in the app.
- **The share UI, already.** `apps/itun/src/components/sheet/ShareStatusDialog.tsx`
  presents both models in one dialog over the live sheet, headed **"Live public
  sheet"** (rendered by `apps/itun/src/components/sheet/PublicSheetPanel.tsx`)
  and **"Frozen snapshot"**, with one framing line above them: *"Both give
  whoever has the link a read-only view … The choice is whether it keeps up with
  you."* The live half goes first when it is present.

**That last bullet is the cheap intermediate, and it has already shipped.** A
plan for this work would naturally propose "one share screen with a Live link
section and a Frozen copies section" as a phase 0 that fixes most of the
user-facing confusion at a fraction of the cost. It is worth knowing that
someone already did it, that the headings were deliberately moved onto the
live-versus-frozen axis rather than the public-versus-private one, and that the
confusion which remains is therefore **not** on the share screen. What is left
of that idea is P2.

### Not shared

| Concern | Snapshot | Public sheet |
| --- | --- | --- |
| Address | `/s/:id`, minted, unguessable | `/p/:kind/:appId`, derived from the app id |
| Route module | `apps/itun/src/routes/s/$id.tsx` | `apps/itun/src/routes/p.$kind.$appId.tsx` |
| Transport | `fetch` through `apps/itun/src/lib/snapshot/client.ts` | a Convex `useQuery` |
| Load model | a router loader with a 10 s timeout and a skeleton | a live subscription |
| Storage | one opaque R2 object (`apps/itun/src/lib/snapshot/storage.ts`) | a `publicRead` column on the entity row (`apps/itun/convex/schema.ts`) |
| Who may create | anyone, no account | the owner, via `assertMayPublish` in `apps/itun/convex/publicSheet.ts` |
| Who may revoke | anyone holding the id | the owner only |
| Enumeration | `listPublishedSnapshotsFor` in `apps/itun/src/lib/snapshot/publishedSnapshots.ts` — localStorage | none at all, by design |
| Unfurl metadata | yes — `apps/itun/src/worker/shellMeta.ts` plus a rendered card from `apps/itun/src/worker/ogImage.ts` | deliberately none |
| Availability | works in every mode, including anonymous | needs `isConvexConfigured` **and** `mode === 'connected'` |
| Pilot ability context | frozen into `context.pilotAbilities` at publish | resolved live from the `softLinks` graph |

**So the shape of the work is: the rendering is done, and everything that
remains is routing, capability model and data model.** Not one line of the
read-only sheet needs to change for any option below. That is why the naive
merge looks cheap and is not.

---

## The load-bearing difference is the capability model, not the tense

Current-versus-historical is the visible difference. It is not the one that
makes a merge hard. On three axes the two systems are **opposites**, and each
opposition was chosen on purpose:

1. **Who can create one.** A snapshot can be minted by anyone with no account —
   that is ADR-004's whole point, and after
   [ADR-034](../adrs/ADR-034-account-required-persistence.md) and
   [ADR-035](../adrs/ADR-035-no-isolated-local-only-data.md) it is load-bearing
   as the anonymous escape hatch: an anonymous visitor's entities live in the
   in-memory backend and have no server row at all, so a snapshot is the only
   thing they can hand to another person. A public sheet requires an owner and
   an account-backed row.
2. **How you revoke, and who can.** Revoking a snapshot deletes one R2 object;
   its siblings survive. The `DELETE /api/snapshots/:id` endpoint is
   **unauthenticated by design** (`makeDeleteHandler` in
   `apps/itun/src/lib/snapshot/handlers.ts` checks the method and the id shape
   and nothing else), so **the id is the revoke capability** — anyone holding
   the link can delete it. ADR-032 §2 states this explicitly as one of four
   reasons it refused to have the Discord bot mint snapshots. Revoking a public
   sheet flips one boolean and every link dies at once, and only the owner (or,
   for a communal crawler, the table runner) may do it.
3. **Whether the URL is a secret.** A snapshot id is minted from
   `crypto.getRandomValues` — 8 Crockford base32 characters, ~40 bits
   (`apps/itun/src/lib/snapshot/id.ts`). A public-sheet URL is **derived** from
   the app id, which travels in crew payloads and Game-view URLs, so it is not a
   secret — which is exactly why ADR-032 required an explicit opt-in column
   rather than relying on unguessability.

ADR-032 already wrote the consequence down: `publicRead` "is the control, not
the unguessability of an id. That is the opposite of the snapshot model, where
the id _is_ the capability, and it is the better property: it can be withdrawn."
A merge that does not decide which of these two properties survives has not
decided anything.

---

## Two hard blockers

Both were verified in source. Both must be answered by ADR-036, not by a phase.

### 1. There is no server-side link from an entity to its snapshots

`apps/itun/src/lib/snapshot/publishedSnapshots.ts` says so in its own header: it
is a localStorage "convenience ledger", and explicitly "not a source of truth
for what exists server-side". A cleared browser forgets its links while the
snapshots persist. That ledger is what `ShareStatusDialog` lists and revokes
from, so **the set of links a player can see is the set their current browser
happens to remember.**

Nothing else can reconstruct it either, and this is sharper than it first looks:

- The stored object is keyed by the snapshot id alone, and the storage seam
  (`R2BucketLike` in `apps/itun/src/lib/snapshot/storage.ts`) exposes `get`,
  `put` and `delete` — **there is no `list`**. R2 itself supports listing; no
  code in this repo can reach it.
- The relation nevertheless *exists inside the bytes*: the payload is
  `{ kind, entity, context? }` and `entity.id` is the source entity's app id —
  the same id `/p/:kind/:appId` is addressed by. So an index is derivable by
  reading every object, and by nothing cheaper.

A "Historical" tab needs that index. Building it means snapshots acquire an
owner — which collides directly with the next blocker.

### 2. An anonymous user can mint a snapshot but can never have a public sheet

If "Historical" becomes a mode of the public-sheet URL, the account-free way to
hand somebody a build disappears. That is not an acceptable cost: ADR-034
decision 1 keeps an anonymous visitor able to build a complete pilot, mech and
crawler, and is explicit that this is "deliberately not a paywall shape or a
signup wall". Try-before-you-buy stays. `/p/…`, `/s/…`, `/join/:code`, and the
about and changelog pages all stay reachable with no account.

So any option that routes frozen sharing through an account-gated address is
removing a capability, not unifying two.

---

## Options

### A — Derive both from the app id

One URL family (`/p/:kind/:appId`, with a historical view addressed underneath
it), one opt-in column, one revoke switch.

- **For.** The simplest thing to explain. One place to turn sharing off. The
  Discord bot already builds `/p/…` from the `appId` it is sent
  (`publicSheetUrl` in `apps/discord-bot/src/gameEmbed.ts`), so it needs no new
  input.
- **Against — the account-free share.** An anonymous entity has no server row
  and therefore no addressable app id. This deletes blocker 2's capability
  outright.
- **Against — unguessability.** Every historical view inherits a derivable URL,
  so each one needs its own opt-in or it is exposed by the entity's app id
  alone. "This build, as it was that night" is often the more sensitive of the
  two.
- **Against — the archive dies with the switch.** One boolean over both tenses
  means turning off the live link also kills every frozen copy — or you add a
  second boolean, at which point A has become C with a worse URL.

### B — Mint ids for both

One URL family (`/s/:id`), with the live sheet reached through a minted,
unguessable token rather than a derived address.

- **For.** Unguessable everywhere. The frozen half keeps working with no
  account. One address shape to teach.
- **Against — revoke-everywhere-at-once is gone.** ADR-032 §6 promises that
  turning it off revokes the sheet everywhere immediately, *because* there is
  one derived URL and no outstanding links to chase. Minting replaces that with
  a set to track, and ADR-032 already considered and rejected a per-entity token
  as "strictly more machinery for a marginal gain" and "a worse promise to make
  about a link somebody has put in their bio".
- **Against — "the id is the delete capability" moves onto live data.** Today
  an unauthenticated `DELETE` can destroy one frozen copy of a build whose
  original is untouched. Under B the same capability, applied consistently,
  lets anyone holding a link switch off the owner's *live* sheet — and if the
  delete endpoint is instead authenticated for live links only, the unified
  surface has two capability models again, wearing one URL shape. That is worse
  than having two shapes: it hides the difference instead of naming it.

### C — Keep two capability models, unify the surface

One share screen and one route family, with a **Current | Historical** toggle
where each mode is present only when its own capability is. An anonymous
builder sees Historical only. A signed-in owner who has never published sees
Current only, until they mint something. Neither mode is fabricated.

- **For.** It is the only option that removes no capability. It also matches
  what is true rather than papering over it, and both truths are already
  defensible: ADR-032 narrowed ADR-004 rather than superseding it, precisely
  because the two answer different questions.
- **For.** The renderer is already common, so this is genuinely a routing and
  presentation change plus one new index.
- **Against.** It needs the entity → snapshot index, which is blocker 1, which
  implies snapshots gain an owner (open decision **a**). That is the one-way
  door in this plan.
- **Against.** Two capability models still have to be explained somewhere, and
  a toggle that is sometimes half-empty needs copy that makes the absence
  legible rather than looking broken.

### The cheap intermediate — already shipped

"Make the Share screen present one thing, with a Live link section and a Frozen
copies section" is the obvious low-cost move, and
`apps/itun/src/components/sheet/ShareStatusDialog.tsx` already does it. It is
listed here so the option is not proposed a second time as though it were
outstanding. What remains of it is genuinely cheap and is P2:

- The frozen list is per-browser, so the screen quietly under-reports.
- The two shared pages themselves (`/s/:id`, `/p/:kind/:appId`) carry no cue
  that the other tense exists — a reader who has a frozen link cannot tell it is
  frozen, or that a current view might exist.
- The dialog is reachable only from the live sheet, so a player who cleared
  their browser has no route to their own links at all.

---

## Recommendation

**Option C, with P0–P2 started immediately and P3–P5 held for ADR-036.**

The single strongest reason: **C is the only option that deletes no capability
that exists today.** A removes the account-free share, which ADR-034 decision 1
and the try-before-you-buy posture both depend on. B removes
revoke-everywhere-at-once and moves "the id is the delete capability" from
frozen data — where the worst case is losing a copy — onto live data, where the
worst case is a stranger switching off the sheet in your bio. C pays one real
cost instead, an index and an ownership question, and pays it in a phase that
can be gated.

Two supporting reasons, weaker but worth recording. The renderer is already
common, so C's remaining work is routing and one index rather than a rewrite.
And C is reversible up to P3: P0–P2 leave both systems exactly as they are.

**This is a recommendation, not a decision.** The open decisions below stay
open regardless of it, and ADR-036 may take a different option — in which case
P0–P2 are still the right first three phases, because measuring the links,
guarding their resolution and finishing the share surface are needed under every
option.

---

## P0 — Inventory the links that exist

**Goal.** Know how many shared links are live, of which kind, and how many
could be attributed to an entity that still exists. Every later phase's risk is
a function of this number and nobody currently knows it.

**Why it is first.** The governing rule above is a promise about links we
cannot enumerate. A plan that begins by breaking that ignorance is cheaper than
one that ends by discovering it. ADR-033's P6 is the precedent worth copying:
its delta was reconciled by **measurement** rather than by running a sync tool,
and the measurement was what made the phase safe to close.

**Work.**

- Count the objects in the `su-itun-snapshots` R2 bucket and record the figure
  here with its date. This is a read through the Cloudflare tooling, not through
  the app — the app's storage seam has no `list`.
- For each object: parse it with `parseFrozenEntity`, record its `kind`, and
  record whether `entity.id` matches a live `appId` in Convex. The result is a
  three-way split: attributable to a live entity, attributable to an entity that
  no longer exists, and unparseable.
- Count the rows with `publicRead === true`, by table.
- Write both counts, and the split, into this document.

**Gate.**

- A total object count, a per-kind breakdown, and the three-way attribution
  split are written into this document with the date they were taken.
- **The bucket is unchanged**: object count and per-object content hashes are
  identical before and after. This phase writes nothing and deletes nothing, and
  that is asserted rather than intended.
- Every unparseable object is listed individually by id. A count is not enough
  — an object that fails `parseFrozenEntity` is a link that is already broken
  for its holder, and P1's guard needs to know it is expected to fail.

---

## P1 — A CI guard that an existing share link still resolves

**Goal.** Make the governing rule enforceable rather than aspirational, before
any phase can violate it.

**Why it is this early.** There is precedent in this repo for a route quietly
ceasing to resolve and only a bookmark noticing:
`apps/itun/src/routes/sheet/$kind/$id_.share.tsx` exists solely to stop a
retired URL dead-ending, and its header explains that the edge rule alone was
not enough because the service worker answers navigations from cache. A
unification that moves route families will meet that same problem three times.

**Work.**

- A test that asserts both live share route patterns are registered and each
  serves the app shell for a well-formed id — extending the existing routing
  coverage in `apps/itun/src/worker/__tests__/routing.test.ts` and the route
  tests in `apps/itun/src/routes/__tests__/`.
- A retired-URL table: every share URL shape the app has ever served, and what
  answers it now. `apps/itun/src/routes/__tests__/retiredShareRoute.test.tsx` is
  the pattern; the table is the thing that is new, because the rule is about the
  set and not about one route.
- The guard must cover **both halves of the PWA problem**: the route registered
  in the app, and the Worker's own path handling in
  `apps/itun/src/worker/index.ts`.

**Gate.**

- Deleting either share route from the router fails the suite. Demonstrated by
  doing it, not by inspection — a guard that has never been seen to fail is not
  known to be a guard.
- The retired-URL table is exhaustive against `git log` for `src/routes`: every
  share-shaped path that has ever been registered appears in it with a current
  answer.
- `bun run check` green.

---

## P2 — One share surface, both models named on the right axis

**Goal.** A player can see every link they have shared, from any browser they
are signed in on, and can tell from a shared page itself which tense they are
looking at.

**Why this is smaller than it sounds.** `ShareStatusDialog` already presents
both models with the correct framing. What is missing is reachability and
labelling, both of which are UI-only and neither of which needs a schema change
— which is exactly what makes this the last reversible phase.

**Work.**

- The shared pages state their own tense. `/s/:id` says it is a frozen copy and
  gives the date it was minted; `/p/:kind/:appId` says it follows the sheet.
  Neither may state or imply anything about the *other* tense for that entity —
  that would require the index P3 has not built yet, and on the public page it
  would leak the existence of frozen copies of a sheet.
- The share dialog states the limit of its own list: the frozen links shown are
  the ones **this browser** remembers. It currently implies completeness by
  saying "Shared — N active links".
- Decide and record where the share dialog is reachable from besides the live
  sheet. Do not build a second screen for it.

**Gate.**

- Rendering each shared page in a test shows a tense cue with no network call
  and no reference to the other tense.
- A test asserts the frozen-link list's caveat renders whenever the list is
  non-empty, and that the count copy no longer claims completeness.
- No route was added or removed; no Convex schema column was added. Asserted
  against the generated route tree and the schema, not by review.
- `bun run check` green.

---

## P3 — An entity → snapshot index

**BLOCKED on ADR-036.** Do not begin. Open decisions **a** and **c** both
land here.

**Goal.** For an entity in an account, the set of frozen copies minted from it
is knowable from the server, on any device.

**Work (shape only, pending the ADR).**

- Whatever the index is, it is written on the publish path and read by the
  Historical view. The publish path is unauthenticated today, so either the
  index write is best-effort and the anonymous case simply produces no index
  row, or publish gains an optional authenticated variant — that is decision
  **a** and it is not taken here.
- Existing ownerless snapshots are not migrated by this phase. They stay
  resolvable and simply never appear in a Historical list. Decision **a** may
  say otherwise; if it does, the migration is its own phase with its own gate.

**Gate.** The lesson this repo has already paid for twice is that **a gate must
assert the end state, not the mechanism** — ADR-034's P5 gate proved a roster
*could* be claimed and never that it *was*, and a parity test proved a Convex
table *existed* while nothing wrote to it. So:

- Minting a snapshot through the **real publish path** and then reading the
  Historical list for its source entity returns that snapshot. Not "an index
  table exists"; not "a write was issued".
- The same assertion holds **from a second browser context** with the
  localStorage ledger empty. That is the whole reason the index exists, and
  asserting it in one context would pass on the ledger alone.
- Revoking that snapshot removes it from the list, and the list is then empty
  rather than holding a dangling row.
- An anonymous publish still succeeds and still returns a resolvable link.
  Asserted with no identity present.
- Every snapshot counted in P0 still resolves. Re-run P0's attribution and
  compare.

---

## P4 — One route family with a Current | Historical toggle

**BLOCKED on ADR-036.** Open decisions **b** and **d** land here.

**Goal.** One address family for shared sheets, with the tense as a mode inside
it, and each mode present only when its capability is.

**Work (shape only, pending the ADR).**

- The toggle renders Historical only where the index has entries, and Current
  only where `publicRead` is on. An absent mode is explained, not hidden and not
  faked.
- Both old URL families keep resolving. Whether that is by preservation or by
  redirect is decision **d**.

**Gate.**

- Every id in P0's inventory resolves to the same rendered sheet before and
  after, compared by content and not by status code. This is the governing rule
  made falsifiable.
- A sheet with no public link shows no Current mode and does not disclose
  whether one ever existed — the ADR-032 invariant that private and nonexistent
  are indistinguishable must survive the merge, in the new surface and in the
  Worker's unfurl handling, which is why `apps/itun/src/worker/index.ts` today
  deliberately declines to inject metadata for `/p/…`.
- An anonymous visitor can still mint a link and open it, end to end, in a
  production-shaped build.
- `bun run check` green and the e2e suite green.

---

## P5 — Revocation reconciled

**BLOCKED on ADR-036.** Open decision **c** is the whole of this phase.

**Goal.** One answer to "make this stop being visible", whose scope the player
can predict before pressing it.

**Work (shape only, pending the ADR).** Today "stop sharing" means two
incompatible things: flip one boolean and every link dies, or delete one object
and its siblings survive. A unified surface must either state both scopes
plainly at the point of action, or reduce them to one — and reducing them to one
changes a capability, which is why this is a phase and not a copy change.

**Gate.**

- For each revoke affordance, a test asserts exactly which links stop resolving
  and which continue to. Enumerated, not described.
- The unauthenticated `DELETE` path cannot reach anything that is not a frozen
  object. Asserted against a live sheet, by attempting it.
- After a full revoke, no path renders the entity to an anonymous reader.
  Asserted end to end, not by checking that a column was written.

---

## Open decisions

These are for a human, and they belong to **ADR-036**. Nothing in this document
decides them, and P3 onward cannot start until they are settled.

**a. Do snapshots gain an owner, and what happens to the ownerless ones?**
An index from an entity to its frozen copies implies the copies are attributable
to somebody. But the publish endpoint is unauthenticated and must stay usable
with no account (blocker 2), so an owner cannot be required. Sub-questions: is
ownership optional, recorded only when a signed-in player publishes? Do existing
ownerless snapshots stay ownerless forever, get adopted on sight by the browser
that holds their ledger entry, or get attributed by matching `entity.id`? The
last is possible — the app id is inside every payload — and is a bulk read of
every object, with an obvious false-attribution risk where an app id has been
duplicated.

**b. Does a historical view stay unguessable, or become derivable from the app
id?** Today a snapshot id is ~40 bits of minted entropy and a public URL is
derived. If Historical becomes a mode of a derived URL, every frozen copy needs
its own opt-in or the app id alone exposes the archive. If it stays minted, the
unified surface has two address shapes inside one family, and the toggle has to
change the URL in a way a reader can follow.

**c. What does revocation mean once these are one surface?** One model is
"anyone with the link can delete it"; the other is "the owner flips one boolean
and everything dies at once". Both are load-bearing: the first is what makes an
unauthenticated endpoint safe to expose at all, the second is the promise
ADR-032 §6 makes about a link in somebody's bio. A merged surface needs an
answer that does not silently weaken either.

**d. Are existing `/s/:id` URLs preserved forever, or redirected?** Preserved
costs a permanent second route family. Redirected requires knowing what to
redirect *to*, which requires the index from decision **a**, which does not
exist for ownerless snapshots — so "redirect" may be undecidable for exactly the
links that have been in the wild longest. Note that a redirect must satisfy the
governing rule, which the service-worker problem in
`apps/itun/src/routes/sheet/$kind/$id_.share.tsx` shows is not free.

---

## What this plan deliberately does not do

- **It does not write ADR-036.** The decisions are not made; naming them as
  open is the honest state.
- **It does not touch the renderer.** `frozenEntity.ts` and `frozenSheet.ts`
  are already shared by all three read-only surfaces, and no option above needs
  a fourth.
- **It does not propose making snapshots refresh.** ADR-032 already rejected
  that: an immutable, historyless copy is what makes a snapshot worth having,
  and mutating it would leave the project with two live surfaces and no frozen
  one.
- **It does not add unfurl metadata to `/p/…`.** That is real work with its own
  invariant to preserve — a private sheet and a nonexistent one must stay
  indistinguishable — and it is not this change's business.
