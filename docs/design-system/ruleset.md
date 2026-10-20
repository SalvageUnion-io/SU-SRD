# The Primitives Ruleset — Salvage Union Design System

Canon for every primitive and surface: if a component contradicts a rule, the component is wrong. [The origin](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm) (board index: [sources.md](sources.md)) outranks this file, which is amended to match it.
The gate that holds each law, or will: [hard-rules.md](hard-rules.md).

## The source: the Workshop Manual

1. **The book is the visual source of truth** — paper pages, colour only in bands, ink banners, framed numbers.
2. **Chapter band** — a band in the section colour across a paper page, the title notched in on a paper cut-out, in ink. The foot band, in the band's colour, is text, never chips: the citations on one line, Workshop Manual first, `//` between (`Workshop Manual · p.65 // Starter Set · p.37`); no kind, no ink rule; the source on its own cut-out, top right. A Page's is its one footer, the app's links under the source; a card's or Peek's stands alone.
3. **Ink stamp + framed numeral** — the stat column (`STRUCTURE POINTS | 14`), label 14px, horizontal, in the stat order (§2.6), two a row, paired in a group (SP | EP; lone cells span), full words on a Page (never "PTS." or "CAP."); smaller forms the short label (SP, TL), TL a label only (prose: Tech Level).
4. **The ink banner** — tier numeral, title, cost pennant, "//" metadata on ink with a rounded tail; on screen, the card's ink header (§5).
5. **"ROLL THE DIE:" and "//" lines** — an underlined ink stamp over banded d20 tables; italic trait lines split by "//" (`Turn Action // Range: Close`); on screen one chip group in the head (E17).
6. **The book's colour map** — which chapter band a page wears:
   - **Rules · Salvaging**, rules blue `--color-wk-line`: Home, Core Rules, Salvaging, Guides, Keywords.
   - **Pilot Bay**, `--color-pilot`: Classes, Abilities, Equipment, app pilots. **Mech Workshop**, `--color-mech`: Chassis, Systems, Modules, app mechs.
   - **Union Crawler**, `--color-crawler`: Crawlers, Bays, Crawler TLs, app crawlers. **Denizens**, `--color-denizen-band`: Bio-Titans, Creatures, NPCs, Squads (cards: adversary brown).
   - Off-book: `build`/`play` bands; Home's Discord button `--color-discord`.
7. **Deliberate departures** — generated, placed texture (§3.5); the ability-tree track stays a diagram (§3.10); ability Compacts wear their tier (E12); rounding only where the book rounds (§4.4).

## The laws

