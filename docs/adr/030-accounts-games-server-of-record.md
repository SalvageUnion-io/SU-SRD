# ADR-030: Accounts, Games, and a Server of Record

The full record behind [Decisions](../ARCHITECTURE.md#decisions) entry 30, which summarises it.

## Status

**Accepted and built — governing ADR for identity, ownership, and sharing.**

[ADR-034](../ARCHITECTURE.md#decisions) **partially supersedes it**: §1's
promise that Solo mode — not signed in, IndexedDB as the source of truth —
"must keep working forever" is withdrawn. Persistence requires an account, and
nothing is kept on the device ([no device cache](../ARCHITECTURE.md#no-device-cache)).
Everything else here — Games, memberships, roles, ownership, the two
containers, Convex as server of record — stands.

**Supersedes [ADR-001](../ARCHITECTURE.md#decisions)** (local-first, no
backend, no auth). **Amends [ADR-022](../ARCHITECTURE.md#decisions)**
(the Change Log is no longer local-only). Extends
[ADR-021](021-cantina-surface-taxonomy.md) with an ownership axis without
altering any of its enforcement modes.

The operational reference is [Convex deployments](../ARCHITECTURE.md#deployments),
[Convex environment](../ARCHITECTURE.md#convex-env) and the `convex-ops` skill.

**Surfaces now** (amending §6): `/` is Shelves, everything the player keeps —
a unit in a Game stays listed, with a chip naming its Game; Patterns, NPCs and
the read-only Starter Set are shelves of their own. `/games/:id` is a Game's
page: its roster, then the members', Mediator's and Organizer's sections.
`/play/game/:id` is Play's Mediator screen
([play.md](../architecture/play.md) §10). "On your
shelf" in the page's sense means *yours*, not `gameId === null`; the container
model is unchanged.

**Amended:** §4 — a proposal carries its value and an optional reason, never a
before. §5 by [ADR-032](032-public-read-only-sheets.md) — a public read-only
sheet is the one exception to its visibility rules. §5a by
[ADR-037](../ARCHITECTURE.md#decisions) — a Game takes a player's crew before
it has a crawler. §5 and §6 by [ADR-038](038-dashboard-game-surface.md) — only
the table runner edits a Game's crawler, and crew status reaches the Game-only
Dashboard as a Crew tab. By [ADR-051](051-play-mode.md) — a pilot on a Shelf
has a seat too, seats carry presence, and a Game can bind a Discord channel
again (`channelBindings`).

## Context

[ADR-001](../ARCHITECTURE.md#decisions) made the Cantina local-first with no
accounts and no application backend, and it closes with an explicit instruction:
do not reintroduce auth, server-side user storage, or realtime sync without a new
ADR superseding it. This is that ADR.

The decision is not a reversal of ADR-001's reasoning — it is a change in what
the product is for. ADR-001 correctly observed that _a player's pilots and mechs
are private working documents, not multiplayer state_. That is still true of a
person building a mech alone. It stopped being the whole story once the goal
became running **a table**: several players, one Union Crawler, a Mediator, and a
shared session where a Downtime happens to everybody at once.

[ADR-021](021-cantina-surface-taxonomy.md) anticipated this precisely. Its
long-tail section listed **"Workspaces → Game spaces"**, a **"Shared, live
Dashboard"**, and a **"dedicated Mediator layer"** as out of scope and
_explicitly gated on revisiting ADR-001_. Nothing here is a surprise to the
architecture; this ADR opens the gate ADR-021 described.

Two existing decisions turned out to be well-shaped for this and were carried
over:

- **[ADR-027](../ARCHITECTURE.md#decisions)/[ADR-028](../ARCHITECTURE.md#decisions)**
  made partner ownership _intrinsic_ — partners ride their host through snapshots
  and export bundles with no orphan cleanup. That ports to per-user ownership with
  no change at all.
- **[ADR-022](../ARCHITECTURE.md#decisions)**'s Change Log is already
  append-only, ordered, replay-shaped, and tagged with provenance and source
  surface. It becomes the spine of this feature (see _Amendment_ below).

## Decision

### 1. Identity and the storage modes

The Cantina gains **accounts, authenticated by Discord OAuth and nothing else**. Discord
is the only provider because the audience already lives there and the project
already ships a bot, which this makes a first-class authenticated client rather
than something needing its own credential story.

**Convex is the server of record.** A signed-in client reads through a reactive
subscription and writes to Convex; nothing is kept on the device
([no device cache](../ARCHITECTURE.md#no-device-cache)). Reactive subscriptions are the product feature here — synchronized
alerts and a live table are the point — not an add-on.

This produces **four modes** — Solo, Connected, Disconnected, Outdated — and
every surface must be legible in all of them; the table is
[`.claude/rules/cantina-data-access.md`](../../.claude/rules/cantina-data-access.md). A **NOT CONNECTED** banner and
read-only state are the honest cost of choosing a server of record, and only a
signed-in user offline ever pays it.

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

An entity is in at most one Game by construction (`gameId` is a **single
nullable column**), so there is nothing to fork. `MoveToContainerControl`
re-stamps `gameId` in place and `entities.upsertByAppId` re-homes the existing
row: that in-place move **is** the design, and the absence of a fork mutation is
not a gap for somebody to close later.

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
arrives on the player's Game page with its value and the Mediator's reason, if
any, and the player applies or declines it. Proposals persist until answered — no timers, no expiry,
and **no force-apply**, which would collapse this straight back into the direct
write this decision rejects. A newer proposal against the same field marks the
older one superseded, so a player never faces two contradictory pending changes
to one value.

This keeps ADR-001's honour-system ethos intact while giving the Mediator real
reach, and it means **alerts and cross-player writes are one mechanism, not two**.

Owners may always **release** what they hold, and the Mediator may **reassign**,
so a mis-assignment is fixable. A player may own any number of entities in a
Game — solo play and covering for an absent player both need it.

**Players self-claim what is offered.** An unclaimed entity is an **offer to
the crew** — that is the whole reason the Mediator pre-builds characters and a
template seeds six of them — so a player taking one is accepting an offer, not
seizing anything. Requiring the Mediator to hand each one over individually
would add a round trip to the first ten minutes of every table and buy no
safety.

**Claiming touches only what is free.** An entity somebody already holds
cannot be taken; it must be released first, by its owner or by the Mediator.
`assign` remains the table runner's power to place an entity with a
_particular_ person, which self-claim cannot express.

### 5. Visibility

Inside a Game, every member sees every crewmate's **vitals live** and may drill
into a crewmate's full sheet **read-only**. The Mediator's prepared opposition
(`encounterNpcs`) is the one thing that stays hidden. The **crawler is communal**:
no owner, read by every member, edited only by the table runner
([ADR-038](038-dashboard-game-surface.md) §5), with writes merged per field.

### 5a. Setting the table up: who raises the crawler, and when a Game takes crew

Communal is not free-to-**create**:

- **Raising and scrapping a crawler is the table runner's act** — the Mediator,
  or the Organizer while a Game has no Mediator (the same narrow fallback §3
  already grants for assignment, and for the same reason: a Game is created with
  `mediator: false` on its only membership, so a Mediator-strict rule would make
  every new Game an unreachable state). So is filling its fields (§5, as
  amended by [ADR-038](038-dashboard-game-surface.md) §5).
- **Any member may bring their pilots and mechs into any Game they belong
  to**, crawler or not ([ADR-037](../ARCHITECTURE.md#decisions)). The first
  crawler to arrive becomes the Game's **primary** and takes aboard everyone
  already there, and whoever enters later is assigned to the primary on the way
  in. Moving a crawler into or out of a Game is the table runner's act.
- **A Game may hold several crawlers.** This was always true of the schema and is
  now true of the surfaces. A campaign that loses a crawler and rebuilds, or
  meets and eventually joins a second, is ordinary play rather than a state to
  reject.

The line all three sit on: a table runner arranges **what the crew sails in and
who holds what**, and still cannot change a number on somebody else's sheet. For
that there is a proposal (§4).

Enforced in `convex/model/permissions.ts` (`requireTableRunner`) and
`convex/entities.ts`, and mirrored — never re-decided — for the UI in
`apps/web/src/lib/games/gameRoster.ts`.

### 6. Surfaces

The **Mediator gets its own surface**, the layer ADR-021 deferred; the Encounter
tray is absorbed into it and `/encounter` retires. The player Dashboard's locked
1280×800 canvas ([ADR-038](038-dashboard-game-surface.md) §9) is
**not** reopened: crew vitals arrive as a Crew tab in the display
([ADR-038](038-dashboard-game-surface.md) §4).

**A Game's crew is rendered as the Roster renders a shelf.** `/games/:id` (any
member) opens with the same three ontology-toned columns of Rows (`UnitRow`)
Shelves uses, with a create CTA per column. The Mediator's instruments are
`/mediator/:id`, a 1280×800 canvas
([mediator-dashboard.md](../architecture/mediator-dashboard.md)). A Game asks "what have we got and what can I do with it"
of a different container, and answering it in a second visual vocabulary is how
an app stops feeling like one app.

What a shared roster adds on top of the personal one: an owner chip per row,
an **UNCLAIMED** stamp seal that opens the pick-up confirm, and creation gated by
§5a. Every row opens its live sheet: editable when the viewer may edit it,
otherwise the read-only drill-in §5 permits, `/sheet/:kind/:id`.

## Amendment — a Game has one invite URL

§3's "invites" is one URL per Game, `/invite/:code`. Anyone signed in who
opens it joins as a player; it has no expiry, use limit, label, seat choice or
approval step. The Organizer copies it (`invites.link`, "Copy invite link" on
the Game page) and can reset it
(`invites.reset`), which mints a new code: the old one stops working, and
nobody already seated is removed. Who mediates is chosen afterwards among the
members (`games.setMediator`). Signed out, the page previews the Game and
offers "Sign in to join", returning with `?join=1` to join on arrival; old
`/join/:code` links 301 to `/invite/:code`
(`apps/web/src/lib/redirects.ts`). The live code is the Game's
newest open standing invite row (`convex/model/invites.ts#currentInvite`);
every other row opens nothing.

## Amendment — the crawler can sit on a shelf, and deleting a Game destroys nothing

§5 says the crawler is **communal**, and the schema expressed that by giving it
no `ownerId` column at all and a non-nullable `gameId`: a crawler was a thing
that could only exist inside a Game. That second half is amended. `crawlers` now
carries the same two container columns as `pilots` and `mechs`.

**Communal is unchanged.** It is now written as `ownerId: null` on a row whose
`gameId` is set — the same fact, stated in a column instead of by a column's
absence. Conflicting writes still resolve by field-level merge, and raising,
scrapping and (since [ADR-038](038-dashboard-game-surface.md) §5) editing one inside a Game are the
table runner's acts.

What the amendment adds is the third row of §2's ownership table — `gameId:
null` with an owner, *on the shelf* — which the crawler was the one entity
unable to occupy. Without it, deleting a Game had to destroy its crawler:
pilots and mechs fell back to a shelf, and the crew's home had nowhere to fall
to.

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

The receiving shelf for the last two rows is the deleter's because they are the
one person guaranteed to exist and to be looking at the consequence as it
happens.

What does go is the **table**: memberships, invites, the
Mediator's opposition tray, and the soft links. A link is a fact about the
table's wiring rather than a possession — a pilot-to-crawler assignment means
"aboard this crew's crawler", which stops being true when the crew disbands — so
shelved entities land unwired.

## Amendment to ADR-022

ADR-022 states the Change Log is **local only** and never travels with a
published snapshot. The first half no longer holds: the log is now
**synchronized**, and gains `actorId`, a `state` of
`applied | proposed | rejected | superseded`, and a `supersededBy` pointer. A
proposal _is_ a log entry; applying one commits it.

The second half no longer applies: [ADR-036](../ARCHITECTURE.md#decisions)
retired snapshots.

## Consequences

- **The app now holds PII.** Discord identifiers and profile data are real
  obligations the project did not previously have: account deletion, data export,
  and a plain-language privacy note are launch requirements, not follow-ups.
  Deleting an account transfers Organizer to the longest-standing remaining
  member and removes that account's owned entities; **the Game and the communal
  crawler survive**, so a campaign never dies because one person quit.
- **Anonymous use still works**, but nothing it builds persists without an
  account ([ADR-034](../ARCHITECTURE.md#decisions)).
- **Convex cannot validate entity bodies.** The Zod schemas in
  `packages/game-domain/src/schemas/` stay the source of truth and Convex stores bodies
  opaquely, so **every mutation must Zod-parse before persisting**. The
  alternative — mirroring every field into Convex validators — forks the source of
  truth into a second copy that rots.
- **ADR-021's modes are unchanged**, but each now carries an ownership question:
  a surface must ask _whose entity is this_ before asking what the mode enforces.
- **Cost scales with concurrent players, not accounts**, since an open Dashboard
  is a live subscription. No cap, seat limit, or paid tier is introduced; usage is
  instrumented and revisited at a real number.
- **Two deploy targets.** The SPA has its own host (a Cloudflare Worker since
  ADR-033); Convex is a data backend, not a host.
- Not adopted, deliberately: CRDTs or full offline sync; turn/initiative
  enforcement across players; net-new homebrew authoring; any change to snapshot
  sharing; accounts on `apps/web`, which stays static, public, and login-free.
