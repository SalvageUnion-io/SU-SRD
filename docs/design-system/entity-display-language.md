# Entity Display Language

The law for **how an entity is drawn**, SRD and app alike; [ruleset.md](ruleset.md) governs primitives, tokens and contexts (amend one first if they disagree).
Status: agreed. Code: `apps/web/src/components/entity/`.

## Pipeline

1. **Entity** — a `salvageunion-reference` record plus an optional instance (condition, uses, count, notes, title, user-made).
2. **Model** — `toEntityModel(entity, instance?)` in `packages/salvageunion-reference/lib/view/`: pure, serialisable, shared by every surface and the bot.
   Resolves every fact, the prose, children, table, art and cite once; no form computes one.
3. **Form** — which parts to draw, in a fixed order. **Mode** — which affordances fill the form's slots. Only these two are React.
4. **Surface context** — reference resolution, band texture and the user-made treatment come once, never per call.

## Forms

1. **Mention** — names an entity in prose, in the prose's own type; links where a route exists; hover or long-press Peeks.
2. **Token** — `name [chips] [actions]`, one row, name cut out, filling its line (one a line in a list); links and Peeks as a Mention.
   **Contentful** (N3): that head, then the entity's text, held in the subtle frame (E21): nested actions, chassis abilities, a bay's crew lead.
3. **Row** — every list: head (the art in its own paper window at the band's left, band on all sides, centred, ≥ 18rem where the schema has art; tier on the band, name, chips, mode slot; name on the paper cut-out, chips beside it), a paper body only for a lead or stamp.
   In a `data-entity-grid` every Row is one height and each name line reserves two.
   **Tile** — the SRD index's Row: 3:4 art if any, name notched in the band, facts, lead; link only.
4. **Card** — the whole entity in place: head (title, labels — pills, HOMEBREW — and chips), prose, actions and children as Tokens (E6), table as a roll bar, cite; comfortable (≥ 30rem) or compact.
5. **Page** — the detail view: an SRD route, the app's detail dialog. From 64rem the hero floats left (42%, ≤ 32rem tall) and sections flow beside it.
   Ability trees and pattern rows clear the art; a stack spans the column, 52rem with no art; a phone stacks the art above.
6. **Peek** — a compact Card, read-only, level 1 on its plate: children as Tokens (E6). Triggers bear `data-peek`; one lazy `PeekHost` per app opens it.

## Modes

1. **read** — no affordance; all forms (Peek, page bodies, reviews).
2. **link** — the whole surface, no chevron; Mention, Token, Row.
3. **select** — ink ring and "Selected" seal; Row, Card (pickers, wizards, the searcher), at level 1 (N7). One choice is a radio.
   An in-card entity choice (level 2) is a toggle Token: pressed, ring on its pill, unchosen dimmed by the one `selectable` dim, no seal.

## Hard rules

Each is checkable ([hard-rules.md](hard-rules.md) names the gates); breaking one needs an amendment here.

- **E1** Choose the form by the job and room, never the app.
- **E2** Every list of entities is a list of Rows (grid, masonry and columns are layout). Except an SRD index: Tiles, each line filled to the margin; abilities add a Tree (first).
- **E3** A Token at level 2 (E6) or where a Row will not fit: a long list, one a line (N4; a drone's parts two), a slot under 12rem.
  Only a Token is a head alone (N2); a Row or Card keeps its body.
- **E4** An entity named in prose is a Mention: Peek on hover or long-press, the Page on click. Never a chip, Stat or raw markup.
- **E5** The detail view is always a Page (form 5): no new-tab `window.open`.
- **E6** Three levels (N1): 0 the page box (Page, dialog, wizard step, Peek plate); 1 compact Rows or Cards; 2 Tokens only.
  One level deep on a Page: an open Row, not a Token (N8), bar a loadout or ability tree (R39).
  Nothing titled at level 2 or deeper; a Token nests nothing (deeper is its link or Peek). Nested Card and Peek names link.
- **E7** Modes fill slots; they never change anatomy.
- **E8** A Listing never expands in place (ruleset §1.5).
- **E9** Facts and traits are chips (horizontal Stats; traits link), sections Slabs. Citations are text on every foot, one line (ruleset Source 2); no foot names the kind (a mech sheet's CHASSIS chip does); stamps that say more stay.
- **E10** Art appears by room, not by prop; no art, no art place, save a Tile in a catalog with art (a censor mark).
- **E11** The lead appears only on an SRD index.
- **E12** Fill follows kind: "have" entities wear their tone; "do" entities the ink banner as a Card or Page, and as a Row but for an ability.
  An ability's Row wears its tier, as its track and page band do: Core `pilot`, Advanced and Hybrid `tier-hybrid`, Legendary `crawler`.
- **E13** Texture and user-made come from the surface and instance.
- **E14** Tables are the Table instrument: a roll bar in a Card (nested: Token, Table, Roll the Die), the roll instrument, open, on a Page, panel or resolve; its ROLL THE DIE stamp is the roll button, a result its marked row.
- **E15** No hand-built entity markup outside `entity/`. A rules block (When Damaged, a chassis ability) has one renderer in every context.
- **E16** A Peek is read-only and terminal.
- **E17** No "//" line: all chips are one head group, one even gap, in the class order of [chips-and-actions.md](chips-and-actions.md) (C2), actions inlined last (C8). Beside the name, never growing the head; overflow: the body's first row or +MORE (C2b); a Page's controls on a phone go over its title. On ink each chip has a paper rule.
- **E18** No form cuts a name (bar a Token's), stamp or chip to "…": it wraps or widens. A Token's head is one row filling its line (N4), of a static budget (C3); its name ends in "…".
- **E19** A chassis ability shows only on its chassis and pattern pages (level 1), mech hero and Discord card;
  nested (mech-wizard picks and stats step, Peek) it is a contentful Token (N3).
- **E20** On a show page's plate: only the trail (app sheet: `corner`); stamps, chips, controls fill as E17 (`asideAt="notch"`), Build With This last (phone: chip-sized); a chassis's stats lead its body.
- **E21** Entity frames are the subtle ink-40 (ruleset §4.3); only ability-tree Rows and patterns take a colour.
- **E22** A name and its cut-out sit at their head's left.

## Which form, where

1. **SRD index** — Tiles (lead), link (E2). **SRD entity, pattern, table or guide page** — Page, read; children link. **A pattern** — the chassis ability on its page (E19), then Systems and Modules at level 1, compact Cards, their actions Tokens (E6).
2. **Search, everywhere** — the bar's dropdown, Tokens, link.
3. **app wizard or picker** — Row, Card for the focused pick; select. **Live sheet** — Row and Card.
4. **app dense slots** (inventory, bays, loadouts) — Token, link. **Deck** — Token. **Resolve** — Row / Card.
5. **Mediator opposition tray** — Row. **OG cards, the bot** — fed by the model.
