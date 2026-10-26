# ADR-064: Cloudflare rooms are the server of record

Decided 2026-10-25 for 4.5.0 (Jrvs: "use Cloudflare as much as possible").
Builds on ADR-063 (typed ops are the write): what moves is an op log and its
snapshots, so the move is a data copy, not a redesign.

- **Supersedes** [ADR-030](030-accounts-games-server-of-record.md) §1's
  sentence "Convex is the server of record" and
  [ADR-033](033-hosting-on-cloudflare.md) §5 ("Convex stays").
- **Moved** at 4.5.0: the Areas [rooms](../ARCHITECTURE.md#rooms),
  [device-copy](../ARCHITECTURE.md#device-copy), [stores](../ARCHITECTURE.md#stores),
  [sharing](../ARCHITECTURE.md#sharing), [deployments](../ARCHITECTURE.md#deployments),
  [worker-env](../ARCHITECTURE.md#worker-env),
  [room-conventions](../ARCHITECTURE.md#room-conventions) and
  [bot-game-client](../ARCHITECTURE.md#bot-game-client).

## Context

Convex holds every account's units in shared tables, keyed by `gameId` and
`ownerId`, and serves the live table through reactive queries. The site
already runs on one Cloudflare account (ADR-033), so Convex is a second vendor,
a second deploy and a second auth system. The live table pays for its
reactivity in writes: a seat heartbeat every 20 seconds per player re-runs the
crew queries for everyone at the table.

A Durable Object with SQLite storage is a single-threaded server with its own
database, addressed by name. One per account and one per Game matches the
containers ADR-030 §2 already draws: a unit is in exactly one container, so it
is in exactly one room.

## Decision

1. **An account room per player.** A SQLite Durable Object named by the
   account id holds that player's shelf: pilots, mechs, crawlers, NPCs,
   patterns, the NPC tray, encounters, each unit's op log and snapshot, and a
   summary of the units the player holds in Game rooms (so the Training Bay
   lists all they own, ADR-052 §1). All of a player's devices hold a socket to
   it and see one shelf.
2. **A Game room per Game.** A SQLite Durable Object named by the Game id holds
   members and roles, the invite token, units in the Game with their op logs,
   seats, the feed and rolls, the Opposition tray and running encounter
   (secret to the Mediator, ADR-059 §4), Downtime, proposals and links. The
   live table is a socket per player with WebSocket hibernation; presence is
   who is connected, held in memory and never stored.
3. **D1 for what crosses rooms.** Accounts (keyed by Discord id), membership
   lookup, invite tokens, public sheets (ADR-032), homebrew listing and
   moderation (ADR-061), metrics and the feedback queue (ADR-057). Rooms write
   these rows when the fact changes; D1 is an index, never a second home for a
   unit.
4. **R2 for artwork and backups.** Artwork as today; a nightly export of every
   room's log beyond the 30 days of point-in-time recovery Durable Objects
   keep.
5. **The site Worker is the only door.** It signs players in (Discord OAuth, an
   HttpOnly session cookie), checks the session, and forwards to the room by
   name. A room trusts the identity the Worker hands it and enforces roles
   itself. The bot reaches rooms over a service binding with the player's
   identity, not an HTTP door with a shared secret.
6. **Room logic is plain TypeScript.** Each room is a class over a small SQL
   interface, tested under `bun test` with `bun:sqlite`; the Durable Object is a
   thin wrapper (sockets, alarms, storage) with its own workerd test suite.
   The rules stay `applyOp` in `game-domain`, run by client and room alike.
7. **One cutover.** Convex stays live and of record through 4.5.0's
   development. Production moves at the deploy of the 4.5.0 release, after a
   rehearsal on a Preview against a copy of production; Convex stays read-only
   for a quiet period as the rollback path, and its project is deleted only on
   Jrvs's go.

## What we build ourselves

Rooms give a server, storage, sockets and recovery. We build:

- **Auth:** Discord OAuth in the Worker, sessions, D1 accounts. During the
  move the Worker also mints a short-lived JWT that Convex accepts as a custom
  provider, so Convex functions keep working with the new sign-in.
- **Cross-room moves:** a unit moving between an account room and a Game room
  is a two-step handoff (the source marks it leaving, the target accepts it,
  the source drops it), so it is never in two homes or none. Copy stays a new
  unit (ADR-030 §2).
- **Migrations:** each room's schema is versioned and migrated in its
  constructor, before it serves a request.
- **Backups:** the nightly R2 export (decision 4).
- **Global reads:** anything that lists across rooms reads D1 (decision 3),
  which the rooms keep in step.

## Consequences

- One vendor, one deploy and one auth system; local dev runs rooms in Wrangler
  with no extra backend binary.
- A room handles hundreds of requests a second and up to 10 GB; a table of six
  sends a few a minute, so scale is not a design force.
- Hibernated rooms bill no duration, so idle Games cost nothing.
- Queries across rooms are impossible by construction: a new cross-player read
  needs a D1 row written by the room that owns the fact.
- Two test runners: `bun test` for room logic, Vitest with
  `@cloudflare/vitest-plugin` for the Durable Object wiring only.
- Previews never reach production's rooms or D1.