0. **§0 The one law: one kind × one context = one primitive** — geometry is constant; only materials, density and interactivity change. A new screen, size or theme reuses the primitive with props, never a sibling.
1. **§1 The context laws** — every surface is one of six contexts; the context picks materials and interactivity, never the primitive. Automation: `auto` (applied + undo), `confirm` (player confirms + undo), `free` (unguarded, logged override).
   1. **Reference — the book, verbatim** — paper, read-only, no play state: if the printed manual cannot show it, it cannot appear. The only rust is an inline link and the Page's Build With This (E20).
   2. **Live Sheet — the pencil** — `free`; a permanent right sidebar holds what the unit carries (equipment, storage, cargo); print reads, pencil writes: Read is typeset (empty fields and sections omitted, an empty state only where it can be filled); dashed fields and steppers are Edit's. Overrides wear a dashed ring and are logged; rules show, never gate.
   3. **Play — the instrument panel** — its lists are Minis (actions, crew, tables); the only transactional surface: bookkeeping `auto`, destruction `confirm`; every unit mutation writes a Change Log row, every roll a Game log row.
      A page like the sheets: the page ground, bar and foot the phase's band (`PHASE_TONE`), title cut out, each column paper on the ink-40 hairline (§4.3). On a phone: tabs under pinned vitals (ADR-051 §10).
   4. **Use opens the action** — in Play an on-hand action's Mini carries Use after its cost, which resolves it in place as the Mini's contentful body (Activate, Roll, Push, Apply; ADR-051 §6); its cost stays a read pennant.
   5. **Compact — one entity, one click** — `<Entity size="compact">` is the one rendering for an entity in a list (index, search, slot, deck) at level 1 (E6): one-row head (art window), chip group (E17).
      Nothing edits or expands in place; art by room (EDL E10).
   6. **Peek — the glance** — a Compact contentful (`PeekCard`) on a lifted plate, opened from a `data-peek` Mention or Tag by one `PeekHost` per app.
      Terminal: no buttons, links (but its name's, to its Page), nested Peeks or steppers; level 1 on its plate (EDL E6, E16, E19).
   7. **Page — the entity's own route** — on desktop the hero floats and the opening, stats, actions and nested cards flow around it, then run full width, flush with the column.
      The body starts under the band at any length (a short page is never centred); level-1 blocks sit one 12px gap apart.
   8. **Entity forms** — Mention, the Sizes and Page, their modes and rules E1–E20: [entity-display-language.md](entity-display-language.md).
   9. **Manage — the owner's desk** — the Training Bay, the Play hub, a Game's page, the invite screen: paper under the area's band (Build `build`, Play `play`), level 0, Slab sections, Compacts that link (a Game, seat or proposal too).
      No stepper or in-place edit; acts are Buttons in a Compact's chip group or under a Slab, destruction `confirm`. Rust is a door into play or a make (Play, Mediate, New Game); Open and filters are ink.
2. **§2 The rendering matrix** — each role maps to one primitive per surface (Reference → Live Sheet → Play → Compact → Peek).
   1. **Vitals** — `VitalGauge`: sheet skin, Play's compact instrument, compact in the Peek; a `Stat` cell in listings. TP is a counter (no cap, no gauge).
   2. **Caps and slots** — `Stat`, the printed number; an override is a dashed, logged control.
   3. **Condition** — tri-state toggle (Destroyed greys the card), a static glyph in listings, absent from Reference.
   4. **Rolls** — `RollTableInstrument` under ROLL THE DIE:, the stamp the one roll button (no second Roll; a plain label in static HTML); the result is a readout plus a marked row (§3.4); Reference toasts it; Peek aside.
   5. **Cargo** — `SlotGrid` (dashed empty, solid filled); Reference shows the cap only.
   6. **Stat order** — one everywhere; a form drops stats, never moves them: TL, Slots, SV · SP or HP, EP, Bio · SYS, MODS, Heat, Cargo; Upkeep, Upgrade · action type ("Turn Action"), RNG (Page `Close`, else `C`), DMG · traits A–Z, Uses last · cost, the book's pointy box (`2 EP`; §1.4), the last read chip; action slots follow it (C8).
   7. **Entity card** — Full contentful is THE canonical render; a list's the Compact, a Peek's Compact contentful (§1).
3. **§3 Cross-cutting laws**
   1. **§3.1 Rust = action, only action** — `--color-rust` is painted only by `Button` / `buttonVariants` and `InlineRef`, and no token aliases it. A destructive action is rust too, behind `ConfirmDialog`: no state colour fills a button.
      Focus and selection rings, "you are here" and chrome accents are ink.
   2. **§3.2 Stamps label · slabs section · tags cite** — never trade jobs.
   3. **§3.3 State is a treatment, not a hue** — strike / X / redline ride on the ontology hue; `status-bad` is the one damaged / redline / over-cap colour.
   4. **§3.4 Roll-tier colours are Discord-bot-only** — the web shows a readout and a row mark that is the same for every outcome. The bot's tiers are warm (brick, ember, ochre, olive, slate).
   5. **§3.5 No gradient shading; closed colour set** — no colour outside §4; hard-stop patterns on §4 tokens are fine, smooth interpolation is not (half-fills and X's are `clip-path` + SVG).
      Each sanctioned pattern (the user-made hatch) is in `EXEMPTIONS` (`packages/gates/rules/designTokens.ts`).
      1. **Texture: the light speckle** — on every brand-colour ground, the Cockpit and Peek too: ink speckle on colour bands and tone headers; paper flecks on dark and ink headers and unit stamps.
         Never on paper, cream, the page ground, buttons or fields.
      2. **One shading exemption** — the `.su-pilot-panel` illustration on srd's `/about`. A one-off, not precedent.
   6. **§3.6 Copy is 1:1 with SRD data.**
   7. **§3.7 Stats render through Stat** — any `label | value` is a `Stat`, never hand-assembled `<span>SP {n}</span>`.
      Game data renders through the shared primitives, never one-off markup.
   8. **§3.8 Ink on colour** — ink text on pilot and mech fills; no text pair under 4.5 : 1. Paper text on crawler uses `--color-crawler-band`; Denizens navy carries paper; TL blue is never a text ground, bar systems and modules (book pp. 162, 188).
   9. **§3.9 Canon is solid; homebrew is dashed** — a player-made thing that could pass for the book (pattern, NPC): a solid frame like the book's, the dashed HOMEBREW stamp in its labels or chips and pills, credit "Made by [user]", at every size. Dashed means only this, a Play reference unit (ADR-051 §5), an edit field and an empty slot: a Slab is always solid.
      A sheet adds a hatched band; a pattern's page is the book's, footed "Homebrew // Made by [user]". One `userMade` flag (+ `madeBy`); canon-built units stay solid.
   10. **§3.10 No left-rail borders** — colour rides in top bands, stamps and gauges; nesting shows by containment.
   11. **§3.11 One union, two tools** — one Union bar; the switcher reads Reference | Build | Play; Build (the Training Bay) and Play (the Cantina) name their pages; the bar and the footer wear the leading band's colour in every mode, front pages too (no band: the area's), with no rule between bar and page; no off-site arrows between the two.
       Each mode has its nav (Build: Training Bay, Patterns, Starter Set; Play: Games ▾, Solo), the current one in ink from first paint.
   12. **§3.12 Microcopy** — sentence case ("Make a copy"); game terms keep the book's casing ("End Downtime"), as do Game, Shelf and the roles ([glossary](../architecture/glossary.md)).
       Caps only through the stamp (`Badge shape="stamp"`) and `Button`, which sets every label in condensed caps. Verbs: Copy, Move, Delete, Break down; Scrap is the currency, never the verb (p.248).
4. **§4 Foundations** — the token layer, one home: `apps/web/src/styles/theme.css`.
   1. **§4.1 Colour roles** — values in `theme.css` alone, one spelling each. `--color-paper` is the one light surface, `--color-wk-bg` the page ground (the cool `-2` is off-palette on screen: tokens rule `cool-ground`), `--color-band-cream` the one cream.
      The ink ramp is warm ink at opacity, never a grey; rules blue is a band, never a ground.
   2. **§4.2 The tracking ladder** — tokens only: `--tracking-caps-tight` (0.04em) is the label default, `-snug` at the 11px floor, `--tracking-caps` chips, `-wide` header stamps, `--tracking-eyebrow` brand caption.
   3. **§4.3 The border map** — one meaning each: 3px `--bw-entity` full card, 2px `--bw-entity-compact` (contentful below Full, `Box`), 1.5px `--bw-chrome` controls, 1px `--bw-hairline` value cells, table rules, sheet Identity/Vitals. A Compact, Mini or Box is inked only with content under its head.
      Entity frames are `--color-ink-40`; only ability-tree Compacts and patterns take a colour (`--su-compact-frame`).
   4. **§4.4 Radius and spacing** — entity frames (every Size) and stamps are square; everything else that frames or floats (Btn, field, Box, dialog, popup, toast) is 3px, `calc(3px − frame)` inside; rounder only for the ink-banner tail.
      Spacing inside a block is `{2, 4, 6, 8, 12}px`, 12px the card gutter; between blocks, 16 or 24px. No literal where a token exists.
   5. **§4.5 The pip-row split** — at most 6 per row, balanced and bottom-heavy (7 → 3/4, 13 → 4/4/5), for every pip surface. The redline pip sits at 70%.
   6. **§4.6 The floors: type and touch** — nothing under 11px at the size the reader sees (a 1200px link preview: 34px), wizards included; the stat column label is 14px.
      Every coarse-pointer target is 44px, menu items included; nothing floats over content.
   7. **§4.7 The Sizes and sibling height** — the three Sizes are heights: Full 44px, Compact 32px, Mini 18px (`--size-*`; touch lifts Compact to Full, Mini takes a 44px hit area).
      A line's controls share one Size; chip values match labels, one gap apart, filled as C2b. A Button beside Tabs is their Size.
5. **§5 The irreducible set** — an ontology, not a roster: 11 atoms and one technique.
   1. **Stamp** — ink block, paper text: `Badge shape="stamp"`.
   2. **Frame** — `--bw-*` weights: `Box`, `TitledBox` (cut-out); a note is a `Callout`.
   3. **Badge** — the stamp-chip family: `Badge`.
   4. **Well** — labelled value: `Stat`, the label-first chip (steppers when edited); no square box.
   5. **Gauge** — segmented current/max: `VitalGauge`.
   6. **Btn** — rust action, the only mutator: `Button` / `buttonVariants`.
   7. **Slab** — solid section stamp + leader rule: `Slab`, every section head.
   8. **RollTable** — banded d20 map in the surface tone: `RollTableInstrument`.
   9. **Condition** — tri-state glyph: `StatusBadge`.
   10. **SlotGrid** — dashed addressable cargo cells: `SlotGrid`.
   11. **Icons** — `currentColor` glyphs: `lucide-react` plus local glyphs, at the line's Size, stroke 2 (chrome.md K11). The technique is StampSeam (§7.2): `STAMP_SEAM`.
   - **The entity card: one anatomy, two header fills** — a flush header: the title, its labels right of it (pills, HOMEBREW; never above it or riding the frame, E9), then its chip group (E17), body only if prose or children remain, foot. Tone header for things you have, ink banner for things you do (E12).
   - **Actions nest** — no Actions tray or stamp. On a Page, level 1: Compact contentful, ink banners, under an Actions slab. In a card or Peek, level 2: contentful Minis (N3), never folded behind a "Show N actions" chip. A roll table sits inline under a ROLL THE DIE: bar (nested: a Mini, E14).
   - **Nesting legibility** — nested entities stack in the parent's frame under their own titles, no tray or label naming their kind, one tone each. Three levels (N1, EDL E6), frames 3 → 2px; nothing titled at level 2 or deeper; one level deep is an open Compact (N8; R39's exception).
     A child hides prose its parent shows.
   - **No titled box inside an entity** (N5) — a non-entity block in an entity is a Slab over content if a section of the parent (When Damaged, Crawler Hold, Scrap Pool), an unlabelled Callout if a note; never a `TitledBox` or its variants. On an SRD Page a level-1 block may stay a TitledBox.
   - **A container of entities is untitled** (N6) — a wizard step is its title and content; the entities in it are the titled things. A dialog's head is its chrome (level 0).
