# The Primitives Ruleset — Salvage Union Design System

Canon for every primitive and surface: if a component contradicts a rule, the component is wrong. [The origin](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm) (the design board set; "board 05c" names one) outranks this file, which is amended to match it.

## The source: the Workshop Manual

1. **The book is the visual source of truth** — paper pages, colour only in bands, ink banners, framed numbers. When a screen and the book disagree, open the book.
2. **Chapter band** — a band in the section colour across a paper page, the title notched into it on a paper cut-out, in ink (never a white knockout). The foot band carries the citation.
3. **Framed numeral + ink stamp** — the stat column (`14 | STRUCTURE PTS.`), label 14px, horizontal, in the book's order: STRUCTURE PTS., ENERGY PTS., HEAT CAP., SYSTEM SLOTS, MODULE SLOTS, CARGO CAP., TECH LEVEL, SALVAGE VALUE.
4. **The ink banner** — tier numeral, title, cost pennant, "//" metadata on ink with a rounded tail; on screen, the entity card's ink header (§5).
5. **"ROLL THE DIE:" and "//" lines** — an underlined ink stamp over banded d20 tables; italic trait lines split by "//" (`Turn Action // Range: Close`); on screen a head stamp, facet Stats and trait Tags (E17).
6. **The book's colour map** — which chapter band a page wears:
   - **Rules · Salvaging**, rules blue `--color-wk-line`: Home, Core Rules, Salvaging, Guides, Keywords.
   - **Pilot Bay**, `--color-pilot`: Classes, Abilities, Equipment, ITUN pilots. **Mech Workshop**, `--color-mech`: Chassis, Systems, Modules, ITUN mechs.
   - **Union Crawler**, `--color-crawler`: Crawlers, Bays, Crawler TLs, ITUN crawlers. **Denizens**, `--color-denizen-band`: Bio-Titans, Creatures, NPCs, Squads (cards keep adversary brown).
   - **ITUN's Shelves** (not the book): ink, with paper flecks (§3.5).
7. **Deliberate departures** — no white knockout; generated, placed texture (§3.5); the ability-tree track stays a diagram (§3.10); rounding only where the book rounds (§4.4).

## The laws

0. **§0 The one law: one kind × one context = one primitive** — geometry is constant; only materials, density and interactivity change. A new screen, size or theme reuses the primitive with props, never a sibling.
1. **§1 The context laws** — every surface is one of five contexts; the context picks materials and interactivity, never the primitive. Automation: `auto` (applied + undo), `confirm` (player confirms + undo), `free` (unguarded, logged override).
   1. **Reference — the book, verbatim** — paper, read-only, no play state: if the printed manual cannot show it, it cannot appear. The only rust is an inline link.
   2. **Live Sheet — the pencil** — `free`; print reads, pencil writes: the read state is typeset (empty fields omitted), dashed fields and steppers only in edit. Overrides wear a dashed ring and are logged; rules show, never gate.
   3. **Dashboard — the instrument panel** — the only transactional surface: bookkeeping `auto`, destruction `confirm`; every unit mutation writes a Change Log row, every roll a Game log row. Flat: no texture.
      Paper instruments on a dark ground: `--color-ink-deep` ground, `--color-band-cream` for every card, `--color-paper` for the display region alone. On a phone: bar, tab body, resolve screen (ADR-045).
   4. **The cost pennant is the action** — on the Dashboard, tapping the pennant resolves the action: read-pennant size, filled rust, 44px hit area, no separate deck button.
   5. **Listing — one entity, one click** — the Row (`<Entity form="row">`) is the one rendering for an entity in a list (listing, search, slot, deck, depth 2): art column, one-row head, value cells then the facets row.
      Context changes props, never the anatomy; nothing edits or expands in place. Missing art wears a manual censor mark (`MissingArt`).
      Where the schema has art, the SRD listing's **Catalog** draws the same groups as art-first Tiles (`<Entity form="tile">`: art at 3:4 from the `-440` derivative, the name notched into the tone band in ink, compact value cells, the lead): the default at ≥ 75rem, the List below it, and a reader's List | Catalog choice is kept.
   6. **Peek — the glance** — the Card at compact density (`PeekCard`) on a lifted plate, opened from a `data-peek` Mention or Tag by one `PeekHost` per app.
      Terminal: no buttons, links, nested Peeks or steppers; children are Tokens, Mentions inert.
   7. **Page — the entity's own route** — on desktop the hero floats and the opening, stats, actions and trays flow around it, then run full width; trays sit flush with the column.
   8. **Entity forms** — Mention, Token, Row, Card, Page, their modes and rules E1–E17: [entity-display-language.md](entity-display-language.md). Card and Page are still `ReferenceEntityCard`.
