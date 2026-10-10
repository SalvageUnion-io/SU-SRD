# Mediator Dashboard and running a Game: plan

> **Status:** Plan; **P8a built** (#1278). #1062's plan doc, for #1278
> (boards M1 and M2, canvas v69). Every decision below is **(decided by design
> lead — owner to confirm)**. §3 says what is left for P8b and what waits on the
> owner.
>
> Read with [ADR-030](../ARCHITECTURE.md#adr-030) §3–§6 (roles, propose-never-impose,
> visibility, surfaces), [ADR-038](../ARCHITECTURE.md#adr-038) (the player
> Dashboard: seats, Downtime, the 1280×800 canvas) and
> [ADR-021](../ARCHITECTURE.md#adr-021) (the Adjudicate mode).

**Builds on:** #1252, #1253, and #1255 (the Game page at `/games/$gameId`,
and invite links instead of codes). M2 is a set of sections on that page, not
a rebuild of the hub.

**Where it is:** M1 is `apps/itun/src/components/mediator/` (the route is
`src/routes/mediator/$gameId.tsx`, gated by `MediatorGate`); M2 is the Game
page's sections in `src/components/games/` (`GameHub` composes them).

## 1. What already existed (reused, not rebuilt)

Most of the server for M1 and M2 was built before P8. P8 is mostly layout,
plus three small server additions (§4). The table below is what each board
element reuses; the client column names what P8a replaced.

| Board element | Server today | Client today |
| --- | --- | --- |
| The table (seats) | `crew.vitals`, `seats.forGame` | `crewLines()` in `dashboard/useGameFeed.ts`, rendered by `CrewTab` |
| Propose / Pending / Applied / Declined / Superseded | `proposals.propose`, `apply`, `decline` | `MediatorTools.tsx` `ProposeForm`; player side `ProposalInbox` |
| Tell the table | `proposals.broadcast`, `alerts` | `MediatorTools.tsx` `AlertBar`; players read it in `LogTab` |
| Opposition | `mediator.npcs`, `addNpc`, `removeNpc` | `MediatorTools.tsx` `NpcTray` (name only) |
| Downtime | `downtime.state`, `begin`, `advance`, `end`, `spendUpkeep` | `games/DowntimePanel.tsx` |
| Invite links, Asking to join | `invites.create`, `list`, `revoke`, `pendingRequests`, `decideRequest` | `games/InvitePanel.tsx` |
| Hand over | `games.setMediator` | `games/MediatorPanel.tsx` |
| Rail save state, Log, SRD | — | `SavedIndicator`, `LogTab`, `SrdExplorer`, `DashboardCanvas` |

P8a retired `MediatorTools.tsx`, `CrewVitals.tsx`, `MediatorPanel.tsx` and
`DowntimePanel.tsx`: their jobs moved to M1 and to M2's sections
(`DowntimeTrack`, `InvitePanel`, `JoinRequests`, `TheGame`).

## 2. Decisions

**Q1. Does this need a new ADR?** No. ADR-038 §1 deferred "a Mediator
Dashboard" as a later decision, and this plan takes it. Every authority the
surface uses is already granted: the Mediator owns NPCs and Downtime (ADR-030
§3), runs the crawler (ADR-038 §5), and reaches a player's sheet only by
proposal (ADR-030 §4). The surface adds no new rule about who may write what.
Record the plan with two status lines (§5).

**Q2. Where does it live?** `/mediator/$gameId`, which today only redirects to
`/`. The address was kept for exactly this surface, so it gets its meaning back.
Back (‹) on the rail goes to `/games/$gameId`. The player Dashboard
(`/dashboard/$pilotId`) is not touched, and nor is its locked canvas (ADR-038 §9).

**Q3. Who may open it, in each storage mode?**
- **Connected, Mediator** (`mediator.amMediator`): the full surface.
- **Connected, not the Mediator:** one line, "Only this Game's Mediator runs
  this screen", and a link to the Game page. No disabled controls.
- **Disconnected / Outdated:** what the subscription last delivered stays on
  screen under the offline `Banner`. Every control is **disabled, not hidden**,
  so the layout does not jump when the connection returns. Opened cold while
  offline, it shows `ConvexPending`. Writes are blocked, never queued (ADR-030 §1).
- **Solo (signed out):** the signed-out answer `DashboardGate` already gives.
  Solo has no Games, so it has no Mediator Dashboard.

**Q4. The canvas and phones.** M1 is a 1280×800 `DashboardCanvas`. Players
mostly use phones at the table, but a Mediator who runs a Game from a phone
before P8 (the hub's former `MediatorSection`) must not lose that. So `DashboardCanvas`
gets two optional props, used only here: `minScale` (0.8 for this surface) and
a `reflow` node that replaces the rotate notice. Below 0.8 the same panel
components stack in one scrolling column, in this order: rail, The table (two
seat cards per row), Downtime, Crawler, then the tabs. A 1024px-wide tablet in
landscape still gets the canvas. The player Dashboard keeps its 0.62 floor and
its notice (#1256 owns the player's phone layout).

**Q5. The table: which seats, in what order, flagged how?**
- One card for each **claimed** pilot in the Game, the Mediator's own included.
  Unclaimed pre-gens are open seats and appear only on M2.
- The order is **stable**: membership `joinedAt`, then callsign. Cards never
  re-sort when someone takes damage, because a card that moves mid-fight is a
  card you lose.
- The content is `crewLines()` verbatim, so the Mediator and the players' Crew
  tab give one answer (ADR-038 §4). Each card shows the callsign; HP and AP;
  "On foot" or "In ‹mech› · SP x/y"; then "Fine", or ▲ and the first problem
  (with "+N" when there are more).
- The red frame is `--color-status-bad`, drawn as `CrewTab`'s inset ring. The
  ▲ and the problem word always come with it, so colour is never the only signal.
- **No new "near the cap" heat threshold.** The board's "Heat 7/8" is
  illustrative. Overheating stays `mechStatus`'s at-or-over-cap. A warning
  below the cap would have to change `crewStatus.ts` for every client, which
  is a separate issue.
- **Tapping a card selects that pilot as the proposal target** and focuses the
  propose dock (Q8). Seeing the problem and then proposing the fix is the
  commonest Mediator loop, so it takes one tap. The read-only sheet stays
  reachable from the card's name link.
- Seven or more seats: the row scrolls sideways (scroll-snap). This is the one
  panel-internal scroll on the canvas. Most tables have 2–6.
- Rail: a `Badge shape="stamp"` MEDIATOR, the Game's name, "N seats · M need
  attention" (in an `aria-live="polite"` region), and `SavedIndicator`.

**Q6. The crawler panel (minor).** It shows the Game's **primary** crawler
(`games.primaryCrawlerId`): its name, SP as a `Stat`, TL, and how many bays are
intact, on a crawler-tone band, under the line "Yours to edit: you run the
table." Its ⤢ opens the crawler's live sheet, which the Mediator may write
(`assertMayEditCrawler`). That is enough for P8a. With no crawler, an
`EmptyState` links to the Game page to raise one.

**Q7. Downtime: five steps or ten?** **Ten.** The board's five boxes (Begin,
Repairs & healing, Pay upkeep, Projects & trades, End) do not match the rules.
Crawler Downtime is ten named steps (Workshop Manual p.227–228, `guides.json`
"Crawler Downtime", from Tally Salvage to Prepare for the next Salvage Run).
The server already clamps `advance` to that guide. Begin and End are buttons,
not steps.
- **M1 minor:** when Downtime is not running, the board's copy and a **Begin
  Downtime** button. When it is running: "Step 2 of 10 · Upkeep & Upgrade",
  "3 of 5 done", **Next step**, and **End**. Pay upkeep appears only in the
  Upkeep & Upgrade step, which the server also enforces.
- **M2 track:** the ten steps as a 5 × 2 grid of step cells, which fits the
  board's cell size. The current step has an ink frame and the word NOW. The
  hint reads "You run it; players see it on their dashboards."
- **Upkeep due** reads `DOWNTIME_UPKEEP_SCRAP`: **5** Scrap of the crawler's
  TL, not the board's "3". "The crawler has N" is its TL-N scrap.
- **End before the last step asks first** (`ConfirmDialog`). Ending and then
  beginning again resets `upkeepSpent`, so a mis-tap could charge the crew's
  upkeep twice. Begin and Next need no confirm: they are non-destructive phase
  moves (ADR-007).
- Starting Downtime moving every player's Crawler to Major is already true
  (ADR-038 §5). Nothing new is built for it.

**Q8. Proposals: where, which fields, and the reason.**
- **Propose dock:** the right half of M1's display, visible under every tab.
  It holds Target, Field, To, Reason (optional, at most 140 characters), a
  live preview ("SP 6 → 4 · 'Rifle Squad volley'"), **Propose**, and the three
  newest proposals.
- **Proposals tab:** every proposal in the Game, newest first, 20 at a time
  (**Show 20 more** raises the read's `limit`).
- **Targets:** claimed pilots and mechs. A mech is labelled by its pilot
  ("Pickle's Spectrum").
- **Fields:** pilot → HP, AP. Mech → SP, Heat. These map to `currentHP`,
  `currentAP`, `currentSP` and `currentHeat`. The value is an integer from 0
  to the derived max, clamped on the client. `proposals.apply` still parses
  the result on the server.
- **The reason is new data:** an optional `reason` on the `changeLog` row (§4),
  shown to the player in `ProposalInbox` and on the Dashboard.
- **Rows** show the target, the field, "→ value", the reason, the time, and
  the state in words. The `proposed` state reads **Pending**. A **Superseded**
  row is struck through, because state is a treatment, never a hue (ruleset
  §3.3). A proposal stores no before (ADR-030 §4 as amended for #1130), so a
  sent row shows only the target value. The live "6 → 4" appears in the
  compose preview, before sending.
- **Whose proposals:** every Mediator proposal in the Game, not only the
  viewer's. A row names its sender only when that is not the viewer. After a
  Hand over, the new Mediator inherits what is still pending.

**Q9. Opposition: shape and controls.**
- Each tray NPC is a `ReferenceEntityCard` at `size="medium"`,
  `extent="head"`, resolved from its `refSchema` and `refSlug`. Beside it go a
  `CountStepper` (0 to `maxHp`, labelled "‹name› HP" or "SP" per `statKind`)
  and a **Morale** `Button`.
- Tapping the card opens the full reference card in the detail modal
  (`useDetailModal`). Listings never expand in place.
- **+ From the reference** opens `EntitySearcher` over `ENCOUNTER_REF_SCHEMAS`,
  one schema at a time, chosen with "Draw from" in the searcher's rail.
  A new instance starts at full HP and takes a numbered name ("Raider Band 2")
  when it duplicates one. The name-only add form goes; a row written by it
  still reads by its name.
- **Morale** rolls `rollDie(20)` on the reference "Morale" table (Workshop
  Manual p.268). The result is stored as the NPC's `lastMediatorRoll` and
  shown under the row ("Morale 7 · Fighting Retreat", then the table's text).
  **It is not written to the Game's log.** The log is crew-readable, and the
  tray is the one thing ADR-030 §5 hides. For this surface, this overrides
  ruleset §1's "every roll a row in the Game's log", which describes the
  player Dashboard.
- **At 0 HP or SP** an NPC is shown as down (struck through) and is never
  removed for you (ADR-007). Remove sits in the row's menu, behind a
  `ConfirmDialog`.
- The header reads "Hidden from players · N on the field". With no NPCs, an
  `EmptyState` says "No opposition yet."

**Q10. M2: who sees which section?** The issue draws M2 "as its Mediator", but
the drawn user is also the **Organizer**. Invites and membership are the
Organizer's (ADR-030 §3), and the server refuses them to anyone else
(`requireOrganizer`).
- **Mediator:** the crawler band with a **YOU MEDIATE** stamp and **Open the
  Mediator dashboard**, Downtime controls, and Proposals you sent.
- **Organizer:** Invite links, the New link form, Asking to join, and The
  Game's Hand over.
- **Every member:** Crew & seats, and the Downtime track (read-only).

The hub's `MediatorSection` left the Game page. Its jobs moved to M1.

**Q11. Crew & seats (M2).**
- The crawler is a `Card` at `size="medium"`, `extent="head"`, crawler tone,
  with TL, SP and Bays as mini `Stat`s.
- Then one row per member's pilot, in join order. Each row shows the role
  (MEDIATOR or PLAYER), the member, and the unit: "callsign · assigned mech",
  or "callsign · on foot". M2 shows what each player **has**; M1 shows where
  they **are**. A Mediator with no pilot reads "Runs the table", a player with
  none "No pilot yet".
- **Open seats** are unclaimed pilots: "OPEN · ‹callsign› · waiting for a
  player". "N of M seats" counts claimed pilots out of all pilots. The schema
  has no seat capacity, so none is invented.
- **There is no presence column (Here / Away).** Nothing writes presence
  today, because it was removed for having no writer (`convex/mediator.ts`
  header). A permanently false "Here" is worse than none.

**Q12. Invite links (M2).** These restyle `InvitePanel` to the board.
- Each link shows its seat as a stamp (PLAYER SEAT or MEDIATOR SEAT), "You
  approve each" when it needs approval, the expiry, the use count, the URL
  (#1255's format), **Copy link**, and **Revoke**.
- **New link:** Seat (Player / Mediator); Expires in 1 day, 7 days (the
  default, as drawn), 14 days or 30 days. Every invite expires, so there is no
  "never". "I approve each person who uses it" is a checkbox, **unchecked by
  default**: ADR-030's invite amendment keeps bearer the default, and the
  board's tick is illustrative.
- A closed link (revoked, declined, expired, used up) drops to one line
  under the open ones, so who used it, or that its addressee declined, is
  still there to read.
- **Asking to join:** name, "‹Seat› link · asked ‹time›", **Let in** and
  **Decline**. The board's "brings pilot …" needs the invite's grant names,
  which `pendingRequests` does not return, so it waits for P8b.

**Q13. The Game (M2).** P8a shows who mediates, with **Hand over**
(`setMediator`: appoint the chosen member, then stand down whoever mediated,
behind a `ConfirmDialog`), and who organises. With nobody mediating yet the
button reads **Appoint**, and a solo Organizer may appoint themselves. The existing **Delete this game** stays as
it is. **Archive is not built.** There is no archived state, and what it should
mean (read-only? hidden from lists? reversible?) is the owner's decision, so it
gets its own issue. Rename and the Discord channel line are P8b.

**Q14. Which tabs ship first?** P8a ships Opposition, Proposals, Tell the
table (`AlertBar` restyled, last five alerts), SRD (`SrdExplorer`, which takes
no props) and Log (`LogTab` over `changeLog.rolls` and `proposals.alerts`).
**Tables waits for P8b.** Mediator rolls on Reaction, Morale and Retreat are
decided as **private by default**, with a "Show the table" action that posts
the result as an alert. Wiring `DisplayPanel`'s tables focus to roll without
logging is P8b work.

## 3. Phases

| Phase | Ships | Gate |
| --- | --- | --- |
| **P8a (built, #1278)** | This doc. §4 server work. M1 at `/mediator/$gameId`: rail, The table, Crawler minor, Downtime minor, the Opposition / Proposals / Tell the table / SRD / Log tabs, the propose dock, and the stacked fallback. M2's Mediator and Organizer sections per Q10–Q13. `MediatorSection` removed from the Game page. | Two e2e specs: (1) the Mediator proposes HP 6 → 4 with a reason, the player applies it from the Game page, and the Mediator's row reads Applied and the seat card's HP reads 4. (2) The Organizer makes an approval link, a second account opens it and asks, Let in seats them, and their Game page loads. Plus `bun run check` and `bun run test`. |
| **P8b** | The Tables tab (private rolls plus Show the table). `games.rename`. The Discord channel line (needs a member-readable binding query). Grant names on Asking to join. The crawler's ⤢ as a canvas overlay with its Guided controls instead of the sheet. | Unit tests for each new query and mutation; e2e for Rename. |
| **Own issues (owner decides)** | Archive. Presence (needs a writer and a definition of "here"). A below-the-cap heat warning for every client. | — |

The two e2e specs need two signed-in browser contexts. If `e2e/fixtures.ts`
signs in only one test identity, add a second. Like every durability spec,
they skip without test auth and run for real in the nightly `e2e-itun` job.

## 4. Server additions (P8a)

1. **`changeLog.reason`:** `v.optional(v.string())`. `proposals.propose` takes
   an optional `reason`, trims it, refuses more than 140 characters with a
   `ConvexError`, and stores it. `pending` returns it.
2. **`proposals.sent`:** Mediator-only (`requireMediator`). It returns the
   Game's `source: 'mediator-proposal'` rows in every state, newest first,
   `limit` at a time (20 unless asked, never more than 100). Each row carries
   the target's name and type, `field`, `after`, `reason`, `state`, `ts`,
   `mine` and, for someone else's, `actorName`. It reads the index
   `by_game_source_ts` (`['gameId', 'source', 'ts']`) rather than filtering
   `by_game_state` in JS: this is a reactive query on a log that grows all
   campaign. `pending` also returns each row's `reason` and `targetName`.
3. **`mediator.updateNpc`:** Mediator-only through `requireNpcWriter`. It
   patches `currentHp` (clamped to 0 and the instance's `maxHp`),
   `conditions`, `name` and `lastMediatorRoll`, and runs
   `parseBody('encounterNpcs', …)` before writing. It is built with
   `mutation` from `convex/model/entities.ts`.

Each has a caller in `src/` (`tools/check-convex-callers.ts`), and the three
are tested in `apps/itun/test/convex/mediatorDashboard.test.ts`.

## 5. Status lines in `docs/ARCHITECTURE.md`

- **ADR-038, Status:** "§1's deferred Mediator Dashboard is decided in
  [mediator-dashboard.md](architecture/mediator-dashboard.md) (#1062): a
  separate surface at `/mediator/$gameId` in ADR-021's Adjudicate mode. It
  reuses §9's canvas and §7's instruments and writes nothing a player owns."
- **ADR-030, Status:** "**Amended 2026-10 (#1278):** §4: a proposal may carry
  a reason, which the player sees with it. §6: `/mediator/:id` is the Mediator
  Dashboard again and no longer redirects."

## 6. M1 layout (1280 × 800 design units)

```
┌ ‹ [SU] [MEDIATOR] GAME NAME ─────────────── 5 seats · 2 need attention  Saved ┐
├ THE TABLE  every seat, live ─────────────────────┬ #430 TENACITY ⤢ ┬ DOWNTIME ─┤
│ ┌BONESAW┐┌PICKLE ┐┌JUDGE ┐┌DRIFTWD┐┌HOTDOG┐      │ SP 20/20        │ Step 2/10 │
│ │HP·AP  ││HP·AP  ││HP·AP ││HP·AP  ││HP·AP │      │ TL1 · 10 bays   │ 3 of 5    │
│ │On foot││In Spec││Foot  ││In Maz ││Foot  │      │ Yours to edit   │ [Next]    │
│ │Fine   ││▲Heat  ││▲Eject││Fine   ││Fine  │      │                 │ [End]     │
├─[Opposition][Proposals][Tell the table][SRD]──────────────────────────[Log]────┤
│ HIDDEN FROM PLAYERS · 3       [+ From the reference] │ PROPOSE · PLAYER DECIDES │
│ [SQUAD  RIFLE SQUAD  HP10] [− 7 +] [Morale]          │ Target | Field | To      │
│ [SQUAD  RAIDER BAND  HP 6] [− 6 +] [Morale]          │ Reason          [Propose]│
│ [NPC    VETERAN      HP 9] [− 9 +] [Morale]          │ 3 newest, with state     │
└──────────────────────────────────────────────────────┴──────────────────────────┘
```

Tokens: the ground is `--color-ink-deep`, the instruments `--color-band-cream`,
and the display `--color-paper` (ruleset §1, Dashboard). Seat cards have a
`--color-pilot` top band; the crawler card a `--color-crawler` band. A seat
with a problem gets a `--color-status-bad` ring. Every rust element is a
`Button`. Canvas controls are 48 design units tall, so they stay at 38px or
more at the 0.8 floor.

## 7. Accessibility

- The tabs are `Tabs` / `TabList` / `Tab` / `TabPanel` (Base UI): one tab
  stop, with arrow keys between tabs.
- Each seat card is a button whose label reads the whole line, for example:
  "Pickle, HP 10 of 10, AP 5 of 5, in Spectrum, SP 6 of 9, needs attention:
  overheating". The ▲ is `aria-hidden`.
- Polite live regions: the rail's attention count, a sent proposal changing
  state, and a Morale result. Nothing is assertive.
- `ConfirmDialog` (End Downtime early, Remove NPC, Hand over) puts focus on
  Cancel.
- Choosing a seat card moves focus to the dock's To field.
- Focus rings use `FOCUS_RING`. Check them with a real key press, not
  `el.focus()`.

## 8. Implementation guardrails

- No new `.pc-*` class and no Tailwind utility: `bun run check styling`
  ratchets both. Use style objects over `tokens`, and the existing `.pc-*`
  scope that `DashboardCanvas` brings.
- Reuse `crewLines()` and `SavedIndicator`. Do not fork the Crew tab's problem
  vocabulary.
- Every colour is an existing `theme.css` token. This plan proposes none.
