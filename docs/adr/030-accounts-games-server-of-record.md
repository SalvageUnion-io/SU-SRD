# ADR-030: Accounts, Games, and a Server of Record

The governing decision for identity, ownership and sharing. Operations:
[deployments](../ARCHITECTURE.md#deployments), [environment](../ARCHITECTURE.md#convex-env)
and the `convex-ops` skill. Amended by [ADR-051](051-play-mode.md): a pilot on a
Shelf has a seat too, seats carry presence, and a Game can bind a Discord
channel (`channelBindings`).

## 1. Identity and the storage modes

Accounts are **Discord OAuth and nothing else**: the audience lives there, and
the bot becomes a first-class authenticated client.

**Convex is the server of record.** A signed-in client reads through reactive
subscriptions (the live table is the point) and writes to Convex; nothing is
kept on the device ([no device cache](../ARCHITECTURE.md#no-device-cache)).
Signed out, nothing persists (ADR-034). The four modes (Solo, Connected,
Disconnected, Outdated) are
[`.claude/rules/app-data-access.md`](../../.claude/rules/app-data-access.md);
every surface must be legible in all of them.

Offline writes are **blocked, not queued**: an outbox brings back the conflict
resolution a server of record avoids. Revisit only with evidence from a real
session.

## 2. Containers: Games and Shelves

A **Game** is the shared container (campaign, group and workspace in one). A
**Shelf** is a per-account home for entities not in play: no Mediator, no
invites, no crew, synced across devices.

An entity is in exactly one container, encoded as two nullable columns:

| `gameId` | `ownerId` | State                                                  |
| -------- | --------- | ------------------------------------------------------ |
| set      | set       | claimed and in play                                    |
| set      | null      | **unclaimed**, awaiting assignment (communal for a crawler) |
| null     | set       | on the owner's shelf                                   |
| null     | null      | **invalid**: unreachable through any mutation          |

**Move and copy are different verbs.**

| Verb     | Result |
| -------- | ------ |
| **Move** | The **same** entity: same id, body and history; only `gameId` changes. |
| **Copy** | A **new** entity: new id, `COPY OF <name>`, always `gameId: null`, no relationship to the source or its Game. |

`gameId` is a single nullable column, so there is nothing to fork:
`MoveToContainerControl` re-stamps `gameId` in place and
`entities.upsertByAppId` re-homes the row. The absence of a fork mutation is
the design, not a gap.

## 3. Roles: a base role plus one modifier

Every member is a **Player** or a **Mediator**; **Organizer** is an orthogonal
administrative flag on one of them.

- **Player** — owns their own pilots and mechs. The default.
- **Mediator** — owns the world: NPCs, alerts, the Downtime phase; may also
  play a pilot. The schema permits several; the UI is built for one.
- **Organizer** — invites, membership, settings, rename, delete, transfer.
  Exactly one per Game. **Confers no authority over game content.**

Assigning ownership belongs to the Mediator and falls back to the Organizer
while a Game has no Mediator (the **table runner**), so someone can always hand
out a pilot.

## 4. Cross-player writes: propose, never impose

**A Mediator never writes another person's sheet.** They push a **proposal**
(its value and an optional reason, never a before); it arrives on the player's
Game page, and the player applies or declines it. Proposals persist until
answered: no expiry, **no force-apply**. A newer proposal on the same field
supersedes the older one. Alerts and cross-player writes are one mechanism.

Owners may always **release** what they hold; the Mediator may **reassign**. A
player may own any number of entities in a Game. **Players self-claim** an
unclaimed entity (it is an offer to the crew), but claiming touches only what
is free: a held entity must be released first. `assign` is the table runner's
power to place an entity with a particular person.

## 5. Visibility

Every member sees every crewmate's **vitals live** and may open a crewmate's
sheet **read-only**. The Mediator's prepared opposition (`encounterNpcs`) stays
hidden. The **crawler is communal** (`ownerId: null` in a Game): read by every
member, edited only by the table runner ([ADR-038](038-dashboard-game-surface.md) §5),
writes merged per field. A public sheet ([ADR-032](032-public-read-only-sheets.md))
is the one exception.

## 5a. Setting the table up

- **Raising, scrapping and filling a crawler is the table runner's act.** (A
  Game is created with no Mediator, so a Mediator-strict rule would strand it.)
- **Any member may bring their pilots and mechs into a Game they belong to**,
  crawler or not. The first crawler becomes the **primary** and takes aboard
  everyone present; later arrivals are assigned to it. Moving a crawler in or
  out is the table runner's act.
- **A Game may hold several crawlers.**

A table runner arranges what the crew sails in and who holds what, and still
cannot change a number on somebody else's sheet: that is a proposal (§4).
Enforced in `convex/model/permissions.ts` (`requireTableRunner`) and
`convex/entities.ts`; mirrored, never re-decided, in
`apps/web/src/lib/games/gameRoster.ts`.

## 6. Surfaces

`/` is the Hangar (the Shelf): everything the player keeps, a unit in a Game
listed with a chip naming it; Patterns, NPCs and the Starter Set are shelves of
their own. `/games/:id` is a Game's page: its roster in the same ontology-toned
columns of Rows (`UnitRow`), then the members', Mediator's and Organizer's
sections. A shared roster adds an owner chip per row and an **UNCLAIMED** seal
that opens the pick-up confirm. Every row opens its live sheet, editable or the
read-only drill-in §5 permits (`/sheet/:kind/:id`). The Mediator's screen is
Play's, `/play/game/:id` ([play.md](../architecture/play.md) §10).

## Invites

One URL per Game, `/invite/:code`. Anyone signed in who opens it joins as a
player: no expiry, limit, label or approval. The Organizer copies it
(`invites.link`) and can reset it (`invites.reset`: a new code, nobody
removed). Who mediates is chosen afterwards (`games.setMediator`). Signed out,
the page previews the Game and returns with `?join=1`. The live code is the
Game's newest open standing invite row (`convex/model/invites.ts#currentInvite`).

## Deleting a Game

**Organizer only** (not the table runner). Nothing anybody built is destroyed:

| What                            | Where it lands                 |
| ------------------------------- | ------------------------------ |
| a pilot or mech with an owner    | that owner's shelf            |
| an **unclaimed** pilot or mech   | the deleting Organizer's shelf |
| every **crawler**                | the deleting Organizer's shelf |

A shelved crawler takes an owner (`null`/`null` stays invalid). What goes is
the table: memberships, invites, the opposition tray and the soft links, so
shelved entities land unwired.

## The Change Log

The log is synchronized, with `actorId`, a `state` of
`applied | proposed | rejected | superseded`, and `supersededBy`. A proposal
is a log entry; applying one commits it.

## Consequences

- **The app holds PII:** account deletion, data export and a privacy note are
  requirements. Deleting an account transfers Organizer to the
  longest-standing member and removes that account's owned entities; the Game
  and its communal crawler survive.
- **Convex stores entity bodies opaquely**: every mutation Zod-parses
  (`packages/game-domain/src/schemas/`) before persisting. Never mirror the
  fields into Convex validators.
- A surface asks *whose entity is this* before asking what its mode enforces.
- Not adopted: CRDTs or offline sync, turn enforcement across players, net-new
  homebrew authoring.
