# ADR-030: Accounts, Games, and a Server of Record

## Status

**Accepted — governing ADR for identity, ownership, and sharing.**
**Supersedes [ADR-001](ADR-001-local-first-no-backend.md)** (local-first, no
backend, no auth). **Amends [ADR-022](ADR-022-provenance-log-and-overrides.md)**
(the Change Log is no longer local-only). Extends
[ADR-021](ADR-021-itun-surface-taxonomy.md) with an ownership axis without
altering any of its enforcement modes.

"Accepted" records the **decision**. Almost none of it is built yet; the phased
delivery plan is in
[`accounts-and-games.md`](../architecture/accounts-and-games.md).

## Context

[ADR-001](ADR-001-local-first-no-backend.md) made ITUN local-first with no
accounts and no application backend, and it closes with an explicit instruction:
do not reintroduce auth, server-side user storage, or realtime sync without a new
ADR superseding it. This is that ADR.

The decision is not a reversal of ADR-001's reasoning — it is a change in what
the product is for. ADR-001 correctly observed that _a player's pilots and mechs
are private working documents, not multiplayer state_. That is still true of a
person building a mech alone. It stopped being the whole story once the goal
became running **a table**: several players, one Union Crawler, a Mediator, and a
shared session where a Downtime happens to everybody at once.

[ADR-021](ADR-021-itun-surface-taxonomy.md) anticipated this precisely. Its
long-tail section lists **"Workspaces → Game spaces"**, a **"Shared, live
Dashboard"**, and a **"dedicated Mediator layer"** as out of scope and
_explicitly gated on revisiting ADR-001_. Nothing here is a surprise to the
architecture; this ADR opens the gate ADR-021 described.

Three existing decisions turned out to be well-shaped for this and are carried
over unchanged:

- **[ADR-004](ADR-004-snapshot-netlify-functions.md)** (immutable, unauthenticated
  snapshots) remains the account-free way to hand someone a pilot. It is untouched.
- **[ADR-027](ADR-027-partners-owned-by-host.md)/[ADR-028](ADR-028-partners-render-in-place.md)**
  made partner ownership _intrinsic_ — partners ride their host through snapshots
  and export bundles with no orphan cleanup. That ports to per-user ownership with
  no change at all.
- **[ADR-022](ADR-022-provenance-log-and-overrides.md)**'s Change Log is already
  append-only, ordered, replay-shaped, and tagged with provenance and source
  surface. It becomes the spine of this feature (see _Amendment_ below).

## Decision

### 1. Identity and the storage modes

ITUN gains **accounts, authenticated by Discord OAuth and nothing else**. Discord
is the only provider because the audience already lives there and the project
already ships a bot, which this makes a first-class authenticated client rather
than something needing its own credential story.

**Convex is the server of record.** A signed-in client reads through a reactive
subscription and writes to Convex; IndexedDB is demoted from source of truth to a
warm cache. Reactive subscriptions are the product feature here — synchronized
alerts and a live table are the point — not an add-on.

This produces **three modes**, and every surface must be legible in all three:

| Mode             | Truth        | Reads                 | Writes                     |
| ---------------- | ------------ | --------------------- | -------------------------- |
| **Solo**         | IndexedDB    | local                 | local — nothing is blocked |
| **Connected**    | Convex       | reactive subscription | to Convex                  |
| **Disconnected** | Convex, gone | cache, fully legible  | **blocked**                |

**Solo is not Disconnected.** Anonymous play stays first-class: no sign-in is
required to build a pilot and play alone, nothing is gated, and no banner
appears. Signing in is an _upgrade_ taken to join a table. A **NOT CONNECTED**
banner and read-only state are the honest cost of choosing a server of record,
and only people who opted into a Game ever pay it.

Offline writes are **blocked, not queued**. An outbox would reintroduce conflict
resolution through the back door, which is the thing choosing a server of record
avoided. Revisit only with evidence from a real session, not in anticipation.

