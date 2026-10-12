# NPC Builder

A built NPC is ITUN's fourth owned entity, designed by anyone and able to crew a crawler's slots. Decisions: ADR-044 in [ARCHITECTURE.md](../ARCHITECTURE.md).

1. **§1 Record** — `packages/itun-domain/src/schemas/npc.ts`: the `npcs` stat block plus a crew member's identity; actions are slugs, traits the package's refs, never copies.
   Owned and synced like a pilot, never an `encounterNpcs` row; `apps/itun/src/lib/npcs/npcModel.ts` reads it against the reference.
2. **§2 Assignment** — The `npc-to-crawler` link carries the slot (`bay` or `type`); one NPC per slot, authorised by the crawler's owner or table runner.
   A linked slot replaces the inline crew without writing it, so unlinking restores it; conflicts live in `packages/itun-domain/src/links/linkRules.ts`.
3. **§3 Storage modes** — Solo: sign-in panel. Disconnected or Outdated: designer opens but cannot save; crew board read-only. A member's NPC is read live, never cached.
4. **§4 Surfaces** — Designer, sheet, crew board, a fourth roster column, and linked slots on the crawler sheet (`apps/itun/src/components/npc/`).
   - **§4.1 Designer** — Template → Stats → Actions & traits → Identity → Review beside a live preview; Start blank is a tile, not a mode.
     Form state: `apps/itun/src/lib/wizard/npcFormState.ts`. Gates: a name and HP ≥ 1; Roll only where the data has a table.
   - **§4.2 Sheet** — `/sheet/npc/:id`: the user-made card and the identity panel, with move and delete.
   - **§4.3 Crew board** — The crawler type's slot and one per bay: design, assign, unassign.
5. **§5 Phone and accessibility** — Below 48rem: a one-line step strip, sticky Back/Next, a Preview button, full-height slot modal.
   Repeated controls name their target; the open slot carries `aria-current`; a Roll is announced once, politely.
6. **§6 Tests** — `apps/itun/e2e/npc-crew.e2e.ts` and `apps/itun/test/convex/npcs.test.ts`.