2. **§2 The rendering matrix** — each role maps to one primitive per surface (Reference → Live Sheet → Dashboard → Listing → Peek); the `Foundations/Rendering Matrix` story shows it.
   1. **Vitals** — `VitalGauge`: sheet skin, Dashboard instrument, compact in the Peek; MiniStat in listings. TP is a counter (no cap, no gauge).
   2. **Caps and slots** — `Stat`, the printed number; an override is a dashed, logged control.
   3. **Condition** — tri-state toggle (Destroyed greys the card), a static glyph in listings, absent from Reference.
   4. **Rolls** — `RollTable` under ROLL THE DIE:; the result is a readout plus a marked row (§3.4); Roll is a rust Button outside Reference and the Peek.
   5. **Cargo** — `SlotGrid` (dashed empty, solid filled); Reference shows the cap only. TL and Salvage are the TL-Salvage badge everywhere.
   6. **Cost, range, action type** — cost pennant, range badge (never interactive), action-type stamp (the deck's filter key).
   7. **Entity card** — the full card is THE canonical render; Listing is the Row, the Peek a compact Card (§1); a section header is a Slab.
3. **§3 Cross-cutting laws**
   1. **§3.1 Rust = action, only action** — `--color-rust` is painted only by `Button` / `buttonVariants` (the cost pennant included) and `InlineRef`, and no token aliases it.
      Focus and selection rings, "you are here" and chrome accents are ink. Enforced by `tokens/rust-allowlist`.
   2. **§3.2 Stamps label · slabs section · tags cite** — never trade jobs.
   3. **§3.3 State is a treatment, not a hue** — strike / X / redline ride on the ontology hue; `status-bad` is the one damaged / redline / over-cap colour.
   4. **§3.4 Roll-tier colours are Discord-bot-only** — the web shows a readout and a row mark that is the same for every outcome. The bot's tiers are warm (brick, ember, ochre, olive, slate).
   5. **§3.5 No gradient shading; closed colour set** — no colour outside §4; hard-stop patterns on §4 tokens are fine, smooth interpolation is not (half-fills and X's are `clip-path` + SVG).
      Every sanctioned pattern (Slab leader, catalog tile ramps, user-made hatch) is in `EXEMPTIONS` in `tools/rules/designTokens.ts`.
      1. **Texture: the light speckle** — ink speckle on colour bands and tone headers; paper flecks on dark and ink headers and unit stamps.
         Never on paper, buttons, fields, the Dashboard or the Peek (`tokens/texture-placement`).
      2. **One shading exemption** — the `.pilot-panel` illustration on srd's `/about`. A ruled one-off, not precedent; anything else is a defect.
   6. **§3.6 Copy is 1:1 with real SRD data** — everywhere, catalog stories included.
   7. **§3.7 Stats render through Stat** — any `label | value` is a `Stat`, never hand-assembled `<span>SP {n}</span>`.
      Game data renders through the shared primitives, never one-off markup.
   8. **§3.8 Ink on colour** — ink text on pilot and mech fills; no text pair under 4.5 : 1. Paper text on crawler uses `--color-crawler-band`; Denizens navy carries paper; TL blue is never a text ground, bar the book's own: a system or module header wears its tech level's blue under the green Mech Workshop band, as the book heads each entry and index row (Core Book pp. 162–164, 188–190).
   9. **§3.9 Canon is solid; homebrew is dashed** — a player-made thing that could pass for the book (pattern, NPC): dashed frame, dashed User-made stamp in the head's labels, foot rule and pills, credit "Made by [user]", at every size.
      A full page adds a hard-stop hatched band, a dashed notch and a maker banner. One `userMade` flag (+ `madeBy`); canon-built units stay solid.
   10. **§3.10 No left-rail borders** — colour rides in top bands, stamps and gauges; nesting shows by containment and the type stamp.
   11. **§3.11 One union, two tools** — one Union bar; the switcher reads Reference | Build; ITUN is the product name, spelled out on its front door; no off-site arrows between the two.
4. **§4 Foundations** — the token layer, one home: `packages/component-lib/src/styles/theme.css`.
   1. **§4.1 Colour roles** — values in `theme.css` alone, one spelling each. `--color-paper` is the one light surface (pure white retired), `--color-wk-bg` the page ground (the cool `-2` is off-palette on screen: tokens rule `cool-ground`), `--color-band-cream` the one cream.
      The ink ramp is warm ink at opacity, never a grey; rules blue is a band, never a ground. `contrast.test.ts` pins every pair.
   2. **§4.2 The tracking ladder** — tokens only: `--tracking-caps-tight` (0.04em) is the label default, `-snug` at the 11px floor, `--tracking-caps` chips, `-wide` header stamps, `--tracking-eyebrow` brand caption.
   3. **§4.3 The border map** — one meaning per weight: 3px `--bw-entity` full card, 2px `--bw-entity-compact` (Card below large, and the Row), 1.5px `--bw-chrome` controls, 1px `--bw-hairline` value-cell frames and table rules.
   4. **§4.4 Radius and spacing** — 3px outer on cards and Btn, `calc(3px − frame)` inside, stamps square; rounder only for the ink-banner tail and Guides how-to cards. Spacing is `{2, 4, 6, 8, 12}px`; 12px is the card gutter.
   5. **§4.5 The pip-row split** — at most 6 per row, balanced and bottom-heavy (7 → 3/4, 13 → 4/4/5), for every pip surface. The redline pip sits at 70%.
   6. **§4.6 The floors: type and touch** — nothing under 11px at the size the reader sees (a 1200px link preview: 34px), wizards included; the stat column label is 14px.
      Every coarse-pointer target is 44px; nothing floats over content.
5. **§5 The irreducible set** — an ontology, not a roster (the barrel `packages/component-lib/src/index.ts` is the roster): 11 atoms and one technique.
   1. **Stamp** — ink block, paper text: `Badge shape="stamp"`.
   2. **Frame** — bordered container, `--bw-*` weights: `Card` / `Panel`.
   3. **Badge** — the stamp-chip family: `Badge`.
   4. **Well** — labelled value box: `Stat` (vertical).
   5. **Gauge** — segmented current/max: `VitalGauge`.
   6. **Btn** — rust action, the only mutator: `Button` / `buttonVariants`.
   7. **Slab** — section stamp + leader rule: `Slab`.
   8. **RollTable** — banded d20 map: `RollTable`.
   9. **ConditionSwatch** — tri-state glyph: `ConditionSwatch`.
   10. **SlotGrid** — dashed addressable cargo cells: `SlotGrid`.
   11. **Icons** — `currentColor` glyphs: `lucide-react` plus local glyphs. The technique is StampSeam (§7.2): `STAMP_SEAM`.
   - **The entity card: one anatomy, two header fills** — a flush header whose first line is its labels (type stamp, classification pills, User-made; in flow, never riding the frame), then the title left, value cells and action-type stamps right), the facets row (facet Stats then trait Tags, E17), body, foot. Tone header for things you have; ink banner for things you do, decided by data shape.
   - **Actions sit inline** — flush ink bands, no Actions tray or stamp (on a Page, framed cards under an Actions slab); a roll table sits inline under a ROLL THE DIE: bar.
   - **Nesting legibility** — nested entities sit in a page-colour tray under stamp-and-leader labels (no item counts: a section never tallies itself), one tone each; large → medium → a Row at depth 2 (frames 3 → 2 → 1.5px).
     A child hides prose its parent shows; below depth 1, actions collapse to "Show N actions".
6. **§6 The merge map** — merge any primitive that does not serve a different reader intent.
   1. **Badge** — folds ValueDisplay, Tag, Pill, Chip, cost pennant, Range, Action-type, TL and the StatusBadge shell.
   2. **Stat** — folds StatControl, inputs, InlineEditField and StatBlock pips: read vs edit is a state.
   3. **Gauge** — folds VitalGauge, DashboardGauge and pip tracks: a darker room is a skin.
   4. **Must not merge** — Btn (do vs read), SlotGrid (places, not quantity), ConditionSwatch, RollTable, and band ≠ rider.
7. **§7 Two inviolable laws**
   1. **§7.1 The value-cell law** — a label+value cell is ink on paper, set apart by a 1px ink frame, never a fill (never cream, white or tinted). A lone-label badge is frameless.
   2. **§7.2 The StampSeam law** — a border-riding stamp centres on the line by its own height, never a fixed margin. It rides wells, callouts and Peek titles; never the Slab leader, a flush header band, or an entity's frame (its labels are the head's first line).