### 2. Containers: Games and Shelves

A **Game** is the shared container — campaign, group, and the former Workspace
collapsed into one concept. There is no separate "group" that outlives a Game and
no separate "workspace" that sits beside one.

A **Shelf** is the second container: a per-account home for entities that are not
in play. It is deliberately _not_ a Game — a shelf has no Mediator, no invites,
and no crew — and it syncs, so drafts follow you across devices.

An entity is in exactly one container, encoded as two nullable columns:

| `gameId` | `ownerId` | State                                                  |
| -------- | --------- | ------------------------------------------------------ |
| set      | set       | claimed and in play                                    |
| set      | null      | **unclaimed** — awaiting assignment                    |
| null     | set       | on the owner's shelf                                   |
| null     | null      | **invalid** — must be unreachable through any mutation |

An entity belongs to **one Game at a time**, and moving it between containers is
a **change to `gameId`, not a copy**. There is one entity. A pilot on your shelf
and that same pilot in a Game are the same record with one field set
differently — never an original and a duplicate to be kept in step.

**Move and copy are different verbs, and the difference is the point.**

| Verb     | Result                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Move** | The **same** entity. Same id, same body, same history; only `gameId` changes. Nothing is duplicated and nothing needs reconciling.   |
| **Copy** | A **new** entity. New id, named `COPY OF <name>`, always `gameId: null`, and carrying no relationship to the source or to its Game. |

A copy is deliberate, explicit and user-initiated — "I want my own one of these"
— and once made it is simply a build of yours like any other. It does not track
its origin, does not sync with it, and does not follow it into or out of a Game.
That is what keeps copying safe: there is no ongoing relationship to get out of
step, which is exactly the property a fork would not have had.

So a character in somebody else's Game can be copied to your shelf without
copying the Game, and editing your copy can never touch theirs.

> **Amended 2026-08-06.** This clause previously read: _"a pilot's crawler
> level, scrap, TP, and injuries are Game-specific, so a shared pilot would be
> incoherent rather than convenient. Moving one is an explicit **fork** that
> copies and records its origin."_
>
> The conclusion did not follow from the premise. Game-specific state is only
> incoherent if one entity can be in two Games at once, and the container model
> makes that unrepresentable: `gameId` is a **single nullable column**, so an
> entity is in at most one Game by construction. Forking solved a problem the
> schema already prevents.
>
> Note that a fork is **not** the same thing as the copy sanctioned above, and
> the difference is the origin it "records". A copy is a clean break — a new
> build of yours with no tie to what it came from. A fork keeps a relationship,
> and a relationship between two records of one character is precisely the thing
> that has to be reconciled, watched, and eventually gets out of step. The verb
> that survives is the one with nothing to keep in sync.
>
> No fork was ever built, so this amendment does not change behaviour;
> `MoveToContainerControl` re-stamps `gameId` in place and
> `entities.upsertByAppId` re-homes the existing row. What it changes is the
> instruction: that in-place move **is** the design, and the absence of a fork
> mutation is not a gap for somebody to close later.

### 3. Roles: a base role plus one modifier

Every member of a Game is a **Player** or a **Mediator**. **Organizer** is an
_orthogonal administrative flag_ carried by one of them — not a third role, and
never held by a non-participant.

- **Player** — owns their own pilots and mechs. The default.
- **Mediator** — owns the world: NPCs, alerts, the Downtime phase. **May also own
  a pilot and play.** The schema permits several; the UI is built for one.
- **Organizer** — invites, membership, settings, rename, delete, transfer. Exactly
  one per Game. **Confers no authority over game content**: an Organizer's reach
  over pilots, mechs, and the crawler is whatever their base role already gave
  them.

The one deliberate bend: **assigning ownership** belongs to the Mediator, but
falls back to the Organizer when a Game has no Mediator, so there is never a state
in which nobody can hand out a pilot. This is defensible because who-owns-what is
closer to membership than to content — assigning a pilot never edits one.

