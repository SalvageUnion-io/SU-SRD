# The Primitives Ruleset — Salvage Union Design System

Canon for every primitive and surface: a component contradicting a rule is wrong; [the origin](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm) outranks it. Gates: [hard-rules.md](hard-rules.md).

## The source: the Workshop Manual

1. **The book is the visual source of truth** — paper pages, colour only in bands, ink banners, framed numbers.
2. **Chapter band** — a band in the section colour across a page, the title notched in on a paper cut-out, in ink. The foot band is text, never chips: citations on one line, book first, each by its one short name, linked to its page, a bold `//` between, no kind, cut out top right in its body's ground; a Page's is its one footer, app links under it.
3. **Ink stamp + framed numeral** — the stat column (`STRUCTURE POINTS | 14`), label 14px, stat order (§2.6), four a row on a Page, two on a phone (R68); full words on a Page, short labels smaller (prose: Tech Level).
4. **The ink banner** — tier numeral, title, cost pennant, metadata on ink with a rounded tail; on screen, the card's ink header.
5. **"ROLL THE DIE:" and "//" lines** — an underlined ink stamp over banded d20 tables; italic trait lines split by "//"; on screen, one chip group (E17).
6. **The book's colour map** — rules blue `--color-wk-line`: Home, rules, Salvaging, Guides, Keywords. `--color-pilot`: Classes, Abilities, Equipment, pilots. `--color-mech`: Chassis, Systems, Modules, mechs.
   `--color-crawler`: Crawlers, Bays, Crawler TLs, crawlers. `--color-denizen-band`: Bio-Titans, Creatures, NPCs, Squads (cards: adversary brown). Off-book: `build`/`play`; `--color-discord` (the Discord page, a Game's people).
7. **Deliberate departures** — generated, placed texture (§3.5); the ability-tree track stays a diagram; ability Compacts wear their tier; rounding only where the book rounds; a phone's plain vitals (§2.1).

## The laws

0. **§0 The one law: one kind × one context = one primitive** — geometry is constant; materials, density and interactivity change. A new screen, size or theme reuses the primitive with props, never a sibling.
1. **§1 The context laws** — every surface is one of seven contexts, which pick materials and interactivity, never the primitive. Automation: `auto` (applied + undo), `confirm` (player confirms + undo), `free` (unguarded, logged override).
   1. **Reference — the book, verbatim** — paper, read-only, no play state: if the printed manual cannot show it, it cannot appear. The only rust is an inline link, the Page's Build With This (E20) and the front door's (§1.8).
   2. **Live Sheet — the pencil** — `free`; a right sidebar holds what the unit carries. Read is typeset (empties omitted unless fillable) and steps session state (vitals, Uses, condition). Edit holds build state: dashed fields, counts and overrides, dashed-ringed and logged; rules show, never gate. Its masthead is a `Strip`; on a phone its vitals pin over the stacked groups.
   3. **Play — the instrument panel** — its lists are Minis; the only transactional surface: bookkeeping `auto`, destruction `confirm`; each mutation logs a Change Log row, each roll a Game log row.
      Its ground wears the phase's band (`PHASE_TONE`). On a phone: tabs under pinned vitals (ADR-051 §10).
   4. **Use opens the action** — in Play an on-hand action's Mini carries a rust Use after its cost, which resolves it in place (ADR-051 §6). A sheet lists no actions.
   5. **Compact — one entity, one click** — `<Entity size="compact">`, an entity in a list at level 1 (E6): one-row head, chip group (E17); nothing edits or expands in place. Forms: [EDL](entity-display-language.md).
   6. **Peek — the glance** — a Compact contentful (`PeekCard`) on a lifted plate, opened from a `data-peek` Mention or Tag by one `PeekHost` per app; terminal (E16).
   7. **Page — the entity's own route** — the Description first, plain; a chassis's stats as tiles, every other's on the band (E20); then rules, the art in a side column (EDL Forms 5).
      The body starts under the band; level-1 blocks sit 12px apart; nothing is centred in spare height.
   8. **Front door — the cover** — `/`, and `/build/` and `/games/` signed out, sell the product in the site's own dress: one rust action, one outline beside it; Leyline Press credited by name, one ink link to buy the game; no price, banner or pop-up.
   9. **Manage — the owner's desk** — Training Bay, Play hub, a Game, invites: paper under the area's band, level 0, Slab sections, Compacts that link.
      No stepper or in-place edit; acts are Buttons in a chip group or under a Slab, destruction `confirm`. Rust is the role's door (Play, Mediate); a make (+ New) is rust only where there is no door (§3.13); Open and filters are ink.
   10. **Two measures** — Reference and Manage sit on `--page-measure` (a band title's words on it); a Live Sheet and Play fill the window. A phone page's first content is on its first screen.
2. **§2 The rendering matrix** — one primitive per role on every surface; the surface picks its skin.
   1. **Vitals** — `VitalGauge`; a `Stat` in listings. TP is a counter, no gauge. Below 40rem a pinned vital is the plain row (`PhoneVitals`): a slim meter, the value large, − and + at the Full Size; no stamp, pip track or texture.
   2. **Caps and slots** — `Stat`; an override is a dashed, logged control.
   3. **Condition** — `StatusBadge`: a tri-state control, a glyph in listings, absent from Reference.
   4. **Rolls** — `RollTableInstrument` (R8): the result a readout plus a marked row (§3.4); Reference toasts it.
   5. **Cargo** — `SlotGrid`; Reference shows the cap only.
   6. **Stat order** — one everywhere; a form drops stats, never moves them: TL, Slots, SV · SP or HP, EP, Bio · SYS, MODS, Heat, Cargo; Upkeep, Upgrade · action type, RNG (Page `Close`, else `C`), DMG · traits A–Z, Uses last · cost, the book's pointy box (`2 EP`), the last read chip; action slots follow it (C8). A Ledger's columns keep it; none is `—` (L5).
3. **§3 Cross-cutting laws**
   1. **§3.1 Rust = action, only action** — painted only by `Button` / `buttonVariants` and `InlineRef`, never aliased; destruction is rust behind `ConfirmDialog`; no state colour fills a button. Use is always rust (§1.4). Focus, selection and chrome accents are ink.
   2. **§3.2 Stamps label · slabs section · tags cite** — a section head is a Slab (R1), a related thing a relation chip (C11).
   3. **§3.3 State is a treatment, not a hue** — strike / X / redline ride on the ontology hue; `status-bad` is the one damaged / redline / over-cap colour. Damaged dulls a band toward grey, Destroyed greys it; a Peek wears its trigger's band.
   4. **§3.4 Roll-tier colours are Discord-bot-only** — the web marks every outcome alike.
   5. **§3.5 No gradient shading; closed colour set** — no colour outside §4; hard-stop patterns on §4 tokens are fine, smooth interpolation is not.
      1. **Texture: the light speckle** — ink speckle on colour bands and tone headers, paper flecks on ink headers and unit stamps (R10).
      2. **One shading exemption** — `.su-pilot-panel` on `/about`; no precedent.
   6. **§3.6 Copy is 1:1 with SRD data** — a name it prints is a Mention (E4): a trait's name alone, a table's with "Table".
   7. **§3.7 Stats render through Stat** — any `label | value` is a `Stat` (a list of them `Facts`), a text value too, never hand markup; a sentence says the number in words. Game data renders through the shared primitives.
   8. **§3.8 Ink on colour** — ink text on pilot and mech; no pair under 4.5 : 1. Paper on crawler uses `--color-crawler-band`, as on Denizens brown and NPC navy; TL blue is never a text ground, bar systems and modules.
   9. **§3.9 Canon is solid; homebrew is dashed** — a player-made thing that could pass for canon (pattern, NPC): a solid frame, the dashed HOMEBREW stamp, "Made by [user]", at every size. Dashed is otherwise only a Play reference unit (ADR-051 §5), an edit field and an empty slot; a Slab is always solid.
      A sheet adds a hatched band; a pattern's page is the book's, footed "Homebrew // Made by [user]". One `userMade` flag (+ `madeBy`); canon-built units stay solid.
   10. **§3.10 No left-rail borders** — colour rides in bands, stamps and gauges; nesting shows by containment.
   11. **§3.11 One union, two tools** — one Union bar; its tabs read Reference | Training Bay | Games (ADR-066), no second nav; the areas name their pages; bar and footer wear the leading band's colour (no band: the area's), no rule under the bar, no off-site arrows.
   12. **§3.12 Microcopy** — sentence case; game terms keep the book's casing ("End Downtime"), as do Game, Shelf and the roles ([glossary](../architecture/glossary.md)).
       Verbs: Copy, Move, Delete, Break down; Scrap is the currency, never the verb (p.248). Caps only through the stamp, `Button` and `capsLabel`; 11px caps are snug.
   13. **§3.13 The emphasis ladder** — rust is what you came to do: a region's one door (Play, Build With This, a step's Next) and every Use; then ink fill, outline, ghost. + New is rust only where its region has no door. On a band a rust button wears an ink keyline, any other is outlined: a read stamp and a button never share a look on one line (a Ledger's sorting stamp, L2, apart).
4. **§4 Foundations** — tokens, one home: `apps/web/src/styles/theme.css`.
   1. **§4.1 Colour roles** — values in `theme.css` alone. `--color-paper` is the one light surface, `--color-wk-bg` the page ground, `--color-band-cream` the one cream.
      The ink ramp is warm ink at opacity, never a grey; rules blue is a band, never a ground.
   2. **§4.2 The tracking ladder** — tokens only (`--tracking-*`): tight the label default, snug at the 11px floor, caps for chips, wide for header stamps, eyebrow the brand caption.
   3. **§4.3 The border map** — 3px `--bw-entity` full card, 2px `--bw-entity-compact` (contentful below Full, `Box`), 1.5px `--bw-chrome` controls, 1px `--bw-hairline` value cells, table rules, sheet Identity/Vitals. A Compact, Mini or Box is inked only with content under its head.
   4. **§4.4 Radius and spacing** — entity frames and stamps are square; all else that frames or floats is 3px, `calc(3px − frame)` inside; only the ink-banner tail is rounder.
      Spacing inside a block is `{2, 4, 6, 8, 12}px`, 12px the card gutter; between blocks, 16 or 24px. No literal where a token exists; a fit that is no spacing carries `design-tokens-ignore(<rule-id>)` and its reason.
   5. **§4.5 The pip-row split** — at most 6 a row, bottom-heavy (7 → 3/4, 13 → 4/4/5); the redline pip at 70%.
   6. **§4.6 The floors: type and touch** — nothing under 11px as seen. Touch takes a bigger Size, never a hidden hit area; nothing floats over content.
   7. **§4.7 The Sizes and sibling height** — Full 44px, Compact 32px, Mini 18px (`--size-*`), every button and chip, every screen.
      A line's controls share one Size. A Button beside Tabs is their Size.
   8. **§4.8 The type ladder** — every font size is a `--text-*` rung: badge 11, chip 12, caption 13, body 14, lede 16, readout 17, title 22, display 31, hero 38, chapter 64; no other size, alias or literal (a link preview's own, K12). Rungs are rem: the reader's text size scales them.
   9. **§4.9 Rank rides the container** — band, then Slab, then frame, then Mini, a Slab's 14px stamp may sit over 22px titles; never enlarge a stamp for rank.
5. **§5 The irreducible set** — 12 atoms and one technique.
   1. **Stamp** — ink block, paper text: `Badge shape="stamp"`. 2. **Frame** — `Box`, `TitledBox` (cut-out); a note is a `Callout`. 3. **Badge** — the stamp-chip family.
   4. **Well** — labelled value: `Stat`, label first (steppers when edited). 5. **Gauge** — segmented current/max: `VitalGauge`. 6. **Btn** — the only mutator: `Button`.
   7. **Slab** — solid section stamp + leader rule, every section head. 8. **RollTable** — banded d20 map: `RollTableInstrument`. 9. **Condition** — tri-state glyph: `StatusBadge`.
   10. **SlotGrid** — dashed addressable cargo cells. 11. **Icons** — `currentColor` `lucide-react` and local glyphs at the line's Size, stroke 2 (K11). 12. **Ledger** — a compared list's framed table: `Ledger` ([ledger.md](ledger.md)). The technique: StampSeam (§7.2), `STAMP_SEAM`.
   - **Actions nest** — no tray: an action is a contentful Mini (N3) showing its effect alone, under an Actions Slab on a Page, grouped by type in Play, never on a sheet (R65).
   - **Nesting** — children stack in the parent's frame under their own titles, one tone each (E6); a child hides prose its parent shows.
   - **No titled box inside an entity** (N5) — a non-entity block in an entity is a Slab if a section (When Damaged), an unlabelled Callout if a note; an SRD Page's level-1 block may stay a TitledBox.
   - **A container of entities is untitled** (N6) — a wizard step is its title and content; a dialog's head is its chrome (level 0).
6. **§6 The merge map** — merge any primitive that does not serve a different reader intent.
   1. **Badge** — every stamp-chip, the StatusBadge shell too. The cost's pointed box, `ActivationCost`, is the one standout.
   2. **Stat** — every labelled value, read or edited, text too (no hand `dl`); edit is a state, its one stepper.
   3. **Gauge** — every vital and pip track; a darker room is a skin.
   4. **Section** — `SlabSection` (R1).
   5. **Button** — `Button href` is every link drawn as a button (R16, K11).
   6. **Item** — a carried thing is a Mini in `SheetItemLine`; one pick dialog (`PickDialog`), one chip-well editor.
   7. **Must not merge** — Btn (do vs read), SlotGrid (places, not quantity), the condition glyph, RollTable; band ≠ rider.
7. **§7 Two inviolable laws**
   1. **§7.1 The value-cell law** — a label+value cell is ink on paper in a 1px ink frame on every side (a Page's stat tile: band paint) (a paper rule on ink, the state colour under a state), never a fill. A lone-label badge is frameless. Exempt: a Ledger cell (L5), a plain vital (§2.1).
   2. **§7.2 The StampSeam law** — a border-riding stamp centres on the line by its own height (within 1px), never a fixed margin. It rides wells, callouts and Peek titles (not a bare guide Note); never a Slab leader, flush header or entity frame.
