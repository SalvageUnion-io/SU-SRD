# Entity Display Language

The law for **how an entity is drawn**, SRD and app alike; [ruleset.md](ruleset.md) governs primitives and contexts (amend one first on a conflict).
Code: `apps/web/src/components/entity/`.

## Pipeline

1. **Entity** — a `salvageunion-reference` record plus an optional instance.
2. **Model** — `toEntityModel(entity, instance?)` (`salvageunion-reference/lib/view/`): pure, shared by every surface and the bot, resolving all once.
3. **Form** — which parts to draw. **Mode** — what fills its slots. Only these two are React.
4. **Surface context** — links, texture and user-made come once, never per call.

## Forms

Each is a Size (ruleset §4.7) and an extent: **header-only** (overflow ends in +MORE, C5) or **contentful** (overflow opens the content, C2b).

1. **Mention** — an entity named in prose, in its type; links where a route exists, Peeks on hover or long-press.
2. **Mini** (`<Entity size="mini">`) — `name [chips] [actions]`, one row filling its line, name cut out on its foot; links and Peeks as a Mention. Contentful (N3): then its text in the subtle frame (E21).
3. **Compact** (`<Entity size="compact">`) — every list: head (art window at the band's left, ≥ 18rem with art; tier, name cut out, chips beside it, mode slot), a body only for a lead, stamp or linked units.
   In a `data-entity-grid` every Compact is one height and each name line reserves two.
   **Index layout** (`layout="index"`) — the SRD index's: 3:4 art if any, name notched in the band, facts, lead; link only.
4. **Compact contentful** (`ReferenceEntityCard`, `size="compact"`) — the whole entity: head, prose, actions and children as Minis (E6), table as a roll bar, cite; an open Compact (N8). **Full contentful** (`size="full"`): the same, ≥ 30rem.
5. **Page** (`presentation="page"`) — the detail view (SRD route, app dialog), a Full contentful. From 64rem the hero floats left (42%, ≤ 32rem); ability trees and pattern rows clear it; no art spans 52rem; a phone stacks the art first.
6. **Peek** — E23, read-only, level 1 on its plate; one `PeekHost`.

## Modes

1. **read** — no affordance; all forms. 2. **link** — the whole surface, contentful its head, no chevron.
3. **select** — ink ring and "Selected" seal; Compact or contentful (N7); one choice is a radio. An in-card choice is a toggle Mini: ring on its pill, unchosen dimmed (`selectable`), no seal.

## Hard rules

Each names its gate ([hard-rules.md](hard-rules.md)); breaking one needs an amendment here.

- **E1** The form follows the job and room, never the app.
- **E2** Every list of entities is Compacts (grid, masonry, columns), but an SRD index: the index layout, lines filled; abilities add a Tree (first).
- **E3** A Mini at level 2 (E6) or where a Compact will not fit: a long list, one a line (N4; a drone's parts two), a slot under 12rem.
- **E4** An entity named in prose is a Mention, never a chip, Stat or raw markup.
- **E5** The detail view is a Page, never a new tab.
- **E6** Three levels: 0 the page box (Page, dialog, wizard step, Peek plate); 1 Compacts; 2 Minis only. Nested contentful and Peek heads link.
  **N1** nothing titled at level 2 or deeper; **N2** nested, only a Mini is a head alone (a header-only Compact is a list item); **N3** a Mini nests nothing (deeper: its link or Peek), bar a sheet's crawler bay (R46); **N4** a Mini fills its line; **N5**, **N6**: ruleset §5;
  **N7** select is level 1's, bar the in-card toggle; **N8** one level deep on a Page is an open Compact, bar a loadout or ability tree (R39).
- **E7** Modes fill slots, never change anatomy (C9). **E8** A header-only Compact never expands in place (ruleset §1.5).
- **E9** Facts and traits are chips (traits link), sections Slabs. Citations are text on one foot line (ruleset Source 2), never naming the kind.
- **E10** Art appears by room, not prop; no art, no place, save an index Compact in a catalog with art (censored).
- **E11** A lead appears only on an SRD index.
- **E12** Fill follows kind: "have" entities wear their tone, "do" entities the ink banner contentful or on a Page, and as a Compact but for an ability.
  An ability's Compact, track and band wear its tier: Core `pilot`, Advanced and Hybrid `tier-hybrid`, Legendary `crawler`.
- **E13** Texture and user-made come from the surface and instance. **E16** A Peek is read-only and terminal (ruleset §1.6).
- **E23** A Peek is one form below its trigger's (a contentful Compact down to a Mini), never beside a native tooltip.
- **E14** Tables are the Table instrument: a roll bar in a contentful (nested: a Mini), open on a Page, panel or resolve; its ROLL THE DIE stamp the roll button, a result its marked row.
- **E15** No hand-built entity markup outside `entity/`; a rules block (When Damaged) has one renderer everywhere.
- **E17** No "//" line: a head's chips are one group, as [chips-and-actions.md](chips-and-actions.md) C1–C8 lay it; on ink each chip has a paper rule.
- **E18** Only the name flexes (C5); no stamp or chip is cut to "…". A Mini's head is one row (N4), of a static budget (C3).
- **E19** A chassis ability shows only on its chassis and pattern pages, mech hero and Discord card; nested (wizard, Peek) a contentful Mini.
- **E20** On a show page's plate: only the trail (app sheet: `corner`); stamps, chips, controls fill as E17 (`asideAt="notch"`), then Share (phone: glyph) and Build With This last (phone: chip-sized); a chassis's stats but TL, SV lead its body
- **E21** An entity's frame is its band's paint (ruleset §4.3). **E22** A name and its cut-out sit at their head's left.

## Which form, where

SRD index: index layout, link. SRD page: Page, read. Search: Minis, link. Wizard or picker: Compact, select (focused pick contentful). Live sheet, Resolve, opposition tray: Compact. Dense slots, deck: Mini.
