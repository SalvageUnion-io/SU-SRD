# Entity Display Language

The law for **how an entity is drawn**, SRD and app alike; [ruleset.md](ruleset.md) governs primitives and contexts (amend one first on a conflict).
Status: agreed. Code: `apps/web/src/components/entity/`.

## Pipeline

1. **Entity** — a `salvageunion-reference` record plus an optional instance (a player's copy: condition, uses, user-made).
2. **Model** — `toEntityModel(entity, instance?)` in `packages/salvageunion-reference/lib/view/`: pure, serialisable, shared by every surface and the bot.
   Resolves every fact, prose, child, table, art and cite once; no form computes one.
3. **Form** — which parts to draw, in order. **Mode** — what fills its slots. Only these two are React.
4. **Surface context** — reference resolution, band texture and user-made come once, never per call.

## Forms

Each is a Size (ruleset §4.7) and an extent: **header-only** (overflow ends in +MORE, C5) or **contentful** (overflow opens the content, C2b).

1. **Mention** — names an entity in prose, in the prose's own type; links where a route exists; hover or long-press Peeks.
2. **Mini** (`<Entity size="mini">`) — `name [chips] [actions]`, one row filling its line, name cut out; links and Peeks as a Mention.
   **Contentful** (N3): then the entity's text, in the subtle frame (E21): nested actions, chassis abilities, a crew lead.
3. **Compact** (`<Entity size="compact">`) — every list: head (art in its paper window at the band's left, ≥ 18rem with art; tier, name on the paper cut-out, chips beside it, mode slot), a body only for a lead, stamp or linked units.
   In a `data-entity-grid` every Compact is one height and each name line reserves two.
   **Index layout** (`layout="index"`) — the SRD index's: 3:4 art if any, name notched in the band, facts, lead; link only.
4. **Compact contentful** (`ReferenceEntityCard`, `size="compact"`) — the whole entity: head, prose, actions and children as Minis (E6), table as a roll bar, cite; an open Compact (N8). **Full contentful** (`size="full"`): the same, ≥ 30rem.
5. **Page** (`presentation="page"`) — the detail view (SRD route, app dialog), a Full contentful. From 64rem the hero floats left (42%, ≤ 32rem), sections beside it.
   Ability trees and pattern rows clear the art; a stack spans the column (52rem, no art); a phone stacks the art first.
6. **Peek** — a Compact contentful, read-only, level 1 on its plate: children as Minis (E6). `data-peek` triggers; one lazy `PeekHost`.

## Modes

1. **read** — no affordance; all forms (Peek, page bodies, reviews).
2. **link** — the whole surface, no chevron; Mention, Mini, Compact.
3. **select** — ink ring and "Selected" seal; Compact or contentful (pickers, wizards, the searcher; N7). One choice is a radio.
   An in-card choice (level 2) is a toggle Mini: pressed, ring on its pill, unchosen dimmed by the one `selectable` dim, no seal.

## Hard rules

Each is checkable ([hard-rules.md](hard-rules.md) names the gates); breaking one needs an amendment here.

- **E1** Choose the form by the job and room, never the app.
- **E2** Every list of entities is a list of Compacts (grid, masonry, columns: layout). Except an SRD index: the index layout, lines filled to the margin; abilities add a Tree (first).
- **E3** A Mini at level 2 (E6) or where a Compact will not fit: a long list, one a line (N4; a drone's parts two), a slot under 12rem.
- **E4** An entity named in prose is a Mention: Peek on hover or long-press, the Page on click. Never a chip, Stat or raw markup.
- **E5** The detail view is always a Page: no new-tab `window.open`.
- **E6** Three levels: 0 the page box (Page, dialog, wizard step, Peek plate); 1 Compacts; 2 Minis only. Nested contentful and Peek names link.
  **N1** nothing titled at level 2 or deeper; **N2** nested, only a Mini is a head alone (a header-only Compact is a list item); **N3** a Mini nests nothing (deeper: its link or Peek); **N4** a Mini fills its line; **N5**, **N6**: ruleset §5;
  **N7** select is level 1's, bar the in-card toggle; **N8** one level deep on a Page is an open Compact, bar a loadout or ability tree (R39).
- **E7** Modes fill slots; they never change anatomy.
- **E8** A header-only Compact never expands in place (ruleset §1.5).
- **E9** Facts and traits are chips (horizontal Stats; traits link), sections Slabs. Citations are text on every foot, one line (ruleset Source 2); no foot names the kind (a mech sheet's CHASSIS chip does); stamps that say more stay.
- **E10** Art appears by room, not prop; no art, no place, save an index Compact in a catalog with art (censored).
- **E11** The lead appears only on an SRD index.
- **E12** Fill follows kind: "have" entities wear their tone, "do" entities the ink banner contentful or on a Page, and as a Compact but for an ability.
  An ability's Compact, track and band wear its tier: Core `pilot`, Advanced and Hybrid `tier-hybrid`, Legendary `crawler`.
- **E13** Texture and user-made come from the surface and instance.
- **E14** Tables are the Table instrument: a roll bar in a contentful (nested: Mini, Table, Roll the Die), open on a Page, panel or resolve; its ROLL THE DIE stamp is the roll button, a result its marked row.
- **E15** No hand-built entity markup outside `entity/`. A rules block (When Damaged, a chassis ability) has one renderer in every context.
- **E16** A Peek is read-only and terminal.
- **E17** No "//" line: all chips are one head group, one even gap, in the class order of [chips-and-actions.md](chips-and-actions.md) (C2), actions inlined last (C8), beside the name and filled as C2b. On ink each chip has a paper rule.
- **E18** No stamp or chip is cut to "…". A Mini's or Compact's name that will not fit ends in "…" and Peeks whole, yielding to its chips down to half its line (C5); any other wraps. A Mini's head is one row (N4), of a static budget (C3).
- **E19** A chassis ability shows only on its chassis and pattern pages (level 1), mech hero and Discord card;
  nested (mech-wizard picks and stats step, Peek) it is a contentful Mini (N3).
- **E20** On a show page's plate: only the trail (app sheet: `corner`); stamps, chips, controls fill as E17 (`asideAt="notch"`), Build With This last (phone: chip-sized); a chassis's stats but TL, SV lead its body
- **E21** Entity frames are the subtle ink-40 (ruleset §4.3); only ability-tree Compacts and patterns take a colour.
- **E22** A name and its cut-out sit at their head's left.

## Which form, where

1. **SRD index** — the index layout (lead), link (E2). **SRD entity, pattern, table or guide page** — Page, read; children link.
2. **Search, everywhere** — the bar's dropdown, Minis, link.
3. **app wizard or picker** — Compact, contentful for the focused pick; select. **Live sheet** — Compact.
4. **app dense slots** (inventory, bays, loadouts) — Mini, link. **Deck** — Mini. **Resolve** — Compact.
5. **Mediator opposition tray** — Compact.
