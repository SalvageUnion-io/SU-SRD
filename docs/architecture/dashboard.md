# Play State and Rules

Superseded by [play.md](play.md) (ADR-051): the Dashboard is retired, and `/dashboard/$pilotId` redirects to Play. What stands below is the play state and the rules driver Play kept; layout, launch and the phone form are play.md's.

Decisions: ADR-038, ADR-045 ([ARCHITECTURE.md](../ARCHITECTURE.md)); code cites § labels.

1. **§1 Purpose** — Guided Play over the same entities, store and rules as the live sheet; never a second editor.
2. **§2 Layout** — Retired: play.md §2 (the Cockpit frame) and §11 (phone).
3. **§3 Reuse** — Entities are `ReferenceEntityCard`, tables `RollTableInstrument` (`PlayRollTable`); never fork.
4. **§4 State** — Vitals, uses and cargo persist on the records through `entityStore.update`; mount, range, `activeEffects`, resolving and ejected live on the seat (`convex/seats.ts`).
   Rolls are Game rows in the change log, Downtime is the Game's `downtime` row, and maxima and crew status are derived, never stored.
5. **§5 Rules** — A thin driver over `packages/salvageunion-reference/lib/rules`; `apps/web/src/lib/rules/playActions.ts` is glue, not math. Destructive results are the player's act (ADR-007).
   - **§5.1 Reactor** — Push, Heat Check, Vent (Heat 0, Vulnerable) and Shutdown are separate controls; a Meltdown waits for the player.
   - **§5.2 Action activation** — Activate → Roll → optional Push → Apply, economy derived per action; `useActionsDeck` drives the resolve `PlayResolveSteps` draws.
   - **§5.3 Damage → Critical** — Declared damage applies clamped; reaching 0 offers the Critical roll, whose SP/HP override alone auto-applies.
6. **§6–§10** — Retired with the surface: components, launch, tests and open questions are play.md's.
