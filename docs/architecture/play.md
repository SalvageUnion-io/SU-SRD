# Play

The Play mode (ADR-051): one screen to run a pilot, solo or in a Game, and the Mediator's version of it. Not built yet; the work is the `dashboard-cockpit` milestone (tracker #1633). Wireframes: [`docs/wireframes/dashboard-cockpit/`](../wireframes/dashboard-cockpit/).

1. **§1 Routes** — `/build/play` (landing), `/build/play/$pilotId` (a player), `/build/play/game/$gameId` (the Mediator). The old `/dashboard` and `/mediator` routes redirect here once Play covers them.
2. **§2 Frame** — `DashboardCanvas` (1280×800, scaled, letterboxed, no page scroll): Play bar, then Units | Actions | Crew, Tables and Feed, then a foot (saved, connection).
3. **§3 Situation** — On foot and Boarded are the seat's `mount`; Downtime is the Game's `downtime` row (Mediator-owned) or the solo seat's own step.
4. **§4 Units** — Live units get − / + through `entityStore.update`; reference units are dashed and read-only. Pilot always live, mech while Boarded, crawler in solo Downtime or for the Mediator.
5. **§5 Actions** — One list from `useActionsDeck`, sorted by action type; On hand, then Not on hand with the reason. Resolve inline on `resolving`; reactor and mount controls are rows.
6. **§6 Downtime** — The ten guide steps as a track; the current step lists the patches from `cantina-domain/rules/downtime`, each skippable (ADR-007).
7. **§7 Crew** — Other seats with presence (`lastSeenAt` on the seat), mount and the vital `crewLines()` flags; sheets open read-only.
8. **§8 Tables and Feed** — Context tables pinned, the rest by search; the Feed is `useGameFeed` with proposals accepted inline.
9. **§9 Discord** — `/su bind` stores a `channelBindings` row (Game or solo); rolls post as the bot's table card; one toggle per screen, the Mediator private by default.
10. **§10 Mediator** — Seats left, Opposition and its actions centre (the step track in Downtime), Tables, Feed and Propose right, Scene / Downtime in the bar.
11. **§11 Phone** — Below the scale floor: tabs Act, Units, Tables, Crew (Mediator: Table, Opposition, Tables, Propose) under pinned vitals.