### 4. Cross-player writes: propose, never impose

**A Mediator never writes another person's sheet.** They push a **proposal**; it
arrives on the player's Dashboard with the before/after visible, and the player
applies or declines it. Proposals persist until answered — no timers, no expiry,
and **no force-apply**, which would collapse this straight back into the direct
write this decision rejects. A newer proposal against the same field marks the
older one superseded, so a player never faces two contradictory pending changes
to one value.

This keeps ADR-001's honour-system ethos intact while giving the Mediator real
reach, and it means **alerts and cross-player writes are one mechanism, not two**.

Owners may always **release** what they hold, and the Mediator may **reassign**,
so a mis-assignment is fixable. A player may own any number of entities in a
Game — solo play and covering for an absent player both need it.

> **Amended: players self-claim what is offered.** This section originally read
> "ownership is assigned rather than claimed: players do not self-claim". That
> is reversed. An unclaimed entity is an **offer to the crew** — that is the
> whole reason the Mediator pre-builds characters and a template seeds six of
> them — so a player taking one is accepting an offer, not seizing anything.
> Requiring the Mediator to hand each one over individually added a round trip
> to the first ten minutes of every table and bought no safety.
>
> The boundary the original rule protected is intact and is the important half:
> **claiming touches only what is free.** An entity somebody already holds
> cannot be taken; it must be released first, by its owner or by the Mediator.
> `assign` remains the table runner's power to place an entity with a
> _particular_ person, which self-claim cannot express.

### 5. Visibility

Inside a Game, every member sees every crewmate's **vitals live** and may drill
into a crewmate's full sheet **read-only**. The Mediator's prepared opposition
(`encounterNpcs`) is the one thing that stays hidden. The **crawler is communal** —
any member may edit it — with conflicting writes resolved by field-level merge,
because the scrap pool and cargo lots are genuinely contended during Downtime.

### 5a. Setting the table up: who raises the crawler, and when a Game takes crew

Communal-to-**edit** is not free-to-**create**, and the crawler is where the two
come apart:

- **Raising and scrapping a crawler is the table runner's act** — the Mediator,
  or the Organizer while a Game has no Mediator (the same narrow fallback §3
  already grants for assignment, and for the same reason: a Game is created with
  `mediator: false` on its only membership, so a Mediator-strict rule would make
  every new Game an unreachable state). Filling the crawler's fields stays
  everyone's, exactly as §5 says.
- **A Game takes a player's pilots and mechs once it has a crawler.** In Salvage
  Union the crew is anchored to its crawler — it is where they repair, where the
  scrap pool lives, where they return to — so a Game without one is not yet set
  up. The table runner is exempt, because somebody has to be able to raise the
  first one.
- **A Game may hold several crawlers.** This was always true of the schema and is
  now true of the surfaces. A campaign that loses a crawler and rebuilds, or
  meets and eventually joins a second, is ordinary play rather than a state to
  reject.

The line all three sit on: a table runner arranges **what the crew sails in and
who holds what**, and still cannot change a number on somebody else's sheet. For
that there is a proposal (§4).

Enforced in `convex/model/permissions.ts` (`requireTableRunner`, `gameHasCrawler`)
and `convex/entities.ts`, and mirrored — never re-decided — for the UI in
`apps/itun/src/lib/games/gameRoster.ts`.

### 6. Surfaces

The **Mediator gets its own surface**, the layer ADR-021 deferred; the Encounter
tray is absorbed into it and `/encounter` retires. The player Dashboard's locked
1280×800 canvas ([ADR-020](ADR-020-dashboard-fixed-canvas-scale-to-fit.md)) is
**not** reopened: crew vitals arrive there as a **"Crew" dial item**, using the
dial track's existing configurable show/hide and order.

