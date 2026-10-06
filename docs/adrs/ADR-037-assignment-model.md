# ADR-037: The Assignment Model — Direct Links, Cardinality, One Container

## Status

**Accepted.** Extends [ADR-030](ADR-030-accounts-games-server-of-record.md)
(Games, containers, ownership) with rules for the soft links that wire pilots,
mechs and crawlers together, and **amends ADR-030 §5a**: a Game no longer
waits for a crawler before it takes a player's crew (see *Moves* and *The
primary crawler*). ADR-030's container model — one nullable `gameId`,
the shelf as "My stuff" — is the ground this stands on and is unchanged.

The rules are code in one place, `apps/itun/src/lib/links/linkRules.ts`, imported
by the client store and by `apps/itun/convex/` alike.

## Context

A soft link is an assignment: this mech carries this pilot, this pilot crews
this crawler. Three things were wrong with how they worked, and each one showed
up as a player-visible bug.

1. **A mech had no crawler of its own.** It reached one through its pilot
   (`mech-to-pilot`, then the pilot's `pilot-to-crawler`). A mech without a
   pilot was homeless, a mech followed its pilot wherever they crewed, and
   "assign this mech to the crawler" was not a sentence the model could say.
2. **Nothing bounded how many.** A pilot could crew two crawlers and a mech fly
   two pilots; readers took whichever `links.find` met first. Only the
   Dashboard chooser removed conflicting links, and only its own.
3. **Nothing kept both ends together.** The server validated the `from` end
   (permission, container) and stored `to.id` as a free string. A pilot on a
   shelf could be wired to a crawler in a Game, and moving an entity left its
   links filed where it used to be.

And the links never came back down. `listMine` returned none, `listForGame`'s
were read by nothing, and a Game's crawler — owned by nobody — was never in any
query the cache was filled from. So a pilot assigned to a crawler from one
device, or by a crewmate, showed as unassigned everywhere else.

## Decision

### Three link types, each one hop

| type               | from  | to      | from holds | to holds |
| ------------------ | ----- | ------- | ---------- | -------- |
| `mech-to-pilot`    | mech  | pilot   | ≤ 1        | ≤ 1      |
| `pilot-to-crawler` | pilot | crawler | ≤ 1        | many     |
| `mech-to-crawler`  | mech  | crawler | ≤ 1        | many     |

`mech-to-crawler` is new. A mech's crawler is its own link; there is **no
fallback** through its pilot anywhere — a mech with no direct link has no
crawler. Mechs and pilots are assigned independently.

### Drawing a link replaces what it conflicts with

Assigning a pilot to a second crawler is a move, not an error. The conflicting
link (same `from`; or, for `mech-to-pilot`, same `to`) is deleted **in the same
write** that draws the new one — one Convex mutation (`writeSoftLink`), one
IndexedDB transaction (`entityStore.create('softLink')`).

Replacing a link drawn out of somebody else's mech — the other mech flying this
pilot — is allowed to the owner of that mech or of the pilot, and to nobody
else: the pilot's owner decides who flies them, the mech's owner what it
carries.

### Both ends share one container

The same Game, or the same owner's shelf. "My stuff" is a solo Game for every
purpose here: two players' shelves share the `null` game id, so the server also
compares owners. Drawing a link across containers is refused — by the client
store when it holds both ends, and always by the server, with a player-facing
`ConvexError`. A move prunes every link it would leave straddling two
containers and re-files the rest, server-side in the move mutation and mirrored
in the store.

A link's `gameId` column is its container, and moves with its ends.

### Links and Game crawlers sync down

`entities.listWiring` returns every link drawn out of an entity the caller owns,
every link in a Game they belong to, and every crawler in those Games.
`WiringSync` (beside `ShelfSync`) reconciles it into the cache — server wins,
pruning only where the answer covers and only under `ShelfSync`'s prune guard.
Other members' pilots and mechs are **not** cached: they are read live and
read-only from `listForGame`, and a cached copy of somebody else's sheet is an
editor whose every save the server refuses.

### Where each rule is enforced

| Rule                   | Server (authority)                                        | Client (mirror)                                   |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| type matches its ends  | `upsertSoftLink` (`endsMatchType`)                        | `createSoftLink` in `entityStore.ts`              |
| cardinality / replace  | `writeSoftLink` (`model/entities.ts`), used by every writer | `createSoftLink` (`conflictingLinks`)            |
| one container          | `upsertSoftLink` (`sameContainerRows`); `claimLocal` declines | `createSoftLink` (`sameContainer`)            |
| move prunes            | `pruneLinksAcrossContainers` in `upsertByAppId`           | `pruneLinksAfterMove` in `entityStore.update`     |
| scrap/delete cascades  | `pruneSoftLinksFor` in every remove path                  | `deleteEntityWithSoftLinks`                       |

`assignLink` (`src/lib/links/assignLink.ts`) is the one client entry point:
type from the ends, rules in the store, a refusal surfaced as `LinkRefused`.

### Moves

The server is the authority (`convex/entities.ts`); `moveDestinations` in
`apps/itun/src/lib/games/gameRoster.ts` mirrors it so `MoveToContainerControl`
lists only what would be accepted.

- **Pilots and mechs** — the owner moves them from My stuff into any Game they
  are a member of, between Games, and back. The old gate ("a Game takes a
  player's crew once it has a crawler", ADR-030 §5a) is gone, for creating in
  a Game as well as moving in.
- **Crawlers** — only the table runner, and only between their own shelf and a
  Game they run (`entities.moveCrawler`): in, it becomes communal (`ownerId:
  null`); out, it becomes theirs. Game to Game is two moves. The mutation
  writes the row's `gameId`, the body's `gameId` and `ownerId` together; the
  field-level crawler patch strips any `gameId` it is sent, so the body can
  never name a container the row is not in.

### The primary crawler

`games.primaryCrawlerId` (optional; absent means "the oldest crawler here").

- **Explicit link on entry.** A pilot or mech created in a Game, or moved into
  one, is assigned to the primary by a link the server writes as part of that
  add or move — an internal write, not subject to `upsertSoftLink`'s
  from-owner check. With no primary there is no link.
- **The first crawler picks up the crew.** A crawler raised in or moved into a
  Game with none becomes primary, and every pilot and mech already there with
  no crawler of their own is assigned to it.
- **Fallback.** A primary that is scrapped or moved out is replaced by the
  oldest crawler left, or none.
- **Changing it moves nobody.** The table runner may name another
  (`games.setPrimaryCrawler`, "Make primary" on the Game roster); only later
  arrivals go to it. Players may still reassign their own entities to any
  crawler in the Game.
- The Games list's crawler name, `listForGame`'s `primaryCrawlerId` and the
  Discord bot's crew board all read the primary (`primaryCrawlerOf`).

### Existing data

`maintenance.repairSoftLinks` (dry run by default) deletes duplicates,
cross-container links and cardinality losers (the newest surviving assignment
wins), re-files the rest, then backfills `mech-to-crawler` for every mech whose
pilot crews a crawler in its container. IndexedDB migration v17 draws the same
backfill locally, so a pre-account roster still waiting to be claimed uploads
with its mechs docked.

## Consequences

- A mech moved without its pilot leaves the pilot's wiring behind, and vice
  versa: moving a pilot into a Game drops its link to a mech still on the shelf.
  That is the rule working, but it means moving a pair is two moves and a
  re-assignment.
- Template-seeded rows carry no `appId` and share body ids across every Game
  seeded from the same template. Link resolution falls back to a body-id match
  inside the link's own Game, and conflict checks are scoped to the container,
  so those Games keep working; the rows remain unaddressable by the ordinary
  mirror, which is a separate defect.
- `listWiring` reads the caller's own pilots and mechs to find their links, so
  it re-runs on their edits. The reconcile is idempotent and writes nothing
  when nothing changed.
- Until `repairSoftLinks` runs after the deploy, a mech that reached its bay
  through its pilot shows undocked.
- A Game that predates `primaryCrawlerId` has its oldest crawler as primary;
  the first crawler event there writes that down. Nobody already in such a
  Game is auto-assigned — the backfill runs only when a Game gets its first
  crawler.
