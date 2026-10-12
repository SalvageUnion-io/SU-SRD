---
status: proposed
---

# ADR-044: Built NPCs and the `npc-to-crawler` Link

## Status

**Proposed; built on `design-refresh` (2026-10-09), owner to confirm.**
Amends [ADR-037](037-assignment-model.md) with a fourth link type, the one link authorised
by its `to` end. [ADR-030](030-accounts-games-server-of-record.md), [ADR-032](032-public-read-only-sheets.md) and
[ADR-034](034-persistence-requires-account.md) apply to the new entity unchanged. The model and the
surfaces are [architecture/npc-builder.md](../architecture/npc-builder.md).

## Context

Issues 1269 and 1277 add an NPC anyone can build and assign to a crawler's
crew slots: the type's special NPC and one per bay. ADR-037's links are
slot-free and are authorised by the `from` end's owner. In a Game the NPC may
belong to a player, while the crawler is communal and edited only by the
table runner (ADR-030 §5), who alone assigns crew.

## Decision

1. **A fourth owned entity.** A Convex table `npcs` with the pilot columns.
   Containers, `publicRead`, moves and copies follow pilots exactly. A built
   NPC is never an `encounterNpcs` row.
2. **`npc-to-crawler`.** From an NPC to a crawler. It carries a required
   `slot`: `{ kind: 'bay', bayRef }` or `{ kind: 'type' }`. No other type may
   carry a slot. The `from` end holds at most one link, and so does each
   (crawler, slot) pair. Drawing a link replaces what it conflicts with, in
   the same write (ADR-037).
3. **Authorised by the `to` end.** Whoever may write the crawler draws and
   deletes these links: its owner on a shelf, the table runner in a Game.
   The one-container rule, move-prunes and delete-cascade hold as in ADR-037.
   The rules live in `apps/itun/src/lib/links/linkRules.ts` with the others;
   the server enforces them in `apps/itun/convex/entities.ts`.
4. **A link replaces; it never overwrites.** A linked slot renders the NPC.
   Neither linking nor unlinking writes the crawler's inline crew, so removing
   the link restores it unchanged.

## Consequences

- A player's NPC crewing a Game's crawler is still theirs. They track its HP,
  and the Mediator reads it read-only.
- An older client cannot parse the new link type. The change is compatible
  as far as `client-contract` sees, but it is a stored shape older code
  cannot read, so the build floor was raised (ADR-042).
- A crawler with two entries of the same bay can crew only the first.
- An NPC with max HP 0 (the Augmented A.I.) is never shown as down.
