# ADR-053: A Read-Only Device Copy of the Player's Own Sheets

Decided 2026-10-22 (4.1.0, Jrvs: "SRD + the signed-in player's own sheets,
read-only; edits wait until back online").

- **Amends** [ADR-034](../ARCHITECTURE.md#decisions) and
  [ADR-030](030-accounts-games-server-of-record.md) §1: "nothing is kept on
  the device" becomes "nothing but a read-only copy of the player's own rows".
  Convex stays the server of record; offline writes stay blocked, not queued.
- **Replaces** the Area "No device cache" with
  [Device copy](../ARCHITECTURE.md#device-copy).

## Context

A table with bad wifi is the common case, and an installed app opened offline
booted signed out and empty: the reference read fine, a player's own sheet did
not. Mid-session a dropped connection kept the open sheet; a reload lost it.

## Decision

1. **What is kept.** The last answers `ShelfSync` applied from
   `entities.listMine` (the player's pilots, mechs, crawlers, NPCs, patterns
   and NPC tray) and `entities.listWiring` (their links, and the crawlers of
   their Games, which their sheets name), verbatim, after each emission
   (`stores/deviceCopy.ts`). One record in IndexedDB, stamped with the account.
   Nothing a Game holds beyond that (its feed, seats, Opposition) is kept.
2. **Whose.** The account is the subject of the session token Convex Auth
   keeps on the device. A copy stamped for another account is never read.
   Signing out drops it, as does a load that starts signed out.
3. **When it is read.** Only on a load that boots offline with a session on
   the device. Such a load is Disconnected at once (the handshake cannot
   settle offline), its stores wait for the restore, and the copy is applied
   through the same code as a served answer (`stores/shelfApply.ts`).
   A load that has had a served answer never reads it.
4. **Read-only.** Disconnected refuses every write, so the copy never holds a
   change the server has not accepted, and nothing merges when the connection
   returns: `ShelfSync` mounts and the server's answer wins.
5. **The SRD.** Already offline: the service worker precaches every app chunk
   (the reference data the builder and Play read), and an installed app warms
   every reference page (ADR-034 decision 3). Unchanged.

## Consequences

- An offline reload shows the player's roster and sheets, read-only, under the
  NOT CONNECTED banner; `e2e/app-offline.e2e.ts` pins it.
- A shared device shows the copy only to the account signed in on it; signing
  out clears it.
- Offline is `navigator.onLine`. Wifi that claims a connection but carries
  nothing still waits on the handshake, as before.
