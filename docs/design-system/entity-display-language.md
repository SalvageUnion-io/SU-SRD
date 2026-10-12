# Entity Display Language

The law for **how an entity is drawn**, in the SRD and ITUN alike; [ruleset.md](ruleset.md) governs primitives, tokens and contexts (amend one first where they disagree).
Status: agreed; phases 1–3 have landed (`packages/component-lib/src/entity/`).

## Pipeline

1. **Entity** — a `salvageunion-reference` record plus an optional instance (condition, uses, count, notes, title, user-made).
2. **Model** — `toEntityModel(entity, instance?)` in `packages/salvageunion-reference/lib/view/`: pure, serialisable, shared by both apps and the bot.
   Resolves identity, kind, tone, facts, traits, lead, prose, actions, children, table, art and citation once; no form computes a fact.
3. **Form** — which parts to draw, in a fixed order. **Mode** — which affordances fill the form's slots. Only these two are React.
4. **Surface context** — reference resolution, band texture and the user-made treatment are supplied once, never per call.

## Forms

1. **Mention** — names an entity in prose, in the prose's own type; links where a route exists; hover or long-press Peeks.
2. **Token** — `[kind] name [one fact]`, one size; always opens its entity; Peeks on hover or long-press.
3. **Row** — every list: art column (≥ 18rem, where the schema has art), head (the kind stamp as its first line, then tier, name, cost pennant, mode slot), paper body (facts, traits, lead while browsing).
   In a `data-entity-grid` every Row is the same height and every head's name line reserves two lines.
   **Tile** — the SRD Catalog's Row: 3:4 art, name notched into the band, compact facts, lead; link only.
4. **Card** — the whole entity in place: head (its labels — kind stamp, pills, User-made — as the first line, in flow), facts, prose, actions as bands, children as Rows, table as a roll bar, cite; comfortable (≥ 30rem) or compact.
5. **Page** — the detail view: an SRD route, an ITUN drawer (sheet on phone). From 64rem the hero floats left (42%, ≤ 32rem tall) and sections flow beside it.
   Ability trees and pattern rows clear the art; a tray spans the column (`CardTray`'s `flush`); on a phone the art stacks above.
6. **Peek** — a compact Card, read-only, children as Tokens. A Mention or Tag carries only `data-peek`; one `PeekHost` per app opens it and loads it lazily.

## Modes

1. **read** — no affordance; all forms (Peek, page bodies, reviews).
2. **link** — whole surface plus a head chevron; Mention, Token, Row.
3. **select** — ink ring and "Selected" seal; Row, Card (pickers, wizards).
4. **count** — foot stepper and "N added" seal; Row.
5. **hold** — head condition stamp, foot uses / notes, disclosure to a Card; Token, Row, Card (sheet slots, trays, opposition).
6. **act** — the cost pennant is the button; Row, Card (decks, resolve panels).

## Hard rules

Each is checkable; breaking one needs an amendment here first.

- **E1** Choose the form by the job and the room, never by the app.
- **E2** Every list of entities is a list of Rows (grid, masonry and columns are layout). Except the SRD Catalog: Tiles where the schema has art, default at ≥ 75rem; the reader's choice is kept.
- **E3** Use a Token only when a Row will not fit: three or more on a line, or a slot under 12rem.
- **E4** An entity named in prose is a Mention: Peek on hover or long-press, the Page on click. Never a chip, Stat or raw markup.
- **E5** The detail view is always a Page: no large-card modals, no new-tab `window.open`.
- **E6** Nest one form down, two levels deep (Page → Row, Card → Row, Row → count chip); a third level is a link or a Peek.
- **E7** Modes fill slots; they never change anatomy.
- **E8** There is one way to fold: a Row's disclosure expands it into a Card in place.
- **E9** Facts are Stats, traits are Mentions or Tags, citations are Tags, sections are Slabs, kinds are Stamps (ruleset §3).
- **E10** Art appears by schema and room, not by prop; an entity without art shows its censor mark.
- **E11** The lead appears only while browsing (SRD listings and search page).
- **E12** Fill follows kind: "have" wears its tone, "do" the ink banner (Row, Card, Page), an ability's tier on numeral and pennant (§3.1); class-page ability Rows wear tier.
- **E13** Texture and the user-made treatment come from the surface and the instance.
- **E14** Tables are the Table instrument: a roll bar in a Card, the roll instrument on a Page or panel.
- **E15** No hand-built entity markup outside `component-lib/src/entity/` (lint-enforced once phase 6 lands).
- **E16** A Peek is read-only and terminal.
- **E17** There is no "//" line: the action type is a head stamp, facets are Stat cells after the entity's facts, traits are Tags with a parameter cell (`[Burn | 2]`).

## Which form, where

1. **SRD listing** — Row (art, lead), link; Tile at ≥ 75rem with art (E2). **SRD entity, pattern, table or guide page** — Page, read; children link.
2. **Search, both apps** — Row (no lead), link. **Any prose** — Mention: Peek, then Page.
3. **ITUN wizard or picker** — Row, Card for the focused pick; select / count. **Live sheet** — Row expanding to Card, hold.
4. **ITUN dense slots** (inventory strip, bays, loadouts) — Token, hold / link. **Deck, resolve** — Row / Card, act.
5. **ITUN "open" anywhere** — Page in a drawer (sheet on phone). **Mediator opposition tray** — Row, hold. **OG cards, the bot** — fed by the model.

## Migration

1. **Model** — done: `toEntityModel` and its parts; parity over every entity and pattern (`entityModelParity.test.ts`).
2. **Row + Token** — done: listings, search, pickers, loadouts and bays.
3. **Mention + Peek** — done: no raw `[[` markup in rendered HTML.
4. **Card + Hold** — Card densities, the Row ⇄ Card disclosure, hold and count modes; done when sheets, wizards, opposition and decks migrate.
5. **Page + instruments** — the Page as route and panel, the Table instrument, guide Steps; done at one roll-table renderer.
6. **Delete** — remove `ReferenceEntityCard` and its axes, add the E15 lint; done when `card/` is gone.