**A Game's crew is rendered as the Roster renders a shelf.** `/games/:id` (any
member) and `/mediator/:id` (the Mediator, who gets the private instruments
below it) both open with the same three ontology-toned columns of `EntityRow`s
the home Roster uses, with a create CTA per column and a Dashboard launch on the
rows that support one. A Game asks "what have we got and what can I do with it"
of a different container, and answering it in a second visual vocabulary — which
the first cut did, as a stack of bordered cards with no way into a sheet and no
way to make anything — is how an app stops feeling like one app.

What a shared roster adds on top of the personal one: an owner chip per row,
an **UNCLAIMED** stamp seal that opens the pick-up confirm, and creation gated by
§5a. Only entities the viewer **owns** offer a sheet link; ITUN's sheet is a live
editing surface, so opening a crewmate's would hand over an editor whose writes
the server refuses. The read-only drill-in §5 permits is a separate surface and
is not built — the crew vitals strip carries that information for now.

## Amendment — an invite carries what the Organizer decided

§3 gives the Organizer "invites, membership" and stops there, leaving a code as
a bare key and the seat and the hand-out as separate acts performed after the
fact. That is amended in one direction: **an invite now expresses a decision the
Organizer has already made.**

**An invite may be minted as a request.** With approval required, the code
identifies the Game and grants nothing until the Organizer lets the knocker in.
This adds no role and no membership state — a pending request is _not_ a
membership, and an approved one produces exactly the membership a direct redeem
would, through the same code path. Bearer codes remain the default; this is a
per-invite choice, not a mode.

The reason is §5. Membership confers read access to every crewmate's sheet, so
a code posted somewhere public is a broader disclosure than the Organizer
intended. Approval is the Organizer exercising the membership authority §3
already gives them, one step later.

**An invite may also carry a seat and a hand-out** — a `role` of Player or
Mediator, and a list of unclaimed entities handed over on join.

This sits alongside the self-claim amendment above rather than against it. That
amendment made an unclaimed entity an **offer to the crew**, which anyone may
accept; `assign` survived it as the table runner's power to place an entity with
a _particular_ person. An invite grant is exactly that power, scheduled: the
Organizer names the recipient in advance, and the Change Log records **them** as
`actorId` rather than whoever walked through the door. Both routes to ownership
respect the same boundary — neither can touch an entity somebody already holds.
A grant whose entity has since been claimed, moved, or deleted is **skipped, and
the join still succeeds**: arriving without the promised pilot is a notice,
whereas failing the join over a stale pointer would strand someone outside a
Game they were genuinely invited to.

Revocation becomes a **soft delete**, so an invite's redemption history stays
resolvable, and it never evicts anyone already seated: closing a door is not the
same act as removing someone from the room.

Enforced in `convex/invites.ts` (`seat`, `assertSpendable`, `decideRequest`).

## Amendment — the crawler can sit on a shelf, and deleting a Game destroys nothing

§5 says the crawler is **communal**, and the schema expressed that by giving it
no `ownerId` column at all and a non-nullable `gameId`: a crawler was a thing
that could only exist inside a Game. That second half is amended. `crawlers` now
carries the same two container columns as `pilots` and `mechs`.

**Communal is unchanged.** It is now written as `ownerId: null` on a row whose
`gameId` is set — the same fact, stated in a column instead of by a column's
absence. Any member may still edit the crawler, conflicting writes still resolve
by field-level merge, and raising or scrapping one inside a Game is still the
table runner's act under §5a.

