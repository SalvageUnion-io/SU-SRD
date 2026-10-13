# Entity Display Language

The law for **how an entity is drawn**, in the SRD and ITUN alike; [ruleset.md](ruleset.md) governs primitives, tokens and contexts (amend one first where they disagree).
Status: agreed. Code: `packages/component-lib/src/entity/`.

## Pipeline

1. **Entity** — a `salvageunion-reference` record plus an optional instance (condition, uses, count, notes, title, user-made).
2. **Model** — `toEntityModel(entity, instance?)` in `packages/salvageunion-reference/lib/view/`: pure, serialisable, shared by both apps and the bot.
   Resolves identity, kind, tone, facts, traits, lead, prose, actions, children, table, art and citation once; no form computes a fact.
3. **Form** — which parts to draw, in a fixed order. **Mode** — which affordances fill the form's slots. Only these two are React.
4. **Surface context** — reference resolution, band texture and the user-made treatment are supplied once, never per call.

## Forms

1. **Mention** — names an entity in prose, in the prose's own type; links where a route exists; hover or long-press Peeks.
2. **Token** — `[kind] name [one fact]`, one size; always opens its entity; Peeks on hover or long-press.
3. **Row** — every list: art column (≥ 18rem, where the schema has art), head (tier, name with the kind stamp right of it, cost pennant, mode slot), paper body (facts, traits, lead while browsing).
   In a `data-entity-grid` every Row is the same height and every head's name line reserves two lines.
   **Tile** — the SRD Catalog's Row: 3:4 art, name notched into the band, compact facts, lead; link only.
4. **Card** — the whole entity in place: head (the title, its labels — kind stamp, pills, User-made — right of it, in flow), facts, prose, actions as bands, children as Rows, table as a roll bar, cite; comfortable (≥ 30rem) or compact.
5. **Page** — the detail view: an SRD route, ITUN's detail dialog. From 64rem the hero floats left (42%, ≤ 32rem tall) and sections flow beside it.
   Ability trees and pattern rows clear the art; a tray spans the column (`CardTray`'s `flush`); on a phone the art stacks above.
6. **Peek** — a compact Card, read-only, children as Tokens. A Mention or Tag carries only `data-peek`; one `PeekHost` per app opens it and loads it lazily.

## Modes

1. **read** — no affordance; all forms (Peek, page bodies, reviews).
2. **link** — whole surface plus a head chevron; Mention, Token, Row.
3. **select** — ink ring and "Selected" seal; Row, Card (pickers, wizards).

## Hard rules

Each is checkable; breaking one needs an amendment here first.

- **E1** Choose the form by the job and the room, never by the app.
- **E2** Every list of entities is a list of Rows (grid, masonry and columns are layout). Except the SRD Catalog: Tiles where the schema has art, default at ≥ 75rem; the reader's choice is kept.
- **E3** Use a Token only when a Row will not fit: three or more on a line, or a slot under 12rem.
- **E4** An entity named in prose is a Mention: Peek on hover or long-press, the Page on click. Never a chip, Stat or raw markup.
- **E5** The detail view is always a Page (in ITUN, the detail dialog): no new-tab `window.open`.
- **E6** Nest one form down, two levels deep (Page → Row, Card → Row, Row → count chip); a third level is a link or a Peek.
- **E7** Modes fill slots; they never change anatomy.
- **E8** A Listing never expands in place (ruleset §1.5).
- **E9** Facts are Stats, traits are Mentions or Tags, citations are Tags, sections are Slabs, kinds are Stamps (ruleset §3).
- **E10** Art appears by schema and room, not by prop; an entity without art shows its censor mark.
- **E11** The lead appears only while browsing (SRD listings and search page).
- **E12** Fill follows kind: "have" entities wear their tone; "do" entities the ink banner as a Row, Card or Page, an ability's tier on its numeral and pennant (ruleset §3.1).
- **E13** Texture and the user-made treatment come from the surface and the instance.
- **E14** Tables are the Table instrument: a roll bar in a Card, the roll instrument on a Page or panel.
- **E15** No hand-built entity markup outside `component-lib/src/entity/`.
- **E16** A Peek is read-only and terminal.
- **E17** There is no "//" line: the action type is a head stamp, facets are Stat cells after the entity's facts, traits are Tags with a parameter cell (`[Burn | 2]`).

## Which form, where

1. **SRD listing** — Row (art, lead), link; Tile at ≥ 75rem with art (E2). **SRD entity, pattern, table or guide page** — Page, read; children link. **A pattern's loadout on a card or a host's pattern list** — Mention with a framed TL Stat, the book's plain list of names (Core Book p.101); the part's tone stays on its own Row, Card and Page.
2. **Search, both apps** — Row (no lead), link. **Any prose** — Mention: Peek, then Page.
3. **ITUN wizard or picker** — Row, Card for the focused pick; select. **Live sheet** — Row and Card.
4. **ITUN dense slots** (inventory strip, bays, loadouts) — Token, link. **Deck, resolve** — Row / Card.
5. **ITUN "open" anywhere** — the Page in the detail dialog. **Mediator opposition tray** — Row. **OG cards, the bot** — fed by the model.
