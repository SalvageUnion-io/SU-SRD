# Design Sources

The claude.ai design pages the design system was drawn from, and the boards code cites as `board NN`.
An agent reads a page with the Artifact tool's `read` action, not a web fetch. [The origin](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm) wins, then [ruleset.md](ruleset.md).

## Pages

1. **[Salvage Union Brand Refresh](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm)** — the origin: the board canvas below.
2. **[Entity Display Language](https://claude.ai/artifact/5Wf8KGHCjgcMzJV7zY381C)** — one model, five forms, modes, nesting, rules E1–E20; codified in [entity-display-language.md](entity-display-language.md).
3. **[Traits and Facets](https://claude.ai/artifact/TDRC7wUBiFBRBHf3mVwHLR)** — retires the "//" line: action type → stamp, range and damage → Stats, traits → Tags (E17).
4. **[SRD Index Refresh](https://claude.ai/artifact/V77WHFAs2UWdVW3ociTWHw)** — listings as one compact card, grouped, with art, one filter rail, a chapter-toned foot.
5. **[Mini & Chip Grammar](https://claude.ai/artifact/KgnbEv1HTJ4sYoNxiyhffj)** — three zones, chip classes, budgets, lanes, actions inside the strip; codified in [chips-and-actions.md](chips-and-actions.md).

## The origin's boards

Id · title — where code cites it (`board NN`); "—" means no code cites it. Boards P1/P2 are pattern boards.

1. **01** The brief —. **02** Issue register —. **02b** From the book —.
2. **03** Colour: paper page, legible bands — `tokens.ts`, `contrast.test.ts`, `theme.css`. **04** Type: raise the floor — `theme.css`.
3. **05** One union bar — `AppBar`, the site's `SearchIsland`, `index.css`. **05b** Texture trial —. **05c** Speckle only — ruleset, `Speckle`, `cardGrain`, tokens.
4. **06** SRD home — `HomeContents`, `HeroSearch`, `SearchIsland`, `TopNavigation`, `index.page`, `Footer`, `chapters`, `ChapterFoot`, `Slab`.
5. **07** SRD entity page — `EntityPageFrame`, `EntityPageStamps`, `CardPage`, `entityPage`, `CardImage`, `StatColumn`, `Footer`. **08** Entity, phone — `NavDrawer`, `EntityCardStatic`, `index.css`.
6. **08b** SRD roll table — `RollTablePage`, `RollTableView`, `RollTableIsland`, `rollTablePage`, `columnsTablePage`, `RollTableInstrument`.
7. **E1** Card size × extent — `referenceEntity/card/` head, labels, pennant, facets, tone. **E2** Nesting — `NestedCards`, `bodyBlocks`.
8. **E3** Five contexts — `StatusBadge`, `peekPlate`. **E4** Embedded roll table — `CardRollTable`, `RollTableInstrument`.
9. **09** The app front door — `FrontDoor`, `Roster`, `shell/unionBar.ts`. **10** Pilot sheet, printed — the app `build/sheet/`, `Field`.
10. **D1–D5** Dashboard (retired; its successor is Play, `docs/wireframes/dashboard-cockpit/`): boarded, Crew tab, Downtime, phone Mech tab, phone resolve — the app `play/`, `VitalGauge`, `pipRows`.
11. **P1** Saving a pattern — `SavePatternDialog`, `PatternListing`, `patterns`, `CardLabels`, `NpcSheet`, `Sheet`, game-domain `pattern`, convex `shelf`. **P2** Shared pattern page — `PublicPattern`, convex `publicSheet`.
12. **N1** Generic NPC designer — `AnyNpcDesigner`. **N2** Crawler crew — `CrewBoard`, `crewFormState`.
13. **M1** Mediator dashboard (retired) — the app `play/mediator/`. **M2** Running a Game — the app `play/games/`.
14. **S1** Shelves — the app `build/shelves/`, `ChapterBand`, `Slab`. **PV1** Link previews — `OgCard`, `ogCardText`, `previewSummary`.
15. **12** Roadmap —. Component boards EntityCard and OgCard —.
