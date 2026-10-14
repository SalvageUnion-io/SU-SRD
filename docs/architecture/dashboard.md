# Dashboard

One pilot's live-play surface in a Game (`apps/itun/src/components/dashboard/`). Decisions: ADR-038, ADR-045 ([ARCHITECTURE.md](../ARCHITECTURE.md)); code cites the § labels.

1. **§1 Purpose** — Guided Play over the same entities, store and rules as the live sheet; never a second editor.
   Opens only for a pilot in a Game with a Mediator; the Mediator's is [mediator-dashboard.md](mediator-dashboard.md).
2. **§2 Layout** — Fixed 1280×800 `DashboardCanvas`, scaled and letterboxed, never scrolls: rail (`SavedIndicator`), slot row (one Major, two Minors, placed by mount),
   display (`DeckList` beside the tabs) and `DashboardStrip` (latest alert, proposal count). Hue means ontology; state is a treatment, never a second hue.
3. **§3 Reuse** — Entities are `ReferenceEntityCard`, tables `RollTableInstrument` (`DashboardRollTable`); never fork.
4. **§4 State** — Vitals, uses and cargo persist on the records through `entityStore.update`; mount, range, `activeEffects`, resolving and ejected live on the seat (`apps/itun/convex/seats.ts`).
   Rolls are Game rows in the change log, Downtime is the Game's `downtime` row, and maxima and crew status are derived, never stored.
5. **§5 Rules** — A thin driver over `packages/salvageunion-reference/lib/rules`; `apps/itun/src/lib/rules/playActions.ts` is glue, never math. Destructive results are the player's act (ADR-007).
   - **§5.1 Reactor** — Push, Heat Check, Vent (Heat 0, Vulnerable) and Shutdown are separate controls; a Meltdown waits for the player.
   - **§5.2 Action activation** — Activate → Roll → optional Push → Apply, economy derived per action; `useActionsDeck` feeds `DeckList` and `ResolvePanel`.
   - **§5.3 Damage → Critical** — Declared damage applies clamped; reaching 0 offers the Critical roll, whose SP/HP override alone auto-applies.
6. **§6 Components** — Store-wired containers build view models their presentational halves render; the Game arrives through `useSeat`, `useBoardSources`, `useGameFeed` and `useDowntime`.
   New styling is style objects over tokens, plus ITUN `.su-dash-*` rules only where a state needs one (ADR-046).
7. **§7 Phone form** — Below 0.62 scale on either axis, `DashboardPhone` draws the same seat, view models and handlers as one scrolling column with unit tabs.
   Resolving is its own screen; Disconnected and Outdated open read-only.
8. **§8 Launch** — Only from Launch Dashboard on the Game hub; `DashboardGate` shows a shell for anonymous, shelf, non-member and Mediator-less cases.
9. **§9 Tests** — Test the wiring, not the rules math: destructive outcomes confirm, mount state never reaches `entityStore`, the scale threshold holds.
10. **§10 Open** — Targeting is a range band only; sheet and Dashboard can race on one record; players cannot request a crawler change.
    - **§10.3 Zoom** — Below the scale floor × zoom the phone form takes over (ADR-045).
    - **§10.4 Gauges** — One `DashboardGauge` over `VitalGauge`; `numeral` and `track` are its variants.
