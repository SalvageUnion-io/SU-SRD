# Dashboard redesign: the Flight Deck

> **Status:** Plan, dated 2026-10-06. Nothing here is built. The product
> decisions in §2 and the answers in §8 were made by the product owner. The
> decision is recorded in
> [ADR-038](../adrs/ADR-038-dashboard-game-surface-shared-play-state.md). The
> work is tracked in the [Dashboard Redesign milestone](https://github.com/SalvageUnion-io/SU-SRD/milestone/7), with one issue
> per layer in §5.
>
> Wireframes (round 2, the chosen layout):
> <https://claude.ai/artifact/A2UW8etgN4fzRexbsjacJt>. Round 1 compared three
> concepts: <https://claude.ai/artifact/J8KCRx3byHFSqodscw4Rzg>.
>
> Read alongside [dashboard.md](dashboard.md) (what is built today),
> [ADR-015](../adrs/ADR-015-dashboard-distinct-play-surface.md) (the decisions
> this plan amends), [ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md)
> (Games, roles, "propose, never impose"),
> [ADR-037](../adrs/ADR-037-assignment-model.md) (the links the Board menu
> reads), [ADR-007](../adrs/ADR-007-automation-boundary.md) (unchanged by this
> plan) and [tailwind-removal.md](../design-system/tailwind-removal.md) §P5
> (this plan absorbs it for the Dashboard).

---

## 1. What changes

The Dashboard stays ITUN's Guided Play surface (ADR-015, ADR-021). It still
reads and writes the same pilot, mech and crawler records through the same
store and rules. Four things change:

1. **Layout.** The rotary Dial and the single Active Item band are replaced by
   a fixed top row with one **Major** slot and two **Minor** slots. The display
   becomes a tabbed panel. The 1280×800 scaled canvas (ADR-015 decision 5)
   stays.
2. **Play state is shared and saved on the Game.** Whether a pilot is boarded
   and in which mech, their range band, their activated effects and the action
   they are resolving move from the per-device `playStateStore` into a Convex
   **seat**, one per pilot in a Game. Rolls go to the Game log.
3. **Game-only, with a Mediator.** The Dashboard is a curated, live game
   experience. It needs a signed-in session, a pilot in a Game, and a Game with
   a Mediator. There is no Dashboard on the shelf, in anonymous play, or in a
   Game with no Mediator. Players there edit their live sheets by hand.
4. **Crew and Downtime come in.** A Crew tab shows every crewmate's state. The
   Downtime guide reads the Game's existing `downtime` row instead of keeping
   its own per-device step.

## 2. Decisions

| # | Decision |
| --- | --- |
| D1 | **Major and Minor slots.** On foot: Pilot is Major, Mech and Crawler are Minor. Boarded: Mech is Major, Pilot and Crawler are Minor. During Downtime: Crawler is Major, Pilot and Mech are Minor. Nothing else moves the slots. |
| D2 | **A Major shows the full controls.** The Mech Major has Reactor and Chassis at full width, with Effects and Egress (Dismount, Eject) in one narrow side column. The Pilot Major has Vitals, Kit, Abilities and Mount. The Crawler Major has Hull, Stores, Bays and a narrow side column for Upkeep, Upgrade and Scrap a mech. |
| D3 | **A Minor shows only what needs watching** (Pilot: HP, AP. Mech: SP, with Heat and EP as text. Crawler: SP, Tech Level, scrap). It surfaces more only on a problem (an injury, a damaged system or bay). ⤢ opens that entity's Major controls as an overlay without changing the slots. |
| D4 | **Board is a split button** in the Pilot's Mount bay. The main half boards the pilot's assigned mech (`mech-to-pilot`). The ▾ half lists every mech assigned to the pilot's crawler (`mech-to-crawler`), the pilot's own first. Mechs the player cannot write, destroyed mechs and mechs another seat is boarded in are listed but disabled, each with the reason. |
| D5 | **Display tabs:** Resolve, Reference, Tables, SRD as primary tabs, with Log and Crew as secondary tabs. Which tab is open is per device. |
| D6 | **Crew tab:** one read-only row per crewmate. It shows pilot HP and AP, plus mech SP and Heat when their seat says they are boarded, and a parked mech as one line of text. ▲ on the tab and a red outline on the row when someone is ejected, injured, overheating or destroyed. Crew status leaves the bottom strip, which keeps only Mediator alerts and the proposal inbox. |
| D7 | **Dashboard state is shared and saved on the Game** (the seat, §3). Only screen arrangement stays on the device: the open tab, deck filters, open overlays and menus. |
| D8 | **Downtime is Game state.** The Mediator starts, advances and ends it (`downtime.begin`, `advance`, `end`). When it runs, every player's Crawler moves to Major. When it ends, each player returns to whatever their seat says. |
| D9 | **Game-only, with a Mediator.** The Dashboard opens only for a pilot in a Game that has a Mediator. A solo player can make themselves the Mediator of their own Game. Without a Mediator, Downtime and play are handled by editing the live sheet. |
| D10 | **The Dashboard is for pilots.** A Mediator who plays a pilot uses it like any player. A separate Mediator Dashboard is a second plan (§9). |
| D11 | **A Game's crawler is the Mediator's.** Only the Mediator changes a crawler in a Game: Salvage, Craft, Trade, Upkeep, Upgrade, damage and Scrap a mech. Players see the Crawler Major and Minor read-only and ask at the table. The server enforces it, so the crawler sheet is read-only for players in a Game too. |
| D12 | **Boarding never assigns.** Boarding any mech, a claimed spare included, changes only the seat. The pilot's assigned mech (`mech-to-pilot`) stays as it was. |

What does not change: ADR-007's automation boundary (Eject and every
destruction stay the player's explicit act), ADR-006's pure rules math, the
rule that a player never writes another player's state, and the rule that mount
never becomes a field on a pilot or mech record.

## 3. Data model: the seat

One Convex row per **pilot** in a Game. Keying on the pilot, not the member,
lets a member who covers for an absent player (ADR-030 §4) run two seats.

```ts
// apps/itun/convex/schema.ts (sketch, not final)
seats: defineTable({
  gameId: v.id('games'),
  pilotId: v.string(),              // app id, like softLinks ends
  mount: v.union(
    v.object({ kind: v.literal('foot') }),
    v.object({ kind: v.literal('boarded'), mechId: v.string() }),
  ),
  range: v.union(/* 'Close' | 'Medium' | 'Long' | 'Far' */),
  activeEffects: v.array(v.string()), // refs that are switched on
  updatedAt: v.number(),
  // added in layer 6, as v.optional(...): every existing row still validates
  // resolving: { action ref, step, roll }
})
  // gameId alone is a prefix: the crew's seats in one read
  .index('by_game_pilot', ['gameId', 'pilotId'])
```

Layer 1 built this (#1051). `resolving` is left to layer 6, whose display
tabs define its shape, rather than guessed now.

- **Source of truth** is a Zod schema in `apps/itun/src/lib/schemas/seat.ts`.
  `RangeBand` moves there from `dashboardRules.ts`. A parity test in the
  style of `test/convex/downtimeSteps.test.ts` keeps the Convex unions in step,
  since nothing checks that automatically.
- **Who writes:** only someone who may write the pilot. Each seat mutation
  loads the pilot by app id in that Game and calls `assertMayWrite`
  (`convex/entities.ts`). Boarding also requires write access to the mech,
  because playing a mech writes its Heat, EP and SP. The Mediator does not write
  seats; they ask through a proposal (ADR-030 §4).
- **Who reads:** every member (`requireMember`), through one query per Game.
  Seats hold nothing a crewmate isn't entitled to see.
- **Not stored:** "in Downtime". That's derived from the Game's `downtime`
  row, which already exists. `priorMount` goes away because leaving Downtime
  reads the seat.
- **Rows are created lazily** on first write, like `downtime.ensureState`. The
  query returns a default seat (on foot, Close, no effects) for a pilot with
  none.
- **Cleanup.** Seats must be deleted in the paths that would otherwise orphan
  them:
  - `games.destroy` and `account.deleteAccount` (neither sweeps the `downtime`
    row today, so check that at the same time).
  - Deleting a pilot, or moving it out of the Game.
  - Deleting a mech or moving it out drops any seat boarded in it back to
    on foot.
- **Rolls** go to the existing `changeLog` as Game rows: `entityType 'game'`,
  `field 'roll'`, `source 'dashboard'`, matching what `botClient.recordRoll`
  already writes for Discord. The client sends them through `commitChangeLog`,
  and `appendChangeLog` already accepts that shape from a member. A new
  `rolls` query reads `by_game_field` with `field 'roll'`, newest first,
  capped like `proposals.alerts`. Nothing reads roll rows today.
- **`games.cockpitPrefs`** (unused, `v.any()`) and `cockpitPrefsStore` lose
  their only reason to exist when the Dial goes. The store is deleted.
  Dropping the Convex column is a separate one-way step and is not in this
  plan.

## 4. Surfaces

### 4.1 Route and entry

- The route keys on the pilot: `/dashboard/$pilotId` (today it keys on a mech
  id). The Game comes from the pilot's container (`containerOf`). Old
  mech-keyed URLs resolve through `mech-to-pilot` and redirect.
- A refusal renders a shell that says what is needed. The cases are:
  - an anonymous session;
  - a pilot that isn't in a Game ("Move Rook into a Game to play");
  - a Game with no Mediator ("This Game has no Mediator. Ask the Organizer to
    name one, or edit your live sheet."), checked with `gameHasMediator`
    (`convex/model/permissions.ts`).

  The guard can't live in `beforeLoad`, because loaders never read player
  entities (`.claude/rules/tanstack-router.md`). It is evaluated live, so an
  open Dashboard falls back to the shell if the Game loses its Mediator.
- Disconnected is not a refusal. The Dashboard stays open read-only, as
  `writesAllowed()` already does for the sheets.
- **Entry point:** a Play button on your own pilot rows in the Game roster
  (`GameRoster.tsx` already has a mech-row Dashboard button to replace). The
  button appears only when the Game has a Mediator. The `DashboardChooser`
  wizard and its mounts in `Roster.tsx`, `SheetPilot.tsx` and `SheetMech.tsx`
  are retired. Shelf sheets show a "Play in a Game" hint instead.
- `dashboardLaunch.ts` (stand-in mech from a pattern, base crawler of a Tech
  Level) and `dashboardLinks.ts` are deleted with the chooser. Stand-ins are
  dropped (§8 A5): in a Game a mech is a real crew asset, built on the sheet
  like any other.

### 4.2 Components: old to new

| Today | Becomes |
| --- | --- |
| `Dial`, `DialConfig`, `dialItems`, `cockpitPrefsStore` | Deleted |
| `ActiveItemBand` + `ActiveItemBandFrame` | `SlotRow` (one Major, two Minors), `MajorFrame` (bays, reusing the band renderer), `MinorFrame` |
| `MechBand`, `PilotBand`, `CrawlerBand` | Each keeps its view model and gains a Major form and a Minor form: `MechSlot`, `PilotSlot`, `CrawlerSlot` |
| Board button in `PilotBand` | `BoardControl` (split button and mech menu, D4) |
| `DisplayPanel` (follows Dial focus) | `DisplayTabs`: Resolve, Reference, Tables, SRD, then Log and Crew |
| `ActionsDeck` (deck and resolve in the display) | The deck list beside the display, with the resolve panel in the Resolve tab. `ActionsDeckFrame` splits into `DeckList` and `ResolvePanel`. |
| `TablesView` roll history (component state) | `LogTab` reading the `rolls` query, plus Mediator alerts |
| none | `CrewTab` (seats with `crew.vitals`) |
| `DowntimeWizard` (`dtStep`, `dtDone` per device) | Reads `downtime.state`. Adds a step track with ready pips from `completedBy` and "I'm done" through `markStepDone`; the Mediator gets Next step. |
| `RailBar` | Title, a saved/offline indicator from `useConnection()`, Sheets menu, Exit to the Game |
| none | Bottom strip: `proposals.alerts` and the `ProposalInbox` count |
| `playStateStore` | Deleted. `damagePromptArmed` becomes component state. |

### 4.3 Styling

New components are written to `tailwind-removal.md` §4: style objects plus
`.su-*` stylesheet classes. They add no `.pc-*` class, because `bun run check
styling` fails a change that does. Each replaced file leaves the Tailwind list
as it is deleted. When the last `.pc-*` rule goes, `styles/dashboard.css` and
its package export go with it. That meets §P5's exit for the Dashboard, so P5
is done by this plan, not run separately.

## 5. Layers

One PR per layer, submitted as a `gh stack`. Each layer passes `bun run check`
and `bun run test`, and each UI layer is checked in the `itun` preview against
the dev Convex deployment. Being Game-only, that needs a signed-in session and
a Game with at least two members, so the Crew tab and Board menu have something
to show.

| # | Layer | Contents | Gate |
| --- | --- | --- | --- |
| 0 (#1050, done) | Decision | ADR-038 (§6). Status notes on ADR-015, ADR-019, ADR-029, ADR-030, ADR-034. This plan registered in `docs/README.md`. Docs only. | `doc-drift` passes; root `CLAUDE.md` stays within its size budget (§6) |
| 1 (#1051) | Seat table | The `seats` table and indexes, `src/lib/schemas/seat.ts`, the union parity test. No functions. This is the one-way step, so it lands alone. | `convex-codegen` check; parity test |
| 2 (#1052) | Game-only entry | Route re-keyed to the pilot, the refusal shells, the redirect from mech URLs, Play on the Game roster (only with a Mediator), chooser and `dashboardLaunch.ts` retired. Still on `playStateStore`. | Route tests for each refusal (anonymous, shelf pilot, non-member, no Mediator, Mediator removed while open); `GameRoster` test |
| 3 (#1053) | Seats live | `convex/seats.ts` (query, then board, dismount, eject, setRange, toggleEffect, setResolving), with cleanup in every path in §3. `useSeat` hook with optimistic updates. Mount, range and effects read from the seat. Module added to `test/convex/harness.ts`. | Convex tests: non-owner, non-member and other-player's-mech refused; cleanup on delete and move; two seats per member. `convex-callers` passes because the hook calls every function. |
| 4 (#1054) | Slot row | `SlotRow`, Major and Minor forms of all three entities, ⤢ overlay. Dial and its config, prefs store and stories deleted. Ladle stories for each slot in each state. | Existing band rules tests ported; a test that slots follow mount and Downtime |
| 5 (#1055) | Board control | `BoardControl` and its menu: own, unclaimed spare ("Claim and board", with a confirm), other player's, destroyed, boarded elsewhere, no assigned mech, no crawler. | One test per disabled reason; claim-and-board writes the claim before the seat |
| 6 (#1056) | Display tabs and Log | `DisplayTabs`, deck and resolve split, rolls written to the Game log and read by `LogTab`, resolve progress on the seat, shown live to the crew ("Rook is resolving Crush", then the roll) | Rolls round-trip test; reload mid-resolve keeps the roll; a second client sees the resolve live |
| 7 (#1057) | Crew tab | An experiment first: `salvageunion-reference/rules` loading in Convex. Then the crew query derives maxima and status on the server (§8 A3), and `CrewTab` reads it with the seats. The ▲ and red outlines come from the derived status (D6). The two "should not grow" comments are updated. | The server's derived maxima and status equal the client's for shared fixtures; no Mediator-only data in the payload |
| 8 (#1058) | Downtime | `DowntimeWizard` on `downtime.state`, the step track, Crawler Major during Downtime, Mediator controls on the Dashboard. The crawler becomes Mediator-only on the server (D11): `assertMayEditCrawler` in a Game and `downtime.spendUpkeep` require the Mediator, and the crawler sheet goes read-only for players in a Game. `playStateStore` deleted. | Two-client test: the Mediator advances and both clients follow; a player's crawler write is refused and the Mediator's succeeds |
| 9 (#1059) | Docs | Rewrite `dashboard.md` (keep section numbers, since code comments cite them) and the statements listed in §7. Delete this plan, or mark it done. | `doc-drift` |

Issue numbers are on SalvageUnion-io/SU-SRD. Layers 4–8 touch disjoint components after layer 3, but they share
`Dashboard.tsx`. Keep them in order rather than in parallel.

## 6. The ADR (layer 0)

[ADR-038](../adrs/ADR-038-dashboard-game-surface-shared-play-state.md), "The
Dashboard Is a Game Surface with Shared Play State", written in layer 0. It:

- **Records the gate** (D9): the Dashboard needs a pilot in a Game that has a
  Mediator. Solo, shelf and anonymous play have no Dashboard and use the live
  sheet.

- **Amends ADR-015.** Decision 1 (the rotary Dial) is replaced by the slot row
  and display tabs. Decision 4 (play state ephemeral, dial config as a device
  preference) is reversed for play state. Its other half, that mount never
  reaches a pilot or mech record, is kept. Decision 5 (the canvas) stands.
- **Updates ADR-019**, the stub merged into ADR-015, with a pointer.
- **Amends ADR-030** §5's line "crew vitals arrive there as a 'Crew' dial item":
  they arrive as the Crew tab.
- **Amends ADR-029**: duration-bound effects resolve against the seat, not
  ephemeral play state.
- **Amends ADR-034**'s "What is not data" list, which names ephemeral mount
  state.
- **Records ADR-021's long-tail "shared, live Dashboard"** as delivered in part.
  This is per-player seats that the crew can see, not several players on one
  screen.

Housekeeping: the ADR count in `docs/README.md` ("37 ADRs") and root
`CLAUDE.md` ("37 of them", plus its supersession list). Root `CLAUDE.md` is at
its exact `doc-drift` size budget, so any words added there must be cut from
the same file in the same change.

## 7. Statements this plan makes false

Layer 9 fixes these. Each layer fixes the ones it makes false sooner, if it
can.

- `docs/architecture/dashboard.md`: §2 layout (Dial, Active Item band,
  display following Dial focus), §4.1 table (playStateStore, cockpitPrefsStore,
  "resets on reload"), §4.2 "adds no server surface of its own", §6 component
  list, §8 launch flow, §9 testing, §10 the Dial's `listbox` accessibility.
- `apps/itun/src/stores/playStateStore.ts` header (deleted with the file).
- `apps/itun/CLAUDE.md`: the `playStateStore` mention in the store list. That
  file is one character under its size budget, so offset any addition.
- `docs/ARCHITECTURE.md` § Combat loop and § Rules and ITUN surfaces:
  component names (`ActionsDeck`, `MechBand`, `PilotBand`) and "composes a
  player's" wording, if they change.
- `docs/ARCHITECTURE.md` § Data flow and § Combat loop, and `apps/itun/CLAUDE.md`'s
  Solo rows: Solo play no longer includes the Dashboard.
- `docs/design-system/ruleset.md` Dashboard laws, and
  `.claude/rules/react-components.md` (the `dashboard/` folder and `pc-*`
  contract).
- `apps/itun/src/routes/dashboard/$id.tsx` cites
  `docs/architecture/play-cockpit.md`, which does not exist.
- `DashboardChooser.tsx`'s header is already stale (it says stand-ins and
  `mech-to-crawler` aren't written). It goes with the file.

## 8. Answers

Asked and answered on 2026-10-06.

A1. **Solo play.** The Dashboard isn't for solo play. It opens only in a Game
with a Mediator; a solo player can be the Mediator of their own Game. Without
a Mediator, players run Downtime by editing their live sheets.
`downtime.begin/advance/end` stay Mediator-only (D9).

A2. **The Mediator's Dashboard.** The Mediator gets a Dashboard of their own,
planned separately once seats exist (§9). This plan's Dashboard is for pilots
(D10).

A3. **Crew status is derived on the server.** The crew query imports
`salvageunion-reference/rules` and derives every crewmate's maxima (HP, AP, SP,
EP, Heat cap) and status (dead or injured, shut down, overheating, destroyed
systems and modules, ejected) from their stored records. Nothing extra is
stored. That lifts a convention, recorded only in comments in
`convex/downtime.ts` and `convex/botClient.ts`, that Convex should not have the
rules package. ADR-006 itself doesn't say so. Layer 7 starts with an experiment
proving the package's lazy data loading works in Convex; if it doesn't, the
needed data files are imported directly. The Discord bot moves onto the same
values in a follow-up (#1068).

A4. **Spare mechs.** The Board menu offers "Claim and board" for an unclaimed
spare, with a confirm step (layer 5). Claiming may need rethinking: it reads
less like ownership and more like "associated with". That is a separate
decision (§9).

A5. **Stand-in mechs.** Dropped along with the chooser and
`dashboardLaunch.ts`.

A6. **What crewmates see of a resolve.** Live, as it happens. The resolve is on
the seat, and the crew sees it step by step (layer 6).

A7. **Phone layout.** A follow-up after layer 9. Until then, phones keep
today's rotate-to-landscape notice (§9).

A8. **The shared crawler.** Only the Mediator changes a Game's crawler (D11).
Players see it read-only. Today any member may edit it, so this is a server
rule change, in layer 8.

A9. **Boarding a spare.** It doesn't assign the mech. Boarding only changes the
seat (D12).

## 9. Follow-ups outside this plan

- **Mediator Dashboard** (#1062). Its own wireframes and plan, built on the seats and
  Game log this plan adds.
- **Phone layout** (#1063). Two Minors stacked above the Major, as in the round 2
  wireframes.
- **Claiming as association** (#1064). Revisit what `ownership.claim` means for crew
  assets in a Game. This would be an ADR-030 amendment, not part of this plan.
- **`games.cockpitPrefs`** (#1065). Drop the unused column. That's a one-way schema
  step of its own.
- **The bot reads server-derived crew status** (#1068), retiring its own copy
  of the derivation.
- **Player requests to the Mediator.** Proposals only go from the Mediator to a
  player today. With the crawler Mediator-only (D11), players have no in-app way
  to ask for a crawler change. They ask at the table.
