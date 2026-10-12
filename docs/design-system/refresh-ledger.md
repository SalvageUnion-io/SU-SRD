# Design refresh — the phase ledger

What the `design-refresh` branch has shipped, under which tag, and what is left. Commit tags read `[design-refresh <phase>]` (the build phases) and `[refit <ID>]` (the audit fleet).
The Tailwind plan's own phases are TW0–TW7 ([tailwind-removal.md](tailwind-removal.md)); `P1`, `P2`… in a commit tag never mean those.
Status is as of 2026-10-12; update a row when its PR lands.

## Build phases

From `git log origin/design-refresh --format='%h %s'`. One PR per phase, squash-merged into `design-refresh`, unless the PR column says otherwise.

| Phase | What it shipped | PR | Status | Remaining |
| --- | --- | --- | --- | --- |
| P0 | Ratify the Workshop Manual canon in the ruleset | #1283 | closed unmerged | — (P1 added `ruleset.md`, which carries the canon) |
| P1 | Refresh tokens and the gates that hold them | #1284 | merged | — |
| P2a | One Union bar, ChapterBand and section Slab for both tools | #1285 | merged | — |
| P2b | One anatomy, two fills and legible nesting for the entity card | #1287 | merged | Superseded in part by the entity display language (below) |
| P3 | The SRD's surfaces as the Workshop Manual's pages | #1289 | merged | — |
| P4 | Invite links, the front door, print-read sheets, the Flight Deck | #1290 | merged | — |
| P5 | The Dashboard's phone form | #1295 | merged | — |
| P6 | User-made dashed rule and shareable mech patterns | #1288 | merged | — |
| P7 | NPCs and crew crawlers | #1293 (+ #1297, #1298, #1299) | merged | — |
| P8 | The Mediator Dashboard and running a Game from its page | #1296 | merged | — |
| P9 | Shelves, everything you keep | #1294 | merged | — |
| P10 | One OgCard for reference and player link previews | #1292 | merged | — |
| PR | Roll every named table with `@randsum/salvageunion` | #1312 | merged | — |
| PZ | Canvas-only story URLs; the origin as design source | #1331 | merged | — |
| PF | The footer ends each page in its chapter's band | #1332 | merged | — |
| PL | Listings as compact cards grouped as the book prints them; censor marks for missing art; roll tables fit one screen | none (8 direct commits, `6044219`…`58692ee`) | merged | — |

### Entity display language (EDL)

Its own six phases ([entity-display-language.md](entity-display-language.md)), landed as merge commits without PRs.

| Phase | What | Commit | Status |
| --- | --- | --- | --- |
| 1 | The entity model, `toEntityModel` | `18bb05f` | merged |
| 2 | Row and Token forms, link and select modes, E17 | `0223974` | merged |
| 3 | Mention and Peek | `c49a5ef` | merged |
| 4 | Card + Hold: densities, the Row ⇄ Card disclosure, Hold and Count modes | — | not started |
| 5 | Page + instruments: the Page as route and panel, the Table instrument, Steps | — | not started |
| 6 | Delete `ReferenceEntityCard` and its axes; the E15 lint | — | not started |

## The Refit fleet

