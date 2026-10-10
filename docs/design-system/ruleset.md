# The Primitives Ruleset — Salvage Union Design System

> **Status:** Canon. This is the authoritative, comprehensive ruleset for the
> SU-SRD UI — the governing laws every primitive and every surface obeys. It is
> the _rules_; the visual codex is the _rendered proof_:
> <https://claude.ai/code/artifact/21df6224-cb0d-4520-a411-10f5646b4cf7>.
>
> If a component contradicts a rule here, the component is wrong — never the
> reverse. Where the canon moves, it moves **only** toward the printed Workshop
> Manual (warm, paperlike, banded in colour, stamped in ink). Copy stays 1:1 with
> real SRD data.
>
> **Brand refresh (ratified 9 Oct 2026, #1250).** The source section below and
> the rules it feeds (§1, §2, §3.1, §3.4, §3.5, §3.8–3.11, §4.1, §4.2, §4.4,
> §4.6, §5, §8) were amended together, from the brand-refresh design canvas:
> <https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm> (boards 02b "From the book",
> 03 Colour, 04 Type, 05c Texture, E1–E4 Entity card, 12 Roadmap). This
> amendment is the rule; the tokens and components follow it phase by phase
> (tokens and gates in #1251, shared chrome in #1252, the entity card in #1253).
> Where the code still shows the old value, the code is behind, not the canon.

---

## The source: the Workshop Manual

**The printed Workshop Manual is the visual source of truth.** When a screen and
the book disagree, open the book. The manual already solved what the apps
struggle with: paper pages, colour only in bands, ink banners and framed
numbers. Read as a system, it says where every colour goes. These are its
devices, and the apps quote them literally:

- **Chapter band.** A paper page with a band in the section colour across the
  top, and the giant title notched into the band on a paper cut-out, **in ink**.
  Never a white knockout on the band (print sets "PILOT BAY" in white on orange;
  on screen that is 2.4 : 1). Colour lives only in the band; the page stays
  paper. The foot band carries the citation (page and section).
- **Framed numeral + ink stamp.** The stat column: a framed numeral beside an
  ink stamp in the manual's own wording (`14 | STRUCTURE PTS.`), label at 14px.
  The book's labels are STRUCTURE PTS., ENERGY PTS., HEAT CAP., SYSTEM SLOTS,
  MODULE SLOTS, CARGO CAP., TECH LEVEL and SALVAGE VALUE. In print they run
  diagonally; on screen they stay horizontal and keep the book's order. This is
  the value-cell law (§7.1) at page scale.
- **The ink banner.** Tier numeral, title, cost pennant, then the "//"
  metadata, on an ink fill with a rounded tail. On screen it is the entity
  card's ink header (§5), not a separate component.
- **"ROLL THE DIE:"** — the underlined ink stamp over the banded d20 tables.
- **"//" lines.** Italic trait and meta lines, items separated by "//"
  (`Turn Action // Range: Close`).

**The book's colour map** — which chapter band a page wears:

| Chapter band      | Colour                        | Pages                                                            |
| ----------------- | ----------------------------- | ---------------------------------------------------------------- |
| Rules · Salvaging | rules blue, `--color-wk-line` | Home (Contents), Core Rules, Salvaging, Guides, Keywords         |
| Pilot Bay         | `--color-pilot`               | Classes, Abilities, Equipment; ITUN pilot sheets                 |
| Mech Workshop     | `--color-mech`                | Chassis, Systems, Modules; ITUN mech sheets                      |
| Union Crawler     | `--color-crawler`             | Crawlers, Bays, Crawler TLs; ITUN crawler sheets                 |
| Denizens          | `--color-denizen-band`        | Bio-Titans, Creatures, NPCs, Squads (cards keep adversary brown) |

The blue belongs here as a band, never as the page ground (§4.1).

**Where the screen departs from print, on purpose:**

- **No white knockout.** Keep the notch layout; set the title in ink.
- **Texture is generated, light, and placed** (§3.5), not scanned scuffs.
- **The ability-tree track** (the thick "pipe" beside a class's abilities) stays
  a diagram on the class page. It never becomes a left border on a card (§3.10).
- **Rounding only where it copies a book style** (§4.4).

---

## 0. The one law

> **One kind × one context = one primitive.**

Geometry is constant across contexts; only **materials, density, and
interactivity** change. No cell may ever grow a second answer — if a kind of
thing already has a primitive, a new screen/size/theme reuses it with different
props, it does not spawn a sibling. There is **one way to render a kind of thing
in a given context**, and this document is the enumeration of those ways.

The corollaries the rest of the ruleset makes precise:

- **Stamps label · slabs section · tags cite — never interchanged.**
- **Rust means action, and only action.** A rust element in a read-only context
  is a defect.
- **A value cell is a framed ink-on-paper cell** — distinguished by its frame,
  not by a special fill (the value-cell law, §7).
- **State is a treatment, not a hue** — redline / strike / X ride _on top of_ the
  ontology colour; state never introduces a second colour.
- **No gradient shading.** Hard-stop bands (patterns) are fine; smooth
  interpolation is not. No colour outside the closed set (§4). See §3.5.

---

## 1. The Context Laws

Every surface is one of five contexts. The context decides the _materials and
interactivity_ a primitive is rendered with; it never changes the primitive's
identity. Automation semantics follow [ADR-007](../ARCHITECTURE.md#adr-007)
and the surface/mode taxonomy of [ADR-021](../ARCHITECTURE.md#adr-021).

| Context        | Metaphor             | Materials                                                  | Interactivity                                                                                       |
| -------------- | -------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Reference**  | The book, verbatim   | Cream/paper, read-only                                     | None. No play-state — no current values, conditions, controls. The only rust is an inline link.     |
| **Live Sheet** | The pencil           | Same paper + editability                                   | `free` — dashed borders & steppers are the only "write here" cues; rules show but never gate.       |
| **Dashboard**  | The instrument panel | **Paper instruments on a dark ground**, geometry identical | The only transactional surface: bookkeeping `auto`+undo; destruction `confirm`+undo; Change Log.    |
| **Listing**    | One line, one click  | Header-only rows                                           | Nothing editable/expandable in place. Identify + click-through; nested entities live in the parent. |
| **Tooltip**    | The glance           | Dense, lifted plate                                        | Terminal — no buttons, links, nested tooltips, or steppers, ever. Reuses the dense variants.        |

**Automation vocabulary** (used in the matrix below):

- **`auto`** — applied automatically + undo (Dashboard bookkeeping).
- **`confirm`** — player confirms + undo (Dashboard destruction).
- **`free`** — unguarded edit (Live Sheet); overrides are visibly non-canonical + logged.
- **`—`** — the primitive does not appear in this context.

**Rules that ride the context:**

- **Reference:** if it can't appear in the printed manual, it can't appear here.
- **Live Sheet:** overrides are visibly non-canonical (dashed ring) **and logged**; the sheet never auto-applies. **Print reads, pencil writes:** the read state is typeset (label + value, empty fields omitted); dashed fields and steppers appear only in the edit state.
- **Dashboard:** _every_ mutation of a pilot, mech or crawler writes a Change Log row, and every roll a row in the Game's log; the seat (mount, range, effects, the resolve) is shared play state and is not logged. Geometry is identical to the sheet. **The cockpit is warm-paper instruments on a dark ground** — three depth levels, all canonical tokens, no private layer and no gradients: the ground (`--color-ink-deep`, both the surround and the canvas behind the instruments), the instrument chassis (`--color-band-cream` — EVERY cockpit card: rail, the Major slot, the two Minor slots, and the overlays that open over them), and the one document surface (`--color-paper` — the display region alone, the thing the cockpit is reading). One card background throughout: the Major slot is not lit differently from the Minors beside it, because it is already marked by its size — emphasis comes from the frame, not the fill. This supersedes two earlier revisions: the original dark _instrument skin_ (which also named itself the one sanctioned pure-white exception in §4.1), and the all-paper flip that replaced it. The all-paper revision was correct to put the instruments and their type in the book vocabulary, but it left every region the same white box, so the ground was darkened back to restore the hierarchy the hairlines alone could not carry. The instruments themselves stay paper/ink — the dark is a framing ground, not a skin. Ratified here. **The cost pennant is the action button** (#1250): an action is resolved by tapping its pennant, which is the same size and shape as the read pennant, filled rust, with a 44px invisible hit area — there is no separate deck button. **The Dashboard stays flat:** no texture (§3.5).
- **Listing:** the row's whole job is identify + click-through; nested entities live inside the parent's expanded view. **A compact (head-extent) card is one line:** it never wraps; a long name truncates with "…" and keeps the full name in a tooltip, and the stats, pennant and chevron never wrap.
- **Tooltip:** a glance and a page must never disagree — the tooltip reuses the dense variants, nothing inside acts.

---

## 2. The Rendering Matrix

**What to use, when.** This is the heart of the ruleset: every UI **role** — the
job a piece of data does on screen — maps to exactly one primitive, and the rule
tailors it. Instances collapse into their role (a Tech level is not a role; it is
the Stat / `label | value` role). The tables below read left-to-right across
**surfaces** — Reference → Live Sheet → Dashboard → Listing → Tooltip; `—` = not
rendered on that surface. For the at-a-glance role → primitive summary, see the
`Rendering Matrix` story (`bun run stories`).

### Vitals — Heat · HP · AP/EP · SP · TP

| Role      | Reference                               | Live Sheet                                                   | Dashboard                                                                              | Listing  | Tooltip          |
| --------- | --------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------- | ---------------- |
| **Heat**  | — (only Heat Cap canon)                 | VitalGauge sheet-skin, redline at cap `free` + overload hint | VitalGauge instrument · Push +2 `auto` · at cap → Overload `confirm` · Vent = rust Btn | MiniStat | VitalGauge dense |
| **HP**    | VitalGauge sheet-skin (read)            | VitalGauge sheet-skin `free` · at 0 → Critical Injury hint   | VitalGauge instrument · damage `auto` · 0 → Critical Injury `confirm`                  | MiniStat | VitalGauge dense |
| **AP/EP** | VitalGauge sheet-skin                   | VitalGauge sheet-skin `free`                                 | VitalGauge instrument · action spends `auto`                                           | MiniStat | VitalGauge dense |
| **SP**    | VitalGauge sheet-skin                   | VitalGauge sheet-skin `free` · at 0 → Critical Damage hint   | VitalGauge · damage `auto` · 0 → Critical Damage `confirm`                             | MiniStat | VitalGauge dense |
| **TP**    | StatControl counter (no cap → no gauge) | StatControl `free` — downtime resource                       | —                                                                                      | MiniStat | MiniStat         |

### Stats / Caps · Conditions

| Role              | Reference                 | Live Sheet                                                        | Dashboard                                                | Listing                | Tooltip             |
| ----------------- | ------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------- | ---------------------- | ------------------- |
| **Cap / stat**    | Stat — the printed number | Stat; Override → StatControl w/ dashed non-canonical ring, logged | `free` — cap is the gauge's max end                      | MiniStat               | MiniStat            |
| **Sys/Mod slots** | Stat pair                 | Stat used/max (derives from chassis)                              | MiniStat in the deck header                              | MiniStat               | MiniStat            |
| **Condition**     | — (canon is pristine)     | ConditionToggle tri-state `free` · Destroyed grays the card       | ConditionToggle · →Damaged `auto` · →Destroyed `confirm` | tri-state glyph static | glyph + status word |

### Rolls · Resources

| Role             | Reference                                                                  | Live Sheet                                  | Dashboard                              | Listing                | Tooltip                  |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------- | ---------------------- | ------------------------ |
| **Roll table**   | RollTable banded d20 (peach/cream) under a ROLL THE DIE: stamp             | RollTable in a modal · rust Roll Btn `free` | RollTable dense, instrument · Roll Btn | Stamp + d20 Pill       | RollTable dense, no Roll |
| **Roll result**  | Readout (number · outcome · text) + marked row · no tier colour · no Apply | Readout + marked row + Apply · lines        | `auto` / `confirm`                     | —                      | —                        |
| **Cargo slots**  | Stat cap only                                                              | SlotGrid dashed=empty/solid=filled `free`   | SlotGrid · salvage fills `auto`        | MiniStat               | MiniStat                 |
| **TL / Salvage** | TL-Salvage badge                                                           | TL-Salvage badge read-only (derived: SV=TL) | TL-Salvage badge instrument            | TL-Salvage badge dense | TL-Salvage badge         |

### Action facets · Entities · Chrome

| Role               | Reference                        | Live Sheet                                               | Dashboard                                                                 | Listing                                   | Tooltip                        |
| ------------------ | -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------ |
| **Cost (AP/EP)**   | Cost pennant                     | Cost pennant read-only                                   | pennant IS the rust Btn (read-pennant size, 44px hit) · tap spends `auto` | Cost pennant                              | Cost pennant                   |
| **Range**          | Range badge + tooltip            | Range badge (never interactive)                          | Range badge                                                               | Range badge                               | badge (own tooltip suppressed) |
| **Action type**    | Action-type stamp                | stamp                                                    | stamp = deck source-filter key                                            | stamp                                     | stamp                          |
| **Entity card**    | Card full — THE canonical render | Card compact→expand · chrome layered on, never replacing | Card instrument-skin · actions → deck                                     | Card header-only row, one line, clickable | Card dense hovercard           |
| **Section header** | Slab                             | Slab                                                     | Slab instrument                                                           | Slab divider                              | — (bare Stamp at most)         |
| **Source**         | in card foot                     | Change Log row (provenance = history)                    | Change Log row, instrument                                                | dense                                     | —                              |

---

## 3. Cross-cutting laws

1. **Rust = action, only action.** `--color-rust` is the single mutator
   signal. A rust element in a read-only context (Reference, Tooltip) is a defect.
   The one Reference exception is an **inline link** (InlineRef resolved state).

   **The rust allowlist.** Rust is painted only by `Button` / `buttonVariants`
   (every action, the Dashboard's cost-pennant button included) and by
   `InlineRef`. Nothing else may reference `--color-rust`, and no other token
   may alias it: `--color-sheet-pilot-deep` stops resolving to
   `var(--color-rust)` and gets a literal value of its own. Chrome never
   borrows rust as a brand accent — not the ".io" or "Beta" marks, not a "Buy
   the game" link, not the "you are here" state (an inverse ink stamp).
   Abilities are drawn as the book draws them, as ink banners (§5): the Core
   tier fill (`--color-tier-core`, #a85947) is rust's near twin, so an ability
   card filled with it reads as a button. `bun run check styling` learns this
   allowlist in #1251.
2. **Stamps label · slabs section · tags cite.** These three never trade jobs. A
   stamp is the ink label/header atom; a slab titles a section; a badge/tag cites
   categorical metadata.
3. **State is a treatment overlay, not a hue.** `status-ok/warn/bad` are the web
   state tokens; damaged/destroyed/heat-redline/over-capacity is the sanctioned
   `status-bad`. State rides as strike / X / redline _on top of_ the ontology hue —
   never as a second colour.
4. **Roll-tier colours are Discord-bot-only.** The web apps **never** colour roll
   outcomes. Even in the bot the tiers are re-toned to the warm workshop palette
   (brick / ember / ochre / olive / slate — off stock Material hues); the web
   status tokens move with them, so damaged-red reads warm brick, not neon.
   A web roll result is a **readout** (number, outcome and text) plus a mark on
   the matching row. The mark is the same whatever the outcome, so it is not
   outcome colouring.
5. **No gradient SHADING. Closed colour set.** No colour outside §4's set.
   What is banned is **smooth interpolation between colours** — the soft,
   dimensional, airbrushed look. Half-fills and X's are `clip-path` + SVG,
   never gradient fills.

   **The line is hard stops, not the CSS function.** A `linear-gradient` whose
   colour stops are coincident (`… var(--color-tl-1) 16.7%, var(--color-tl-2)
16.7% …`) does not blend: it paints flat bands, and is a **pattern** — the
   same category as a hatch, a stripe or a checkerboard. Patterns built from
   hard stops on §4 tokens are permitted. This was previously written as "two
   named exemptions, and only these two", which had already been overtaken:
   every sanctioned case was a hard-stop pattern, and each new one had to be
   argued from precedent rather than principle. Naming the principle retires
   that.

   Sanctioned patterns today: the `Slab` dashed leader, the **srd catalog tile
   ramps** (`CatalogTile`/`catalogColors` — tech-level and ability-tier bands
   as a wayfinding cue) and its story. Each is still listed in `tools/rules/designTokens.ts`'s
   `EXEMPTIONS` table with a written reason, because the checker matches the
   CSS function and cannot itself tell a hard stop from a blend. Ruled and
   still to be built: the **user-made hatched band** (§3.9), a hard-stop
   `repeating-linear-gradient(135deg, …)`; it joins `EXEMPTIONS` when it lands.

   **Texture: the light speckle** (board 05c). The printed bands and banners
   are speckled, and so are ours — generated in code, light, and never scuffed.
   Speckle is grain, not shading: it does not interpolate between colours or
   model a surface, so it sits on the pattern side of this law. Where it goes,
   exactly:
   - **ink speckle** on every colour band and tone header (chapter bands,
     entity-card tone headers);
   - **paper flecks** on every dark header — the Union bar included — on ink
     headers (the ink banner) and on unit stamps.

   Never on paper, buttons, fields, the Dashboard or tooltips. The speckle
   sits behind the content: a band's notched title is on clean paper and is
   untouched. This supersedes the earlier "every band is flat" decision. The
   `/about` panel below stays its own ruling; the speckle is not a precedent
   for it, nor it for the speckle.

   **There is exactly ONE shading exemption, and it is a ruled one-off:** the
   `.pilot-panel` distressed-metal effect on srd's `/about` (12 declarations in
   `apps/srd/src/styles/global.css` — five soft rust blooms, a five-stop steel
   ramp, four domed rivets and a fade-to-transparent rule).

   It is exempt because it is a **picture**, not a surface: a CSS illustration
   of a rusted, riveted plate, on one page, behind prose. The no-shading law
   governs how the product renders game data and chrome; it was never trying to
   ban an illustration, and flattening this one produced a worse page for no
   principled gain.

   **This is not precedent.** "It's decorative" is exactly the argument that
   would erode the law everywhere, so the exemption is written as an instance,
   not a category: `/about`'s panel, and nothing else. A second one-off needs
   its own explicit ruling, not an appeal to this entry.

   Anything else is a defect.

6. **Copy is 1:1 with real SRD data**, everywhere — catalog stories included.
7. **Stats render through Stat; game data renders through the shared
   primitives.** Any `label | value` — a stat, cap, vital, tech level, range,
   cost — is a **Stat** in the anatomy its context calls for (horizontal
   `label | value`, framed tracker, box, inline chip), **never** hand-assembled
   text like `<span>SP {n}</span>`. More broadly, every game component renders
   through the canonical shared primitives (Card · Stat ·
   VitalGauge · Badge · ConditionSwatch · SlotGrid · RollTable · …) — a surface
   never reinvents a primitive's markup one-off. If you are about to type a stat
   into a `<span>`, you want a Stat.
8. **Ink on colour.** Text on a pilot or mech fill is **ink**: paper text
   measures 2.4 : 1 on pilot orange and 3.0 : 1 on mech green, and ink measures
   6.4 and 5.1. No text pair on a fill goes under 4.5 : 1. Crawler pink fails
   both ways (paper 3.7, ink 4.2), so a crawler band that carries paper text
   uses the deeper `--color-crawler-band`; Denizens navy carries paper text.
   **TL is the framed ink-on-paper badge, never a text ground** — a tech-level
   blue is a fill for the badge's ramp, not something text sits on.
9. **Canon is solid; homebrew is dashed.** Anything a player makes **that
   could be mistaken for book content** — a mech pattern, an NPC — wears the
   user-made treatment: a dashed ink frame in place of the solid one, a dashed
   **User-made** stamp on the header seam (its tooltip: "Made by a player, not
   from the Workshop Manual"), a dashed footer rule and dashed pills, and a
   credit that reads just "Made by [user]" in place of a page citation. The
   treatment holds at every size and extent, the one-line compact row
   included, and in a link preview (§4.6). On a full page it also gets a **hatched band** (a hard-stop
   `repeating-linear-gradient`, §3.5), a dashed frame around the notched title
   and a banner naming the maker. Pilots, mechs and crawlers built from canon
   stay **solid**: nobody mistakes a pilot sheet for a book page. Dashes
   already mean "pencil, not print" (§1 Live Sheet: the edit field, the
   override ring); this rule extends that meaning to a whole card. It is one
   `userMade` flag on the entity card (#1276), never per-surface styling.
10. **No left-rail borders** on cards. Colour rides in top bands, stamps and
    gauges; nesting shows by containment and the seam stamp (§5), never by a
    coloured left edge. The book's ability-tree track stays a diagram.
11. **One union, two tools. ITUN is the brand.** salvageunion.io and ITUN are
    one product under one Union bar. The product switcher reads **Reference |
    Build** — it names what you do there; ITUN stays the product name, and
    "In The Union Now" is spelled out on ITUN's front door. No off-site arrows
    between the two ("Builder ↗", "SRD ↗"). The ITUN domain move that goes with
    this decision is #1244.

---

## 4. Foundations (the token layer — one home, `theme.css`)

### 4.1 Colour roles

The values live in `theme.css` alone; this table names each role and its use.

| Role                      | Token                     | Use                                                                                  |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| ink                       | `--color-ink`             | every stamp/label/tab, text, borders                                                 |
| ink · secondary           | `--color-ink-2`           | secondary ink                                                                        |
| ink · deep                | `--color-ink-deep`        | the dark header ground                                                               |
| ink ramp                  | `--color-ink-75…8`        | hairlines, placeholders, ghosts, disabled fills — warm ink at opacity, never a grey  |
| paper · system white      | `--color-paper`           | THE light surface: cards, stats, inputs, gauge tracks, value cells, and text on ink  |
| band cream                | `--color-band-cream`      | RollTable d20 banding (§2) **and** the Dashboard's card chassis (§1) — the one cream |
| rust · action             | `--color-rust`            | the one action colour                                                                |
| pilot                     | `--color-pilot`           | pilot ontology                                                                       |
| mech                      | `--color-mech`            | mech ontology                                                                        |
| crawler                   | `--color-crawler`         | crawler ontology                                                                     |
| crawler band              | `--color-crawler-band`    | the deeper crawler band that carries paper text (§3.8)                               |
| Denizens band             | `--color-denizen-band`    | the Denizens chapter band (navy); Denizens cards keep adversary brown                |
| adversary                 | `--color-adversary`       | creatures · bio-titans · factions · npcs · meld · squads                             |
| cargo                     | `--color-cargo`           | cargo fills                                                                          |
| tier · core               | `--color-tier-core`       | Core ability-tree tier (Advanced = pilot, Legendary = crawler)                       |
| workshop ground           | `--color-wk-bg` / `-2`    | the page ground (the book's paper): the step off-paper that makes a card a panel     |
| workshop muted            | `--color-wk-muted`        | muted text on paper                                                                  |
| workshop rules            | `--color-wk-line/-accent` | advisory rule and the rules-blue chapter band · game-state accent                    |
| caution                   | `--color-caution`         | attention fill that is neither ontology nor status                                   |
| inert                     | `--color-inert`           | inert / non-numeric tier fill                                                        |
| status-ok                 | `--color-status-ok`       | ok state overlay                                                                     |
| status-warn               | `--color-status-warn`     | warn state overlay                                                                   |
| status-bad · damaged      | `--color-status-bad`      | damaged / destroyed / redline / over-cap                                             |
| roll tiers · **BOT ONLY** | re-toned ramp             | Discord roll outcomes only                                                           |
| tech-level blues          | TL 1–6 · B · N            | TL badge ramp                                                                        |

**Ratified by the brand refresh (#1250).** These values land in `theme.css`
with #1251; until then `theme.css` still ships the old ones, and is behind.

- **The page ground is the book's paper.** `--color-wk-bg` moves from the cool
  #e6f0f5 to **#efece6**. The blue stops being the ground of every page and
  becomes a **chapter band** (Rules, Salvaging, Contents, Guides — the
  source section's colour map).
- **Muted text is warm.** `--color-wk-muted` moves from the cool grey #5a646d
  to **#6b6257** (5.7 : 1 on paper, 5.1 : 1 on the new ground).
- **Two new closed-set colours:** `--color-crawler-band` **#b84a86** (paper
  text on it measures 4.6 : 1) and the Denizens navy `--color-denizen-band`
  **#2f4a66** (8.8 : 1).
- **`--color-sheet-pilot-deep` stops aliasing rust** (§3.1).

**There is no second spelling.** The `su-*` brand family that these tokens were
once defined as aliases _of_ is deleted (see the note in `theme.css`). It was a
shadow tokenset: `su-orange-dark` and `rust` were the same colour, which made
"rust = action, only action" unauditable by search, and `su-paper` shipped a
second cream reading surface beside `--color-paper`. Enforced by
`bun run check styling`.

**The paper flip (decided):** `--color-paper` is the dedicated system
white, **not cream** (the cream cutover read too beige, and `bg-paper` is already
the dominant whitespace token). One token, every light surface. **Pure white is
retired from the UI** — paper is used universally, including the value cell and
text on ink. (The one remaining pure white is a scoped exception: the print
stylesheet's physical paper. See §1.)

### 4.2 The tracking ladder

Five rungs, down from 15. **This table describes what `theme.css` actually
ships** — an earlier revision of this section declared a three-token set
(`--tracking-label` / `--tracking-display` / `--tracking-eyebrow`) and asserted
the wide values "conform down to 0.04em". That consolidation was never built:
those two token names do not exist, and the wide rungs are in deliberate,
active use. Ratified as-is rather than re-lettering every label in the app.

| Token                   | Value    | Use                                            |
| ----------------------- | -------- | ---------------------------------------------- |
| `--tracking-caps-tight` | `0.04em` | **the canonical stamp / label / tab tracking** |
| `--tracking-caps-snug`  | `0.06em` | slightly opened labels; caps at the 11px floor |
| `--tracking-caps`       | `0.08em` | chip + section labels                          |
| `--tracking-caps-wide`  | `0.12em` | widest control-panel / header stamps           |
| `--tracking-eyebrow`    | `0.22em` | brand caption only                             |

`caps-tight` is the default for a label; reach up the ladder only deliberately.
**Arbitrary `tracking-[…]` values are forbidden** — a value not on this ladder is
a defect, enforced by `bun run check styling`. Promoting these tokens into
component-lib fixed a real cross-app bug: `tracking-caps` silently rendered
untracked outside ITUN.

### 4.3 The border map (weights = tokens, one meaning each)

| Weight | Token                         | Applies to                                                                   |
| ------ | ----------------------------- | ---------------------------------------------------------------------------- |
| 3px    | `--bw-entity`                 | Card frame (full)                                                            |
| 2px    | `--bw-entity-compact` _(new)_ | compact card frame                                                           |
| 1.5px  | `--bw-chrome`                 | Stat box, gauge segments, inputs, buttons, pips, steppers                    |
| 1px    | `--bw-hairline` _(new)_       | value-cell badge frame & table rules — the ink stamp inside carries the mass |

One meaning per weight; each weight holds in **both** the light sheet and the
dark instrument.

### 4.4 Radius & spacing

- **Radius:** `3px` outer (card + Btn — the one primitive allowed to round);
  inner = `calc(3px − frame)`. **Stamps are square.**
- **Rounding beyond 3px only where it copies a book style**, and the book has
  two: the **ink-banner tail** (the rounded right end of an ink header, §5) and
  the **how-to cards on Guides**. Everything else keeps the 3px canon; a
  rounded corner that is not one of these two is a defect.
- **Spacing** spends only `{2, 4, 6, 8, 12}px`. `12px` = the card gutter —
  header / callout / body / foot all align to it.

### 4.5 The pip-row split (gauges + statblocks)

Max 6 pips per row, split balanced, and **bottom-heavy** — in an awkward split
the heavier row sits on the **bottom** (the higher-numbered pips fill the last
row), the lighter rows balance above (each row is centred, so the short upper
rows sit centred over the full bottom row). One canonical split for every pip
surface — Stat framed tracker, VitalGauge, and SlotGrid cargo:

```
pipRows(n): perRow = 6
  rows  = ceil(n / 6)
  base  = floor(n / rows); extra = n mod rows
  → the last `extra` rows get (base+1), the earlier rows get base
```

`6 → 6 · 7 → 3/4 · 8 → 4/4 · 9 → 4/5 · 10 → 5/5 · 11 → 5/6 · 12 → 6/6 · 13 → 4/4/5 · 20 → 5/5/5/5`.
The redline pip sits at the **70% law**.

### 4.6 The floors: type and touch

- **Type floor: 11px, no exceptions.** Nothing renders under 11px — not a
  caps label, not a seam stamp, not a roll-table stamp, not a wizard (the
  near-frozen wizards keep their look, but the floor applies there too). A
  caps label at the floor is **11px at 0.06em** (`--tracking-caps-snug`): at
  that size the caps need the air. Today's sub-floor rungs (`--text-nano` 8px,
  `--text-micro` 9px, `--text-label` 10px, `--text-label-lg` 10.5px) fold into
  the floor in #1251, and `bun run check styling` rejects anything smaller.
- **The floor holds at the size the reader sees.** A link preview is drawn at
  1200 × 630 and shown about 400px wide in a Discord embed, so its source type
  is never under **34px** (34px at 1200 is 11px at 400). Any surface that is
  scaled for display obeys the floor after scaling.
- **The stat column's label** (the framed numeral's ink stamp, source section)
  is 14px.
- **Touch: thumb first at the table.** Every target is at least **44px** under
  a coarse pointer (a hit-area pseudo-element where the visible control is
  smaller, as the Dashboard pennant does); vitals stay pinned; nothing floats
  over content (no floating button that covers a card's actions).

---

## 5. The irreducible set — 11 atoms + 1 technique

**These are an ONTOLOGY, not a component roster.** They name the kinds of thing
the UI is made of; the right-hand column names what implements each one today.
Read the barrel (`packages/component-lib/src/index.ts`) for the roster — six of
these names have never been symbols, and this table previously read as though
they were, in a document that also declares itself Canon over the components.

The "instruments" (StatBlock, MiniStat, VitalGauge) are **named compositions**,
not atoms.

| #   | Atom                        | Is                                                             | Implemented by                  |
| --- | --------------------------- | -------------------------------------------------------------- | ------------------------------- |
| 1   | **Stamp**                   | ink block, paper text — the atom of labeling                   | `Badge shape="stamp"`           |
| 2   | **Frame**                   | bordered container; weights only from `--bw-*`                 | `Card` / `Panel`                |
| —   | **StampSeam** _(technique)_ | the border-riding placement (§7)                               | `STAMP_SEAM` (chrome/stampSeam) |
| 3   | **Badge**                   | the stamp-chip family                                          | `Badge`                         |
| 4   | **Well**                    | labeled value box, read/edit × number/text                     | `Stat` (vertical anatomy)       |
| 5   | **Gauge**                   | segmented current/max track                                    | `VitalGauge`                    |
| 6   | **Btn**                     | rust action — the ONLY mutator                                 | `Button` / `buttonVariants`     |
| 7   | **Slab**                    | section stamp + leader rule                                    | `Slab`                          |
| 8   | **RollTable**               | banded d20 map (+ its description)                             | `RollTable`                     |
| 9   | **ConditionSwatch**         | tri-state categorical glyph                                    | `ConditionSwatch`               |
| 10  | **SlotGrid**                | dashed addressable cargo cells                                 | `SlotGrid`                      |
| 11  | **Icons**                   | hand-drawn `currentColor` glyph set (gear/clock · pennant · X) | `lucide-react` + local glyphs   |

### Composition tree

```
Card   = Frame(3px, tone) + band + [Badge · StampSeam] + body + expand + foot
Stat   = the labeled-value primitive: vertical (Well) | horizontal;
                read|edit · +max · +label · +pips · mini
VitalGauge    = Stamp + numeral (+ Well edit) + Gauge(bar)
Stat(edit)    = Well(number, edit) + StepButton×2
StatusBadge   = Badge(tone) + ConditionSwatch
Tally         = (ConditionSwatch + count) × 3
RollTable✦    = Card + SRD description + banded table
```

### The entity card: one anatomy, two header fills

`ReferenceEntityCard` has **one anatomy** across every size × extent × context
(boards E1–E3): the seam type stamp, a flush header (title on the left, value
cells on the right), an italic "//" line, the body and the footer. The "//"
line has no rule under it; it sits a few pixels above the description, so the
two read as one block.

The header has **two fills**, and the choice is the reader's question:

- **Tone, for things you _have_** (chassis, systems, equipment, pilots,
  creatures…): the header takes the entity's tone, carries ink speckle
  (§3.5), and its title is ink or paper, whichever passes contrast for that
  tone (§3.8).
- **Ink, for things you _do_** (abilities, actions): the book's ink banner. The
  tier numeral rides at the left (title size, slightly dimmed) and the cost
  pennant at the right; paper flecks (§3.5). The ghosted action tones retire.

Have vs do is decided by **data shape**, never by a schema name (the display
system's slot rule). **Actions sit inline** in the card as flush ink bands
(name and cost, then the "//" line and body), with no "Actions" tray and no
"Action" stamp. An entity's own roll table sits inline the same way, under a
ROLL THE DIE: bar, its result as a readout (§3.4). In the Dashboard the cost
pennant is the action button (§1).

### Nesting legibility

A card that holds cards must still read at a glance. Nested _entities_ (not
actions, which sit inline as above):

- **sit in a tray** in the page colour, inside the parent's frame;
- **every group gets a stamp-and-leader label with a count** (a Slab-style
  stamp and leader rule, naming the group and how many it holds);
- **one tone per entity** — a child wears its own tone, never a blend of its
  parent's;
- **a size step per depth:** large at depth 0, medium at depth 1, and **depth 2
  renders as a header-only, one-line, clickable row**; the frame steps
  3 → 2 → 1.5px (§4.3);
- **no prose a parent already shows** — a child hides what its parent prints;
- **actions below depth 1 collapse to a "Show N actions" chip;**
- containment and the seam stamp show the nesting, never a left rail (§3.10).

---

## 6. The merge map & the audience test

Merge any primitive that does not serve a genuinely **different reader intent** —
not a different page, size, or theme; a different _intent_.

| Unified        | Folds in                                                                                                          | Distinguished by                                                                                | Audience test                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Badge**      | ValueDisplay · Tag · Pill · Chip · CalloutMetaStamp · cost-pennant · Range · Action-type · TL · StatusBadge shell | `form` (label / label+value) · `surface` (solid/ghost/tone/quiet) · `shape` (chip/pennant/pill) | all = "categorical metadata at a glance" → merge |
| **Stat**       | StatControl · Field/Input · InlineEditField · StatBlock(pips)                                                     | `mode` read\|edit × `type` number\|text · steppers · label rides the border in every state      | read vs edit = a state, not an audience → merge  |
| **Gauge**      | VitalGauge · DashboardGauge · StatBlock pip-track · MiniStat pip-strip                                            | track bar\|grid\|micro · tone · dense · danger · editable · skin paper\|dark                    | same current/max, darker room = a skin → merge   |
| _compositions_ | StatusBadge (Badge+Swatch) · Tally (Swatch×count)                                                                 | Frame + band + Gauge/Well/Swatch — assembled from atoms                                         | instruments are built, not atomic                |

### Must **NOT** merge

- **Btn** — do vs read is the one true audience split.
- **SlotGrid** — addressable _places_ ≠ fungible _quantity_.
- **ConditionSwatch** — categorical, not a scalar.
- **RollTable** — a unique shape.
- **band ≠ rider** — a flush header band is not a border-riding stamp.

---

## 7. Two inviolable laws

### 7.1 The value-cell law

> A Badge's (or Stat's) **value cell is ink-on-paper**, distinguished by
> its **frame**, not by a special fill.

The label+value plate is **framed** (1px ink binds the two stamps); a **lone-label**
badge is **frameless**. This is the rule that resolves "why does ValueDisplay have
a border but Tag doesn't." TL is never tinted; the value cell is never cream, and
never pure white — it is the same paper as every other surface, set apart only by
the ink frame + the ink label stamp beside it.

### 7.2 The StampSeam law (the border-riding label)

The signature move: an ink Stamp centered on a container's border line — half
above, half over, like a label plate riveted across a seam.

- The offset derives from the **stamp's own height** (`translateY(-50%)` / a
  zero-height seam row), **never** a fixed `-mb-2` margin — so it never drifts as
  text grows.
- **Rides:** bordered value wells, card callouts, tooltip titles, and (to save
  space) a Badge / ValueDisplay edge or corner label instead of a full label cell.
- **Does NOT ride:** the Slab leader, and flush header bands (`band ≠ rider`).

---

## 8. Conformance checklist

A component obeys the ruleset when:

- [ ] It is **one primitive** for its kind×context — no sibling for a different size/theme (§0).
- [ ] Every label/header is a **Stamp** at `--tracking-caps-tight` `0.04em` (`0.06em` at the 11px floor); stamps are square (§4.2, §5).
- [ ] Every light surface is `--color-paper` — no pure white in the UI, including the value cell and text on ink (§4.1, §7.1).
- [ ] The only **rust** is an action (or a Reference inline link), painted by `Button`/`buttonVariants` or `InlineRef` (§3.1).
- [ ] Text on a colour fill passes 4.5 : 1 — **ink** on pilot and mech; TL is a badge, never a text ground (§3.8).
- [ ] Nothing renders under **11px**, at the size the reader sees it; coarse-pointer targets are 44px (§4.6).
- [ ] Borders use `--bw-*` weight tokens; radius is 3px on cards/Btns only, `calc()` inside — rounder only for an ink-banner tail or a Guides how-to card (§4.3–4.4).
- [ ] No **left-rail** border; nesting is containment + the seam stamp (§3.10, §5).
- [ ] Texture only where §3.5 places it — never on paper, buttons, fields, the Dashboard or tooltips.
- [ ] A player-made thing that could pass for the book is **dashed** and says User-made; canon-built units stay solid (§3.9).
- [ ] An entity card uses the one anatomy: tone header for things you have, ink header for things you do (§5).
- [ ] Any label+value shows as a **framed** ink-on-paper value cell; a lone label is **frameless** (§7.1).
- [ ] A border-riding label uses **StampSeam** (self-height-centred), not a fixed margin (§7.2).
- [ ] State reads as a **treatment overlay** (strike/X/redline), never a second hue; **no gradients** (§3.3, §3.5).
- [ ] Pips split by `pipRows(n)`; redline at 70% (§4.5).
- [ ] Roll outcomes are **uncoloured on web** (bot-only) (§3.4).
- [ ] Copy is **real SRD data** (§3.6).

---

_One kind, one context, one primitive — the older entity-display canon, unified
and warmed toward the book, with every "before" a real render and every change
earned. Logo off-limits · wizards near-frozen (their `--tone-card` fills are a
protected book aesthetic, [[wizard-info-colors]]; only the type floor applies
there) · CSP-safe · Tailwind v4 ·
`component-lib` stays no-build._
