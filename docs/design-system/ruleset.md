# The Primitives Ruleset — Salvage Union Design System

Canon for every primitive and surface: a component that contradicts a rule is wrong. [The origin](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm) outranks this file, which is amended to match it.
Every law names the gate that holds it: [hard-rules.md](hard-rules.md).

## The source: the Workshop Manual

1. **The book is the visual source of truth** — paper pages, colour only in bands, ink banners, framed numbers.
2. **Chapter band** — a band in the section colour across a paper page, the title notched in on a paper cut-out, in ink. The foot band is text, never chips: citations on one line, Workshop Manual first, `//` between (`Workshop Manual · p.65 // Starter Set · p.37`), no kind, the source cut out top right; a Page's is its one footer, the app's links under it.
3. **Ink stamp + framed numeral** — the stat column (`STRUCTURE POINTS | 14`), label 14px, stat order (§2.6), two a row (SP | EP; lone cells span), full words on a Page, short labels smaller (prose: Tech Level).
4. **The ink banner** — tier numeral, title, cost pennant, metadata on ink with a rounded tail; on screen, the card's ink header.
5. **"ROLL THE DIE:" and "//" lines** — an underlined ink stamp over banded d20 tables; italic trait lines split by "//"; on screen, one chip group (E17).
6. **The book's colour map** — rules blue `--color-wk-line`: Home, rules, Salvaging, Guides, Keywords. `--color-pilot`: Classes, Abilities, Equipment, pilots. `--color-mech`: Chassis, Systems, Modules, mechs.
   `--color-crawler`: Crawlers, Bays, Crawler TLs, crawlers. `--color-denizen-band`: Bio-Titans, Creatures, NPCs, Squads (cards: adversary brown). Off-book: `build`/`play`; `--color-discord` (the Discord page, a Game's people).
7. **Deliberate departures** — generated, placed texture (§3.5); the ability-tree track stays a diagram (§3.10); ability Compacts wear their tier (E12); rounding only where the book rounds (§4.4).

## The laws

0. **§0 The one law: one kind × one context = one primitive** — geometry is constant; materials, density and interactivity change. A new screen, size or theme reuses the primitive with props, never a sibling.
1. **§1 The context laws** — every surface is one of six contexts, which pick materials and interactivity, never the primitive. Automation: `auto` (applied + undo), `confirm` (player confirms + undo), `free` (unguarded, logged override).
   1. **Reference — the book, verbatim** — paper, read-only, no play state: if the printed manual cannot show it, it cannot appear. The only rust is an inline link and the Page's Build With This (E20).
   2. **Live Sheet — the pencil** — `free`; a right sidebar holds what the unit carries; Read is typeset (empties omitted unless fillable); dashed fields and steppers are Edit's. Overrides wear a dashed ring and are logged; rules show, never gate.
   3. **Play — the instrument panel** — its lists are Minis; the only transactional surface: bookkeeping `auto`, destruction `confirm`; each mutation logs a Change Log row, each roll a Game log row.
      The page ground, bar and foot wear the phase's band (`PHASE_TONE`), title cut out, each column paper on the ink-40 hairline (§4.3). On a phone: tabs under pinned vitals (ADR-051 §10).
   4. **Use opens the action** — in Play an on-hand action's Mini carries Use after its cost, which resolves it in place as its contentful body (ADR-051 §6); the cost stays a read pennant.
   5. **Compact — one entity, one click** — `<Entity size="compact">`, an entity in a list at level 1 (E6): one-row head, chip group (E17); nothing edits or expands in place.
   6. **Peek — the glance** — a Compact contentful (`PeekCard`) on a lifted plate, opened from a `data-peek` Mention or Tag by one `PeekHost` per app. Terminal: no buttons, links (but its name's), nested Peeks or steppers (E16, E19).
   7. **Page — the entity's own route** — on desktop the hero floats, the body flowing round it, then full width.
      The body starts under the band; short, it spreads down the height; level-1 blocks sit 12px apart.
   8. **Entity forms** — Mention, the Sizes and Page: [entity-display-language.md](entity-display-language.md).
   9. **Manage — the owner's desk** — Training Bay, Play hub, a Game, invites: paper under the area's band, level 0, Slab sections, Compacts that link.
      No stepper or in-place edit; acts are Buttons in a chip group or under a Slab, destruction `confirm`. Rust is a door into play or a make (Play, Mediate, New Game); Open and filters are ink.
2. **§2 The rendering matrix** — one primitive per role on every surface; the surface picks its skin.
   1. **Vitals** — `VitalGauge`; a `Stat` in listings. TP is a counter, no gauge.
   2. **Caps and slots** — `Stat`; an override is a dashed, logged control.
   3. **Condition** — `StatusBadge`: a tri-state control (Destroyed greys the card), a glyph in listings, absent from Reference.
   4. **Rolls** — `RollTableInstrument` (E14): the result a readout plus a marked row (§3.4); Reference toasts it.
   5. **Cargo** — `SlotGrid`; Reference shows the cap only.
   6. **Stat order** — one everywhere; a form drops stats, never moves them: TL, Slots, SV · SP or HP, EP, Bio · SYS, MODS, Heat, Cargo; Upkeep, Upgrade · action type, RNG (Page `Close`, else `C`), DMG · traits A–Z, Uses last · cost, the book's pointy box (`2 EP`), the last read chip; action slots follow it (C8).
   7. **Entity card** — Full contentful is canonical (§1.8).
3. **§3 Cross-cutting laws**
   1. **§3.1 Rust = action, only action** — painted only by `Button` / `buttonVariants` and `InlineRef`, never aliased; destruction is rust behind `ConfirmDialog`; no state colour fills a button. Focus, selection and chrome accents are ink.
   2. **§3.2 Stamps label · slabs section · tags cite** — a section head is a Slab (R1), a related thing a relation chip (C11).
   3. **§3.3 State is a treatment, not a hue** — strike / X / redline ride on the ontology hue; `status-bad` is the one damaged / redline / over-cap colour.
   4. **§3.4 Roll-tier colours are Discord-bot-only** — the web marks every outcome alike; the bot's are warm (brick, ember, ochre, olive, slate).
   5. **§3.5 No gradient shading; closed colour set** — no colour outside §4; hard-stop patterns on §4 tokens are fine, smooth interpolation is not (half-fills and X's are `clip-path` + SVG).
      1. **Texture: the light speckle** — ink speckle on colour bands and tone headers, paper flecks on ink headers and unit stamps; never on paper, cream, the page ground, buttons or fields.
      2. **One shading exemption** — `.su-pilot-panel` on `/about`; no precedent.
   6. **§3.6 Copy is 1:1 with SRD data.**
   7. **§3.7 Stats render through Stat** — any `label | value` is a `Stat`; game data renders through the shared primitives, never one-off markup.
   8. **§3.8 Ink on colour** — ink text on pilot and mech; no pair under 4.5 : 1. Paper on crawler uses `--color-crawler-band`, as on Denizens brown and NPC navy; TL blue is never a text ground, bar systems and modules (book pp. 162, 188).
   9. **§3.9 Canon is solid; homebrew is dashed** — a player-made thing that could pass for canon (pattern, NPC): a solid frame, the dashed HOMEBREW stamp, "Made by [user]", at every size. Dashed is otherwise only a Play reference unit (ADR-051 §5), an edit field and an empty slot; a Slab is always solid.
      A sheet adds a hatched band; a pattern's page is the book's, footed "Homebrew // Made by [user]". One `userMade` flag (+ `madeBy`); canon-built units stay solid.
   10. **§3.10 No left-rail borders** — colour rides in top bands, stamps and gauges; nesting shows by containment.
   11. **§3.11 One union, two tools** — one Union bar; the switcher reads Reference | Build | Play; Build (the Training Bay) and Play (the Cantina) name their pages; bar and footer wear the leading band's colour (no band: the area's), no rule under the bar, no off-site arrows.
       Each mode has its nav (Build: Training Bay, Patterns, Starter Set; Play: Games ▾, Solo), the current one in ink from first paint.
   12. **§3.12 Microcopy** — sentence case; game terms keep the book's casing ("End Downtime"), as do Game, Shelf and the roles ([glossary](../architecture/glossary.md)).
       Caps only through the stamp and `Button`. Verbs: Copy, Move, Delete, Break down; Scrap is the currency, never the verb (p.248).
4. **§4 Foundations** — tokens, one home: `apps/web/src/styles/theme.css`.
   1. **§4.1 Colour roles** — values in `theme.css` alone. `--color-paper` is the one light surface, `--color-wk-bg` the page ground (the cool `-2` is off-palette), `--color-band-cream` the one cream.
      The ink ramp is warm ink at opacity, never a grey; rules blue is a band, never a ground.
   2. **§4.2 The tracking ladder** — tokens only: `--tracking-caps-tight` (0.04em) the label default, `-snug` at the 11px floor, `--tracking-caps` chips, `-wide` header stamps, `--tracking-eyebrow` brand caption.
   3. **§4.3 The border map** — 3px `--bw-entity` full card, 2px `--bw-entity-compact` (contentful below Full, `Box`), 1.5px `--bw-chrome` controls, 1px `--bw-hairline` value cells, table rules, sheet Identity/Vitals. A Compact, Mini or Box is inked only with content under its head.
      Entity frames are `--color-ink-40`; only ability trees and patterns take a colour (`--su-compact-frame`); a non-entity box, its band's (R51).
   4. **§4.4 Radius and spacing** — entity frames and stamps are square; all else that frames or floats is 3px, `calc(3px − frame)` inside; only the ink-banner tail is rounder.
      Spacing inside a block is `{2, 4, 6, 8, 12}px`, 12px the card gutter; between blocks, 16 or 24px. No literal where a token exists.
   5. **§4.5 The pip-row split** — at most 6 a row, bottom-heavy (7 → 3/4, 13 → 4/4/5); the redline pip at 70%.
   6. **§4.6 The floors: type and touch** — nothing under 11px as seen (a 1200px link preview: 34px). Coarse-pointer targets are 44px, menu items too; nothing floats over content.
   7. **§4.7 The Sizes and sibling height** — Full 44px, Compact 32px, Mini 18px (`--size-*`; touch lifts Compact to Full, Mini a 44px hit area).
      A line's controls share one Size; chip values match labels, one gap apart, filled as C2b. A Button beside Tabs is their Size.
5. **§5 The irreducible set** — an ontology, not a roster: 11 atoms and one technique.
   1. **Stamp** — ink block, paper text: `Badge shape="stamp"`. 2. **Frame** — `Box`, `TitledBox` (cut-out); a note is a `Callout`. 3. **Badge** — the stamp-chip family.
   4. **Well** — labelled value: `Stat`, label first (steppers when edited). 5. **Gauge** — segmented current/max: `VitalGauge`. 6. **Btn** — the only mutator: `Button`.
   7. **Slab** — solid section stamp + leader rule, every section head. 8. **RollTable** — banded d20 map: `RollTableInstrument`. 9. **Condition** — tri-state glyph: `StatusBadge`.
   10. **SlotGrid** — dashed addressable cargo cells. 11. **Icons** — `currentColor` `lucide-react` and local glyphs at the line's Size, stroke 2 (K11). The technique: StampSeam (§7.2), `STAMP_SEAM`.
   - **The entity card: one anatomy, two header fills** — flush header (title, labels right of it, chip group: E9, E17), body only if prose or children remain, foot; tone header for things you have, ink banner for things you do (E12).
   - **Actions nest** — no tray: on a Page, Compact contentful under an Actions slab; in a card or Peek, contentful Minis (N3), never folded.
   - **Nesting** — children stack in the parent's frame under their own titles, one tone each, three levels (E6); a child hides prose its parent shows.
   - **No titled box inside an entity** (N5) — a non-entity block in an entity is a Slab if a section (When Damaged), an unlabelled Callout if a note; an SRD Page's level-1 block may stay a TitledBox.
   - **A container of entities is untitled** (N6) — a wizard step is its title and content; a dialog's head is its chrome (level 0).
6. **§6 The merge map** — merge any primitive that does not serve a different reader intent.
   1. **Badge** — every stamp-chip, the StatusBadge shell too. The cost's pointed box, `ActivationCost`, is the one standout.
   2. **Stat** — every labelled value, read or edited, text too (no hand `dl`); edit is a state, its one stepper.
   3. **Gauge** — every vital and pip track; a darker room is a skin.
   4. **Section** — `SlabSection`: a Slab, one gap, its body; fold and count are props.
   5. **Button** — `Button href` is every link drawn as a button; Back and Next are `BackLabel` / `NextLabel`.
   6. **Item** — a carried thing is a Mini in `SheetItemLine`; one pick dialog (`PickDialog`), one chip-well editor.
   7. **Must not merge** — Btn (do vs read), SlotGrid (places, not quantity), the condition glyph, RollTable; band ≠ rider.
7. **§7 Two inviolable laws**
   1. **§7.1 The value-cell law** — a label+value cell is ink on paper in a 1px ink frame, never a fill. A lone-label badge is frameless.
   2. **§7.2 The StampSeam law** — a border-riding stamp centres on the line by its own height, never a fixed margin. It rides wells, callouts and Peek titles; never a Slab leader, flush header or entity frame.
8. **§8 Chrome** — [chrome.md](chrome.md)'s K rules.