An audit of the branch, the [SURef Refit Ledger](https://claude.ai/artifact/HCbph3uwU4uCH6v1pxkpAY), drives it: the owner ticks items, and each becomes one PR into `design-refresh` titled `… [refit <ID>]`.
Item ids are the ledger's: B (beauty), S (sites), A (agents), E (efficiency), D (delete), T (standardize), O (organization).
The full Tailwind cutover (ledger item D2) runs as items TW-a…TW-i; it is in progress.

| Item | PR | Status |
| --- | --- | --- |
| A1 Scope the per-edit typecheck hook | #1361 | merged |
| A8 `bun run shot`, a headless screenshot command | #1359 | merged |
| A10 Enable only the context7 and convex MCP servers | #1346 | merged |
| B1 Ability rows wear the ink banner again | #1356 | merged |
| B3 Class ability trees as the book's connected track | #1349 | merged |
| B5 The stat column's ink stamp sized to its label | #1350 | merged |
| B6 Long rules pages: hierarchy and an "On this page" rail | #1365 | merged |
| B8 ChapterBand layout prop, full-bleed by default | #1357 | merged |
| S4 First-timer content first on the SRD home | #1354 | merged |
| S6 The 404 as a search page | #1362, #1366 | merged |
| E2 srd and component-lib suites in parallel; giant files split | #1364 | merged |
| E7 The nightly environments check warn-only | #1348 | merged |
| D4 Zero a11y violations over a page list | #1352 | merged |
| D5 Delete the advisory printed-names check | #1358 | merged |
| D10 OgCard snapshot replaced by read-back assertions | #1347 | merged |
| A6 rules-lookup, design-reviewer and gate-fixer subagents | #1360 | draft: owner's call |
| B9 Catalog as the default listing at a desktop measure | #1363 | draft: owner's call (amends EDL E2) |
| D8 Measure Dashboard use (spike) | #1355 | draft: owner's call |
| D12 Discord bot command usage (spike) | #1351 | draft: owner's call |
| O6 Split the ADRs out of ARCHITECTURE.md | #1353 | paused by the owner |

Every other ticked item is queued or building; the ledger artifact carries its live status.

## The origin and the design artifacts

A local agent cannot open claude.ai artifacts, so this is a text snapshot (2026-10-12). Where they disagree, [the origin](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm) wins, then [ruleset.md](ruleset.md).

| Artifact | Summary |
| --- | --- |
| [Salvage Union Brand Refresh](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm) | **The origin**: the board canvas listed below. |
| [Entity Display Language](https://claude.ai/artifact/5Wf8KGHCjgcMzJV7zY381C) | Agreed: one entity model, five forms (Mention, Token, Row, Card, Page), modes, nesting, hard rules E1–E17 and the six-phase migration. Codified in [entity-display-language.md](entity-display-language.md). |
| [Traits and Facets](https://claude.ai/artifact/TDRC7wUBiFBRBHf3mVwHLR) | Retires the book's italic "//" line: action type → stamp, range and damage → Stats, traits → Tags (EDL E17). |
| [SRD Index Refresh](https://claude.ai/artifact/V77WHFAs2UWdVW3ociTWHw) | The `/schema/[schemaId]` listings as one compact card, grouped as the book prints them, with art, one filter rail and a chapter-toned foot (built as PL). |
| [Missing Artwork Redactions](https://claude.ai/artifact/3a1uSWEZ2rKcGFshGq4DJu) | Five options for entities without art, taken from how the Workshop Manual censors entries; the patch, strip and REMOVED stamp shipped in PL. |
| [Design Refresh Preview Tour](https://claude.ai/artifact/UyfFQkZejGFyq7eN5XTPks) | Desktop and phone captures of 32 pages on the preview deploy, recaptured after each deploy. |

### The origin's boards

Board ids as the origin titles them, and where code comments cite each (`board NN`). Uncited boards have no code reference.

| Board | Title | Cited in |
| --- | --- | --- |
| 01 | The brief | — |
| 02 | Issue register | — |
| 02b | From the book | — |
| 03 | Colour: paper page, legible bands | component-lib `design/` (tokens, contrast test), `theme.css` |
| 04 | Type: raise the floor | `theme.css` |
| 05 | One union bar | `AppBar`, ITUN `GlobalSearch`, `index.css`, srd `pages.css` |
| 05b | Texture trial: flat, worn, distressed | — |
| 05c | Texture trial: speckle only | ruleset, `Speckle`, `cardGrain`, tokens, `Theme` stories |
| 06 | SRD home: the manual's contents page | srd home (`HomeContents`, `HeroSearch`, `index.page`), `Footer`, `chapters`, `ChapterFoot`, `Slab` |
| 07 | SRD entity page | `EntityPageFrame`, `EntityPageStamps`, `CardPage`, `entityPage`, `StatColumn`, `CardImage`, `ChapterFoot` |
| 08 | SRD entity, phone | `NavDrawer`, `EntityPageFrame`, `EntityCardStatic`, `index.css` |
| 08b | SRD roll table: rolling and reading the result | `RollTablePage`, `RollTableView`, `RollTableIsland`, `rollTablePage`, `columnsTablePage` |
| E1 | Entity card: size × extent | `referenceEntity/card/` (header, seam, pennant, facets, tone) |
| E2 | Entity card: nesting and depth | `NestedCards`, `bodyBlocks`, `ChassisAbilitiesContent` |
| E3 | Entity card: the five contexts | `StatusRail`, `CardPennant`, `peekPlate` |
| E4 | Entity card: embedded roll table states | `CardRollTable` |
| 09 | ITUN front door | `FrontDoor`, `Roster`, `AppHeader`, `SiteFooter` |
| 10 | Pilot sheet: printed, not a form | ITUN `components/sheet/`, `Field`, `SheetSectionCard`, `MakeACopy` |
| D1 | Dashboard: boarded, resolving an action | `Dashboard`, `DeckList`, `ResolvePanel`, `RailBar`, `VitalGauge` |
| D2 | Dashboard: on foot, Crew tab, a Minor with a problem | `CrewTab`, `BoardControl`, `PilotSlot`, `useGameFeed` |
| D3 | Dashboard: Downtime, Crawler Major | `DowntimeWizard`, `MajorFrame`, `RailUnit`, `slotLayout` |
| D4 | Dashboard on a phone: Mech tab | `DashboardPhone`, `PhoneMajorFrame`, `DashboardGauge`, `pipRows` |
| D5 | Dashboard on a phone: resolving | `PhoneResolve`, `DashboardPhone` |
| P1 | Saving a mech pattern (user-made) | `SavePatternPage`, `patterns`, `CardSeam`, `NpcSheet`, convex `shelf` |
| P2 | A shared pattern page: reference-styled, clearly user-made | `PublicPattern`, convex `publicSheet`, `ChapterBand` stories |
| N1 | NPC designer: a generic NPC | `AnyNpcDesigner`, `NpcDesignerPage`, `npc.css` |
| N2 | NPC designer: crawler crew | `CrewBoard`, `crewFormState`, `npcModel` |
| M1 | Mediator dashboard | ITUN `components/mediator/` |
| M2 | Running a Game: proposals, Downtime, invites | ITUN `components/games/` (`GameHub`, `CrewSeats`, `DowntimeTrack`) |
| S1 | Shelves: everything you keep | ITUN `components/shelves/`, `Roster`, `ChapterBand`, `Slab` |
| PV1 | Link previews: reference and player things | `OgCard`, `ogCardText`, ITUN `previewSummary`, convex `publicSheet` |
| — | EntityCard and OgCard (component boards) | — |
| 12 | Roadmap | — |

Board "P1"/"P2" here are the origin's pattern boards, not build phases P1/P2.