6. **§6 The merge map** — merge any primitive that does not serve a different reader intent.
   1. **Badge** — every stamp-chip: tag, pill, range, action type, TL, the StatusBadge shell. The cost's pointed box is its own atom, `ActivationCost`: the one standout.
   2. **Stat** — every labelled value, read or edited, text values too (no hand `dl`): edit is a state, its one stepper.
   3. **Gauge** — every vital and pip track, Play's steppers too: a darker room is a skin.
   4. **Section** — `SlabSection`: a Slab, one gap, its body; the fold and count its props.
   5. **Button** — `Button href` is every link drawn as a button; Back and Next are `BackLabel` / `NextLabel`.
   6. **Item** — a carried thing, entity or not, is a Mini in `SheetItemLine`; one pick dialog (`PickDialog`), one chip-well editor.
   7. **Must not merge** — Btn (do vs read), SlotGrid (places, not quantity), the condition glyph, RollTable, and band ≠ rider.
7. **§7 Two inviolable laws**
   1. **§7.1 The value-cell law** — a label+value cell is ink on paper, set apart by a 1px ink frame, never a fill (never cream, white or tinted). A lone-label badge is frameless.
   2. **§7.2 The StampSeam law** — a border-riding stamp centres on the line by its own height, never a fixed margin. It rides wells, callouts and Peek titles; never the Slab leader, a flush header band, or an entity's frame (its labels sit right of its title).
8. **§8 Chrome** — [chrome.md](chrome.md) K1–K10.
