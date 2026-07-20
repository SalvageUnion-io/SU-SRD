# The Primitives Ruleset — Salvage Union Design System

> **Status:** Canon. This is the authoritative, comprehensive ruleset for the
> SU-SRD UI — the governing laws every primitive and every surface obeys. It is
> the _rules_; the [migration plan](./canonical-primitive-language.md) is the
> _build order_; the visual codex is the _rendered proof_:
> <https://claude.ai/code/artifact/21df6224-cb0d-4520-a411-10f5646b4cf7>.
>
> If a component contradicts a rule here, the component is wrong — never the
> reverse. Where the canon moves, it moves **only** toward the printed Workshop
> Manual (warm, rounded, paperlike, stamped in ink). Copy stays 1:1 with real
> SRD data.

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
- **No gradients, anywhere.** No colour outside the closed set (§4).

---

## 1. The Context Laws

Every surface is one of five contexts. The context decides the _materials and
interactivity_ a primitive is rendered with; it never changes the primitive's
identity. Automation semantics follow [ADR-007](../adrs/ADR-007-automation-boundary.md)
and the surface/mode taxonomy of [ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md).

| Context        | Metaphor             | Materials                                  | Interactivity                                                                                       |
| -------------- | -------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Reference**  | The book, verbatim   | Cream/paper, read-only                     | None. No play-state — no current values, conditions, controls. The only rust is an inline link.     |
| **Live Sheet** | The pencil           | Same paper + editability                   | `free` — dashed borders & steppers are the only "write here" cues; rules show but never gate.       |
| **Dashboard**  | The instrument panel | **Warm-paper cockpit**, geometry identical | The only transactional surface: bookkeeping `auto`+undo; destruction `confirm`+undo; Change Log.    |
| **Listing**    | One line, one click  | Header-only rows                           | Nothing editable/expandable in place. Identify + click-through; nested entities live in the parent. |
| **Tooltip**    | The glance           | Dense, lifted plate                        | Terminal — no buttons, links, nested tooltips, or steppers, ever. Reuses the dense variants.        |

**Automation vocabulary** (used in the matrix below):

- **`auto`** — applied automatically + undo (Dashboard bookkeeping).
- **`confirm`** — player confirms + undo (Dashboard destruction).
- **`free`** — unguarded edit (Live Sheet); overrides are visibly non-canonical + logged.
- **`—`** — the primitive does not appear in this context.

**Rules that ride the context:**

- **Reference:** if it can't appear in the printed manual, it can't appear here.
- **Live Sheet:** overrides are visibly non-canonical (dashed ring) **and logged**; the sheet never auto-applies.
- **Dashboard:** _every_ mutation writes a Change Log row; geometry is identical to the sheet. **The cockpit is warm paper, not a dark skin** — an earlier revision of this ruleset specified a dark instrument skin (and named it as the one sanctioned pure-white exception in §4.1). The shipped dashboard was deliberately re-skinned to the canonical warm paper with no private token layer and no gradients; the doc had not caught up. Ratified here.
- **Listing:** the row's whole job is identify + click-through; nested entities live inside the parent's expanded view.
- **Tooltip:** a glance and a page must never disagree — the tooltip reuses the dense variants, nothing inside acts.

---

## 2. The Rendering Matrix

**What to use, when.** This is the heart of the ruleset: every UI **role** — the
job a piece of data does on screen — maps to exactly one primitive, and the rule
tailors it. Instances collapse into their role (a Tech level is not a role; it is
the Stat / `label | value` role). The tables below read left-to-right across
**surfaces** — Reference → Live Sheet → Dashboard → Listing → Tooltip; `—` = not
rendered on that surface. For the at-a-glance role → primitive summary, see the
`Rendering Matrix` Ladle story (`bun run ladle`).

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

| Role             | Reference                                            | Live Sheet                                  | Dashboard                              | Listing                | Tooltip                  |
| ---------------- | ---------------------------------------------------- | ------------------------------------------- | -------------------------------------- | ---------------------- | ------------------------ |
| **Roll table**   | RollTable banded d20, peach/cream                    | RollTable in a modal · rust Roll Btn `free` | RollTable dense, instrument · Roll Btn | Stamp + d20 Pill       | RollTable dense, no Roll |
| **Roll result**  | Highlighted rolled row + text · no colour · no Apply | Highlighted row + Apply · lines             | `auto` / `confirm`                     | —                      | —                        |
| **Cargo slots**  | Stat cap only                                        | SlotGrid dashed=empty/solid=filled `free`   | SlotGrid · salvage fills `auto`        | MiniStat               | MiniStat                 |
| **TL / Salvage** | TL-Salvage badge                                     | TL-Salvage badge read-only (derived: SV=TL) | TL-Salvage badge instrument            | TL-Salvage badge dense | TL-Salvage badge         |

### Action facets · Entities · Chrome

