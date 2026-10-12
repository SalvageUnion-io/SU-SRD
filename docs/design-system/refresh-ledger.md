# Design Refresh Ledger

What `design-refresh` shipped, under which commit tag, and what is left; status as of 2026-10-12, updated as PRs land.
Tags: `[design-refresh <phase>]` (build phases) and `[refit <ID>]` (the audit fleet). The Tailwind plan's phases are TW0–TW7 ([tailwind-removal.md](tailwind-removal.md)), never a `P` tag.

## Build phases

From `git log origin/design-refresh`; one squash-merged PR each unless noted.

1. **P0** Workshop Manual canon in the ruleset — #1283, closed unmerged; P1 added `ruleset.md` with the canon.
2. **P1** Refresh tokens and their gates — #1284. **P2a** Union bar, ChapterBand, Slab — #1285. **P2b** One entity-card anatomy, two fills, nesting — #1287.
3. **P3** SRD surfaces as Workshop Manual pages — #1289. **P4** Invites, front door, print-read sheets, Flight Deck — #1290.
4. **P5** Dashboard phone form — #1295. **P6** User-made dashed rule, shareable patterns — #1288. **P7** NPCs and crew crawlers — #1293 (+ #1297–#1299).
5. **P8** Mediator Dashboard, running a Game — #1296. **P9** Shelves — #1294. **P10** One OgCard for link previews — #1292.
6. **PR** Named tables roll via `@randsum/salvageunion` — #1312. **PZ** Canvas-only story URLs, the origin as design source — #1331. **PF** Footer in the chapter's band — #1332.
7. **PL** Compact-card listings grouped as the book prints them, censor marks for missing art, one-screen roll tables — no PR: 8 direct commits (`6044219`…`58692ee`).
8. **EDL** ([entity-display-language.md](entity-display-language.md)) — phases 1 model (`18bb05f`), 2 Row + Token (`0223974`), 3 Mention + Peek (`c49a5ef`) merged without PRs.
   Remaining: 4 Card + Hold, 5 Page + instruments, 6 delete `ReferenceEntityCard` and add the E15 lint.

## Refit fleet

The [SURef Refit Ledger](https://claude.ai/artifact/HCbph3uwU4uCH6v1pxkpAY) drives it: one PR per ticked item into `design-refresh`, titled `… [refit <ID>]`. Ids: B beauty, S sites, A agents, E efficiency, D delete, T standardize, O organization.

1. **Merged** — A1 #1361, A8 #1359, A10 #1346, B1 #1356, B3 #1349, B5 #1350, B6 #1365, B8 #1357, S4 #1354, S6 #1362 + #1366, E2 #1364, E7 #1348, D4 #1352, D5 #1358, D10 #1347.
2. **Draft, owner's call** — A6 #1360 (subagents), B9 #1363 (Catalog default; amends EDL E2), D8 #1355 and D12 #1351 (spikes). **Paused** — O6 #1353 (ADR split).
3. **In progress** — the full Tailwind cutover (ledger item D2) as items TW-a…TW-i. Other ticked items: queued or building; the ledger artifact carries live status.

## Design artifacts

claude.ai pages a local agent cannot open; text snapshot of 2026-10-12. [The origin](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm) wins, then [ruleset.md](ruleset.md).

1. **[Salvage Union Brand Refresh](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm)** — the origin: the board canvas below.
2. **[Entity Display Language](https://claude.ai/artifact/5Wf8KGHCjgcMzJV7zY381C)** — one model, five forms, modes, nesting, rules E1–E17, six-phase migration; codified in entity-display-language.md.
3. **[Traits and Facets](https://claude.ai/artifact/TDRC7wUBiFBRBHf3mVwHLR)** — retires the "//" line: action type → stamp, range and damage → Stats, traits → Tags (E17).
4. **[SRD Index Refresh](https://claude.ai/artifact/V77WHFAs2UWdVW3ociTWHw)** — listings as one compact card, grouped, with art, one filter rail, a chapter-toned foot (built as PL).
5. **[Missing Artwork Redactions](https://claude.ai/artifact/3a1uSWEZ2rKcGFshGq4DJu)** — five fills for entities without art, from the manual's censor marks; patch, strip and stamp shipped in PL.
6. **[Design Refresh Preview Tour](https://claude.ai/artifact/UyfFQkZejGFyq7eN5XTPks)** — desktop and phone captures of 32 preview pages, recaptured each deploy.

## The origin's boards

Id · title — where code cites it (`board NN`); "—" means no code cites it. Board P1/P2 are pattern boards, not build phases.

1. **01** The brief —. **02** Issue register —. **02b** From the book —.
2. **03** Colour: paper page, legible bands — `tokens.ts`, `contrast.test.ts`, `theme.css`. **04** Type: raise the floor — `theme.css`.
3. **05** One union bar — `AppBar`, ITUN `GlobalSearch`, `index.css`. **05b** Texture trial —. **05c** Speckle only — ruleset, `Speckle`, `cardGrain`, tokens.
4. **06** SRD home — `HomeContents`, `HeroSearch`, `index.page`, `Footer`, `chapters`, `ChapterFoot`, `Slab`.
5. **07** SRD entity page — `EntityPageFrame`, `EntityPageStamps`, `CardPage`, `entityPage`, `CardImage`. **08** Entity, phone — `NavDrawer`, `EntityCardStatic`.
6. **08b** SRD roll table — `RollTablePage`, `RollTableView`, `RollTableIsland`, `rollTablePage`, `columnsTablePage`.
7. **E1** Card size × extent — `referenceEntity/card/` head, seam, pennant, facets, tone. **E2** Nesting — `NestedCards`, `bodyBlocks`.
8. **E3** Five contexts — `StatusRail`, `CardPennant`, `peekPlate`. **E4** Embedded roll table — `CardRollTable`.
9. **09** ITUN front door — `FrontDoor`, `Roster`, `AppHeader`, `SiteFooter`. **10** Pilot sheet, printed — ITUN `components/sheet/`, `Field`.
10. **D1–D5** Dashboard: boarded, Crew tab, Downtime, phone Mech tab, phone resolve — ITUN `components/dashboard/`, `VitalGauge`, `pipRows`.
11. **P1** Saving a pattern — `SavePatternPage`, `patterns`, `CardSeam`, convex `shelf`. **P2** Shared pattern page — `PublicPattern`, convex `publicSheet`.
12. **N1** Generic NPC designer — `AnyNpcDesigner`. **N2** Crawler crew — `CrewBoard`, `crewFormState`.
13. **M1** Mediator dashboard — ITUN `components/mediator/`. **M2** Running a Game — ITUN `components/games/`.
14. **S1** Shelves — ITUN `components/shelves/`, `ChapterBand`, `Slab`. **PV1** Link previews — `OgCard`, `ogCardText`, `previewSummary`.
15. **12** Roadmap —. Component boards EntityCard and OgCard —.
