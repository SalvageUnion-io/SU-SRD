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
2. **Token** — `name [chips]`, one line, name cut out; links and Peeks as a Mention.
3. **Row** — every list: art column (≥ 18rem, where the schema has art), head (tier on the band, name, chips, mode slot; name on the paper cut-out, chips beside it, as on a Card), a paper body only for a lead or stamp.
   In a `data-entity-grid` every Row is the same height and every head's name line reserves two lines.
   **Tile** — the SRD Catalog's Row: 3:4 art, name notched into the band, compact facts, lead; link only.
4. **Card** — the whole entity in place: head (title, labels — pills, User-made — and chips), prose, actions as bands, children as Rows, table as a roll bar, cite; comfortable (≥ 30rem) or compact.
5. **Page** — the detail view: an SRD route, ITUN's detail dialog. From 64rem the hero floats left (42%, ≤ 32rem tall) and sections flow beside it.
   Ability trees and pattern rows clear the art; a stack spans the column, 52rem with no art; a phone stacks the art above.
6. **Peek** — a compact Card, read-only, children as Tokens. A Mention or trait chip carries only `data-peek`; one `PeekHost` per app opens it, lazily.

## Modes

1. **read** — no affordance; all forms (Peek, page bodies, reviews).
2. **link** — the whole surface, no chevron; Mention, Token, Row.
3. **select** — ink ring and "Selected" seal; Row, Card (pickers, wizards).

## Hard rules

Each is checkable; breaking one needs an amendment here first.

- **E1** Choose the form by the job and the room, never by the app.
- **E2** Every list of entities is a list of Rows (grid, masonry and columns are layout). Except the SRD Catalog: Tiles where the schema has art, default at ≥ 75rem, each line filled to the margin; the reader's choice is kept.
- **E3** Use a Token only when a Row will not fit: three or more on a line, a slot under 12rem, or a pattern's loadout.
- **E4** An entity named in prose is a Mention: Peek on hover or long-press, the Page on click. Never a chip, Stat or raw markup.
- **E5** The detail view is always a Page (in ITUN, the detail dialog): no new-tab `window.open`.
- **E6** Nest one form down, two levels deep (Page → Row, Card → Row, Row → count chip); a third level is a link or a Peek.
- **E7** Modes fill slots; they never change anatomy.
- **E8** A Listing never expands in place (ruleset §1.5).
- **E9** Facts and traits are chips (horizontal Stats; traits link), sections Slabs. Citations are text on every foot (`Workshop Manual · p.112`). Only a Page's foot names the kind; stamps that say more stay.
- **E10** Art appears by room, not by prop; no art, no art place, save a Tile in a catalog with art (a censor mark).
- **E11** The lead appears only while browsing (SRD listings and search page).
- **E12** Fill follows kind: "have" entities wear their tone; "do" entities the ink banner as a Card or Page, and as a Row but for an ability.
  An ability's Row wears its tier, as its track and page band do: Core `pilot`, Advanced and Hybrid `tier-hybrid`, Legendary `crawler`.
- **E13** Texture and the user-made treatment come from the surface and the instance.
- **E14** Tables are the Table instrument: a roll bar in a Card, the roll instrument on a Page or panel; its ROLL THE DIE stamp is the roll button.
- **E15** No hand-built entity markup outside `component-lib/src/entity/`.
- **E16** A Peek is read-only and terminal.
- **E17** No "//" line: all chips are one head group: action type as printed ("Turn Action"), facts, traits (`[Burn | 2]`), then the cost, the book's pointy box (`2 EP`; a Dashboard button). Right of the title; on a phone under it; never above it. On ink each chip has a paper rule.
- **E18** No form cuts a name (bar a Token's), stamp or chip to "…": it wraps or widens.
- **E19** A chassis ability shows only on its chassis's and its patterns' pages (either app) and in ITUN's builder pick cards, where choosing needs it; never in a picker dialog, Row, Tile, Peek, nested or other Card.
- **E20** Above a show page's title: only the breadcrumb (ITUN sheet: controls top right, `corner`); stamps, chips, other controls cluster right of it, under it on a phone (`asideAt="notch"`); a chassis's stats lead its body.

## Which form, where

1. **SRD listing** — Row (art, lead), link; Tile at ≥ 75rem with art (E2). **SRD entity, pattern, table or guide page** — Page, read; children link. **A pattern** — the chassis ability on its page (E19), then Systems and Modules as full-width Tokens, one a line.
2. **Search, both apps** — Row (no lead), link; SRD header dropdown: Token, link. **Any prose** — Mention: Peek, then Page.
3. **ITUN wizard or picker** — Row, Card for the focused pick; select. **Live sheet** — Row and Card.
4. **ITUN dense slots** (inventory strip, bays, loadouts) — Token, link. **Deck, resolve** — Row / Card.
5. **ITUN "open" anywhere** — the Page in the detail dialog. **Mediator opposition tray** — Row. **OG cards, the bot** — fed by the model.