| Role               | Reference                               | Live Sheet                                                      | Dashboard                                                | Listing                                | Tooltip                        |
| ------------------ | --------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------- | ------------------------------ |
| **Cost (AP/EP)**   | Cost pennant                            | Cost pennant read-only                                          | pennant = rust ActionsDeck Btn label · tap spends `auto` | Cost pennant                           | Cost pennant                   |
| **Range**          | Range badge + tooltip                   | Range badge (never interactive)                                 | Range badge                                              | Range badge                            | badge (own tooltip suppressed) |
| **Action type**    | Action-type stamp                       | stamp                                                           | stamp = ActionsDeck grouping key                         | stamp                                  | stamp                          |
| **Entity card**    | DisplayCard full — THE canonical render | DisplayCard compact→expand · chrome layered on, never replacing | DisplayCard instrument-skin · actions → deck             | DisplayCard header-only row, clickable | DisplayCard dense hovercard    |
| **Section header** | Slab                                    | Slab                                                            | Slab instrument                                          | Slab divider                           | — (bare Stamp at most)         |
| **Source**         | in card foot                            | Change Log row (provenance = history)                           | Change Log row, instrument                               | dense                                  | —                              |

---

## 3. Cross-cutting laws

1. **Rust = action, only action.** `--color-rust` (#a85222) is the single mutator
   signal. A rust element in a read-only context (Reference, Tooltip) is a defect.
   The one Reference exception is an **inline link** (InlineRef resolved state).
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
5. **No gradients. Closed colour set.** No colour outside §4's set; no gradient
   anywhere (half-fills and X's are `clip-path` + SVG, never gradient fills).
   **Two named exemptions, and only these two:** the `Slab` dashed leader (a
   deliberate control-panel shape built on ink tokens), and the **srd catalog
   tile ramps** (`CatalogTile`'s `--catalog-bg`, which carries the tech-level and
   ability-tier ramps on the landing page — the ramp is a wayfinding cue, not
   decoration). Both are encoded in `tools/check-design-tokens.ts`'s `EXEMPTIONS`
   table, which requires a written reason per entry. Anything else is a defect.
6. **Copy is 1:1 with real SRD data**, everywhere — catalog stories included.
7. **Stats render through Stat; game data renders through the shared
   primitives.** Any `label | value` — a stat, cap, vital, tech level, range,
   cost — is a **Stat** in the anatomy its context calls for (horizontal
   `label | value`, framed tracker, box, inline chip), **never** hand-assembled
   text like `<span>SP {n}</span>`. More broadly, every game component renders
   through the canonical shared primitives (DisplayCard · Stat ·
   VitalGauge · Badge · ConditionSwatch · SlotGrid · RollTable · …) — a surface
   never reinvents a primitive's markup one-off. If you are about to type a stat
   into a `<span>`, you want a Stat.

---

## 4. Foundations (the token layer — one home, `theme.css`)

### 4.1 Colour roles

| Role                      | Token                     | Hex       | Use                                                                                 |
| ------------------------- | ------------------------- | --------- | ----------------------------------------------------------------------------------- |
| ink                       | `--color-ink`             | `#282019` | every stamp/label/tab, text, borders                                                |
| ink · secondary           | `--color-ink-2`           | `#463d31` | secondary ink                                                                       |
| ink · deep                | `--color-ink-deep`        | `#1b1712` | the dark header ground                                                              |
| ink ramp                  | `--color-ink-75…8`        | —         | hairlines, placeholders, ghosts, disabled fills — warm ink at opacity, never a grey |
| paper · system white      | `--color-paper`           | `#fbfaf7` | THE light surface: cards, stats, inputs, gauge tracks, value cells, and text on ink |
| band cream                | `--color-band-cream`      | `#f3ede2` | **RollTable d20 banding only** (§2) — the one sanctioned cream                      |
| rust · action             | `--color-rust`            | `#a85222` | the one action colour                                                               |
| pilot                     | `--color-pilot`           | `#ef894f` | pilot ontology                                                                      |
| mech                      | `--color-mech`            | `#7a978a` | mech ontology                                                                       |
| crawler                   | `--color-crawler`         | `#ce5898` | crawler ontology                                                                    |
| adversary                 | `--color-adversary`       | `#8c4b38` | creatures · bio-titans · factions · npcs · meld · squads                            |
| cargo                     | `--color-cargo`           | `#9c7a3e` | cargo fills                                                                         |
| tier · core               | `--color-tier-core`       | `#a85947` | Core ability-tree tier (Advanced = pilot, Legendary = crawler)                      |
| workshop ground           | `--color-wk-bg` / `-2`    | `#e6f0f5` | the step off-paper that makes a card read as a panel                                |
| workshop rules            | `--color-wk-line/-accent` | —         | advisory rule · game-state accent                                                   |
| caution                   | `--color-caution`         | `#d7c37d` | attention fill that is neither ontology nor status                                  |
| inert                     | `--color-inert`           | `#c0c0c0` | inert / non-numeric tier fill                                                       |
| status-ok                 | `--color-status-ok`       | `#6f8a4a` | ok state overlay                                                                    |
| status-warn               | `--color-status-warn`     | `#c07a2f` | warn state overlay                                                                  |
| status-bad · damaged      | `--color-status-bad`      | `#b0432b` | damaged / destroyed / redline / over-cap                                            |
| roll tiers · **BOT ONLY** | re-toned ramp             | —         | Discord roll outcomes only                                                          |
| tech-level blues          | TL 1–6 · B · N            | —         | TL badge ramp                                                                       |

**There is no second spelling.** The `su-*` brand family that these tokens were
once defined as aliases _of_ is deleted (see the note in `theme.css`). It was a
shadow tokenset: `su-orange-dark` and `rust` were the same `#a85222`, which made
"rust = action, only action" unauditable by search, and `su-paper` shipped a
second cream reading surface beside `--color-paper`. Enforced by
`bun run check:tokens`.

**The paper flip (decided):** `--color-paper = #fbfaf7` — the dedicated system
white, **not cream** (the cream cutover read too beige, and `bg-paper` is already
the dominant whitespace token). One token, every light surface. **Pure white is
retired from the UI** — paper is used universally, including the value cell and
text on ink. (The only remaining `#ffffff` are scoped exceptions: the print
stylesheet's physical paper — the Dashboard is warm paper too, so the dark-skin
exception this note used to carve out no longer exists. See §1.)

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
| `--tracking-caps-snug`  | `0.06em` | slightly opened labels                         |
| `--tracking-caps`       | `0.08em` | chip + section labels                          |
| `--tracking-caps-wide`  | `0.12em` | widest control-panel / header stamps           |
| `--tracking-eyebrow`    | `0.22em` | brand caption only                             |

`caps-tight` is the default for a label; reach up the ladder only deliberately.
**Arbitrary `tracking-[…]` values are forbidden** — a value not on this ladder is
a defect, enforced by `bun run check:tokens`. Promoting these tokens into
component-lib fixed a real cross-app bug: `tracking-caps` silently rendered
untracked outside ITUN.

### 4.3 The border map (weights = tokens, one meaning each)

| Weight | Token                         | Applies to                                                                   |
| ------ | ----------------------------- | ---------------------------------------------------------------------------- |
| 3px    | `--bw-entity`                 | DisplayCard frame (full)                                                     |
| 2px    | `--bw-entity-compact` _(new)_ | compact card frame                                                           |
| 1.5px  | `--bw-chrome`                 | Stat box, gauge segments, inputs, buttons, pips, steppers                    |
| 1px    | `--bw-hairline` _(new)_       | value-cell badge frame & table rules — the ink stamp inside carries the mass |

One meaning per weight; each weight holds in **both** the light sheet and the
dark instrument.

### 4.4 Radius & spacing

- **Radius:** `3px` outer (card + Btn — the one primitive allowed to round);
  inner = `calc(3px − frame)`. **Stamps are square.**
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

---

## 5. The irreducible set — 11 atoms + 1 technique

Everything renders from these. The "instruments" (StatBlock, MiniStat,
VitalGauge) are **named compositions**, not atoms.

| #   | Atom                        | Is                                                             |
| --- | --------------------------- | -------------------------------------------------------------- |
| 1   | **Stamp**                   | ink block, paper text — the atom of labeling                   |
| 2   | **Frame**                   | bordered container; weights only from `--bw-*`                 |
| —   | **StampSeam** _(technique)_ | the border-riding placement (§7)                               |
| 3   | **Badge**                   | the stamp-chip family                                          |
| 4   | **Well**                    | labeled value box, read/edit × number/text                     |
| 5   | **Gauge**                   | segmented current/max track                                    |
| 6   | **Btn**                     | rust action — the ONLY mutator                                 |
| 7   | **Slab**                    | section stamp + leader rule                                    |
| 8   | **RollTable**               | banded d20 map (+ its description)                             |
| 9   | **ConditionSwatch**         | tri-state categorical glyph                                    |
| 10  | **SlotGrid**                | dashed addressable cargo cells                                 |
| 11  | **Icons**                   | hand-drawn `currentColor` glyph set (gear/clock · pennant · X) |

### Composition tree

```
DisplayCard   = Frame(3px, tone) + band + [Badge · StampSeam] + body + expand + foot
Stat   = the labeled-value primitive: vertical (Well) | horizontal (=ValueDisplay);
                read|edit · +max · +label · +pips · mini
VitalGauge    = Stamp + numeral (+ Well edit) + Gauge(bar)
StatControl   = Well(number, edit) + StepBtn×2
StatusBadge   = Badge(tone) + ConditionSwatch
Tally         = (ConditionSwatch + count) × 3
RollTable✦    = DisplayCard + SRD description + banded table
```

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
- [ ] Every label/header is a **Stamp** at `--tracking-label` `0.04em`; stamps are square (§4.2, §5).
- [ ] Every light surface is `--color-paper` **#fbfaf7** — no pure white in the UI, including the value cell and text on ink (§4.1, §7.1).
- [ ] The only **rust** is an action (or a Reference inline link) (§3.1).
- [ ] Borders use `--bw-*` weight tokens; radius is 3px on cards/Btns only, `calc()` inside (§4.3–4.4).
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
protected book aesthetic, [[wizard-info-colors]]) · CSP-safe · Tailwind v4 ·
`component-lib` stays no-build._