What the amendment adds is the third row of §2's ownership table — `gameId:
null` with an owner, *on the shelf* — which the crawler was the one entity
unable to occupy. Two things were being worked around rather than fixed:

- **Deleting a Game had to destroy its crawler.** Pilots and mechs fell back to
  a shelf; the crew's home had nowhere to fall to.
- **Claiming a Solo roster invented a container.** `entities.claimLocal` parked
  a claimed crawler on a placeholder "Claimed crawler" Game of one, complete
  with a membership, because the shelf could not hold it. That Game appeared in
  the player's list as a table they never made.

`gameId == null && ownerId == null` remains the one invalid combination, for the
crawler exactly as for everything else — which is *why* a shelved crawler must
take an owner. A crawler stops being communal at the moment it leaves a Game,
because communal is a property of being in one.

### Deleting a Game

**Organizer only**, and deliberately not the table runner: `requireTableRunner`
hands authority to the Organizer only while a Game has no Mediator, which would
make who may end a campaign depend on whether one had been appointed yet.

Nothing anybody built is destroyed:

| What                            | Where it lands                 |
| ------------------------------- | ------------------------------ |
| a pilot or mech with an owner    | that owner's shelf            |
| an **unclaimed** pilot or mech   | the deleting Organizer's shelf |
| every **crawler**                | the deleting Organizer's shelf |

The first row was always the rule. The other two are new: unclaimed entities and
crawlers used to be deleted outright, on the reasoning that they had no shelf to
fall back to — true at the time, since both need a shelf row carrying an owner.
Both are expressible now, so both fall back, and the receiving shelf is the
deleter's because they are the one person guaranteed to exist and to be looking
at the consequence as it happens.

What does go is the **table**: memberships, invites, pending join requests, the
Mediator's opposition tray, and the soft links. A link is a fact about the
table's wiring rather than a possession — a pilot-to-crawler assignment means
"aboard this crew's crawler", which stops being true when the crew disbands — so
shelved entities land unwired.

### Why not keep a shelved crawler in the browser only

The rejected alternative was to copy the crawler into IndexedDB on deletion and
leave the server out of it, which needs no schema change. It is rejected on
principle: offline-first in ITUN is ordinary PWA caching, so the local store is
a **reflection** of Convex and never a second source of truth. A record with no
server row to reflect is invisible on the player's other devices, invisible to
sync, and lost with the browser's storage. `entityStore.adopt()` never mirrors,
and `mirrorEntityWrite` used to skip a crawler with `gameId === null` for exactly
this reason — that skip was the last place the client could hold data the server
had never heard of, and it is now closed.

## Amendment to ADR-022

ADR-022 states the Change Log is **local only** and never travels with a
published snapshot. The first half no longer holds: the log is now
**synchronized**, and gains `actorId`, a `state` of
`applied | proposed | rejected | superseded`, and a `supersededBy` pointer. A
proposal _is_ a log entry; applying one commits it.

The second half stands unchanged — **a published snapshot remains frozen,
historyless, and bare**. ADR-004 is not modified.

## Consequences

- **The app now holds PII.** Discord identifiers and profile data are real
  obligations the project did not previously have: account deletion, data export,
  and a plain-language privacy note are launch requirements, not follow-ups.
  Deleting an account transfers Organizer to the longest-standing remaining
  member and removes that account's owned entities; **the Game and the communal
  crawler survive**, so a campaign never dies because one person quit.
- **Anonymous use must keep working, forever.** Every feature that assumes a
  `userId` needs a defined Solo behaviour. This is the single most likely source
  of regressions.
- **Convex cannot validate entity bodies.** The Zod schemas in
  `apps/itun/src/lib/schemas/` stay the source of truth and Convex stores bodies
  opaquely, so **every mutation must Zod-parse before persisting**. The
  alternative — mirroring every field into Convex validators — forks the source of
  truth into a second copy that rots.
- **ADR-021's modes are unchanged**, but each now carries an ownership question:
  a surface must ask _whose entity is this_ before asking what the mode enforces.
- **Cost scales with concurrent players, not accounts**, since an open Dashboard
  is a live subscription. No cap, seat limit, or paid tier is introduced; usage is
  instrumented and revisited at a real number.
- **Two deploy targets.** The SPA stays on Netlify; Convex is a data backend, not
  a host.
- Not adopted, deliberately: CRDTs or full offline sync; turn/initiative
  enforcement across players; net-new homebrew authoring; any change to snapshot
  sharing; accounts on `apps/srd`, which stays static, public, and login-free.
