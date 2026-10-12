# Dashboard

One pilot's live-play surface in a Game (`apps/itun/src/components/dashboard/`). Decisions: ADR-038 and ADR-045 in [ARCHITECTURE.md](../ARCHITECTURE.md); code cites the § labels below.

1. **§1 Purpose** — Guided Play over the same entities, store and rules as the live sheet; never a second editor.
   Opens only for a pilot in a Game with a Mediator; the Mediator runs the table from [mediator-dashboard.md](mediator-dashboard.md).
2. **§2 Layout** — Fixed 1280×800 `DashboardCanvas`, scaled and letterboxed, never scrolls: rail (`SavedIndicator`), slot row (one Major, two Minors, placed by mount),
   display (`DeckList` beside the tabs) and `DashboardStrip` (latest alert, proposal count). Hue means ontology; state is a treatment, never a second hue.
3. **§3 Reuse** — The display draws SRD entities with `ReferenceEntityCard` and tables with `RollTable`; never fork it.
4. **§4 State** — Vitals, uses and cargo persist on the records through `entityStore.update`; mount, range, resolving and ejected live on the seat (`apps/itun/convex/seats.ts`).
   Rolls are Game rows in the change log, Downtime is the Game's `downtime` row, and maxima and crew status are derived, never stored.
5. **§5 Rules** — A thin driver over `packages/salvageunion-reference/lib/rules`; `apps/itun/src/lib/rules/playActions.ts` is glue, never math. Destructive results are the player's act (ADR-007).
   - **§5.2 Action activation** — Activate → Roll → optional Push → Apply, economy derived per action; `useActionsDeck` feeds `DeckList` and `ResolvePanel`.
6. **§6 Components** — Store-wired containers build view models their presentational halves render; the Game arrives through `useSeat`, `useBoardSources`, `useGameFeed` and `useDowntime`.
   New styling is style objects over tokens with no new `.pc-*` ([tailwind-removal.md](../design-system/tailwind-removal.md) §4).
7. **§7 Phone form** — Below 0.62 scale on either axis, `DashboardPhone` draws the same seat, view models and handlers as one scrolling column with unit tabs.
   Resolving is its own screen; Disconnected and Outdated open read-only.
8. **§8 Launch** — Only from Launch Dashboard on the Game hub; `DashboardGate` shows a shell for anonymous, shelf, non-member and Mediator-less cases.
9. **§9 Tests** — Test the wiring, not the rules math: destructive outcomes confirm, mount state never reaches `entityStore`, the scale threshold holds.
10. **§10 Open** — Targeting is a range band only; sheet and Dashboard can race on one record; players cannot request a crawler change in the app.
    - **§10.3 Zoom** — Closed by ADR-045: past the scale floor the phone form takes over and zooms like any page.
