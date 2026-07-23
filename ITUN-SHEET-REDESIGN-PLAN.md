# ITUN Live-Sheet Redesign — Plan & Visual Directions

_Redesign on branch 395 (`worktree-sheet-single-surface`). Design record — the redesign is now
**implemented** on this branch (poster layout + the section-based edit language). Deferred
follow-ups (Save-as-pattern, Source-pattern field, rule-gating add/remove, separate Quirk/Appearance,
Custom Bays group) are marked `// TODO(redesign)` in the code._

## Goal

Make ITUN's live sheets read like the **official Salvage Union character sheets** — same regional
layout, single-accent identity, edge wordmark, current/max gauges — while every direct game-data
reference (abilities, systems, modules, equipment, bays) keeps rendering through the existing SRD
`ReferenceEntityDisplay` system. The result should feel **professional, clean, and unified**: the
simplicity of the printed sheets carrying the design language of the SRD.

**Hard constraint:** no visual changes to the SRD reference site (`srd`) or the shared
reference display as it appears there. This is an ITUN-only shell/layout pass.

## Where we're starting

PR #395 made the **Sheet the single surface** for viewing and editing a pilot / mech / crawler.
The sheets already carry a surprising amount of official-sheet DNA:

- Per-sheet `--tone` / `--ground` OKLCH theming already matched to the official accent colors
  (**pilot = orange, mech = teal-green, crawler = magenta**).
- The `font-cond` display face is **Barlow Semi Condensed** — the same tall-condensed feel as the
  printed wordmark.
- Border-weight token system (`--bw-entity/rail/pill/chrome`), black pseudoheader stamps,
  `StatBlock` trackers, a `ChassisStats` spec strip, rail chips for linked entities.
- **All game-data cards already render via `ReferenceEntityDisplay` / `Card`.**

## Gap analysis — current sheet vs. the official poster

| Official-sheet feature                                                     | ITUN today                               | Work                                   |
| -------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------- |
| Vertical edge **wordmark** (PILOT / MECH / CRAWLER)                        | small horizontal black category tab      | reshape + relocate                     |
| **Two-column poster** layout                                               | single column: hero band → stacked slabs | re-grid                                |
| **Dial / ring gauges** (Max ▸ Current) for HP/AP/SP/EP/Heat                | rectangular `StatBlock`s                 | new gauge visual (direction-dependent) |
| **Iconographic** ability/system cards (AP-cost chevron, action-type, rest) | `ReferenceEntityDisplay` footer meta     | footer iconography pass                |
| **Paper-texture** ground                                                   | flat OKLCH ground                        | optional texture                       |
| Rounded **accent-bordered pill** fields                                    | black ink chips                          | field styling                          |
| Single-accent monochrome                                                   | already themed by `--tone`               | ✅ mostly done                         |
| Entity references from the SRD                                             | already `ReferenceEntityDisplay`         | ✅ done                                |

**Key realization:** "direct entity references leverage SRD Entities" is _already true_. This is a
**shell / layout / gauge / iconography** pass, not an entity-card rewrite.

## The confirmed direction

The July-2026 ITUN design review said _"leave the `LiveSheet` / `SheetHero` architecture alone — the
gaps are chrome, not layout."_ This redesign deliberately revisits **layout**. A first-look
exploration spanned three fidelities (faithful-poster → SRD-bridge → SaaS-dashboard); the requester
reviewed the official PDFs and **converged on a single target**:

- **Keep the broad two-column poster layout** of the official sheets (region-for-region), but render
  it **with the existing SRD assets** (`Card` / `ReferenceEntityDisplay`, `StatBlock`, `Slab`,
  `Panel`, `MChip`, tokens) — nudged into the poster arrangement, not a new aesthetic.
- **No vertical wordmark.** The current slim top bar (back + SU mark + name pseudoheader stamp +
  kind pill + Edit/Share/⋯) stays as the sheet's chrome.
- **Latitude = minimal-to-moderate.** Reasonable edits allowed: current/max **gauges** for
  HP/AP/SP/EP/Heat (the poster's Max▸Current dials, rendered as SRD-sibling pip tracks), the poster's
  **labeled identity fields**, the **chassis-stats strip**, and ability/system **footer meta**
  (AP cost / action type). Readability and utility lead every call.
- **Mobile = single-column stack** in the poster's reading order (identity → vitals → abilities →
  inventory for the pilot; analogous for mech/crawler). Vitals may scroll away (accepted tradeoff).
  Never any horizontal scroll; ≥44px tap targets.

## Refinements confirmed on review (approved with exceptions)

- **Entities are always entity cards.** Every referenced game entity (ability, equipment, system,
  module, bay, chassis/crawler ability, crawler type) renders through
  `ReferenceEntityDisplay` / `EntityDisplay` — in **header-only, compact, or full** mode. Use
  `EntityDisplay` wherever relevant; the **only** non-entity-card UI is the **high-level live-sheet
  shell** itself (sheet frame, top bar, current/max gauges, identity input fields).
- **Max 2 columns** for any entity-card grid in a single view (mobile = 1 column). Default to
  header-only/compact clickable listings; full mode is for the expanded/modal detail.
- **Identity input field labels sit tight to their inputs** (~2–3px), not floating above.
- **Mech chassis stats render as real `StatBlock`s** (not bespoke mini-boxes).
- **Mech naming — name and pattern name are the same field.** The **Pattern name is the prominent
  identity** on the live sheet. The **chassis** (e.g. Goliath) and an optional stored **Source
  pattern** (the published pattern it was templated from, e.g. "Scrapjack Pattern") are secondary
  meta. _Internal / build note:_ the source pattern matters only at **creation** (what to template
  off) and can be saved in mech data; once created, all edits live on the mech. The current set of
  systems + modules can be **saved as a (new) pattern** for reuse.
- **Crawler bays are one type only** — a single "Crawler Bay"; **no crew/functional distinction**.
  All standard bays render together in one compact-entity-card grid; **homebrew / custom bays are
  grouped underneath**. On **desktop, the Storage Bay / inventory sits _beneath_ the bays grid**
  (full-width, stacked), not beside it.
- **Editing is "click-to-edit," scoped per container — no global edit mode, no always-open fields.**
  ITUN is local-first and auto-saves (no Save button). Each FIELD container (Identity, Description,
  etc.) owns its own **Edit** button that flips **only that container's** fields to inline-edit
  (reuse `InlineEditField`); fields render **read-only by default**. There is **no global top-bar
  Edit toggle**; never render open inputs on the default sheet.
- **Unified "Edit" design language — three interaction archetypes, mapped to data kind**, applied
  identically across all three sheets (**per-container edit — no global toggle**; one shared picker
  modal; one editing cue):
  1. **Add / Remove** — entity collections (Systems, Modules, Abilities, Equipment; also bays,
     weapons): the **Add** button is **always visible** in the container and **rule-gated** — enabled
     when the game rules allow (e.g. TP available, under `maxAbilities`, a free slot), disabled with a
     visible reason otherwise. Add opens the shared picker modal; remove (✕) / swap (⇄) sit per card.
     _(not behind a mode — rule-gated)_
  2. **Click-to-edit field** — free text/values (pattern name, callsign, appearance, quirk,
     description, pools): the container's own **Edit** button reveals inline fields. _(per-container)_
  3. **Dots** — stats (HP/AP/SP/EP/Heat and level-like values): click a dot/pip to move the value to
     that point. This IS the **`StatBlock`** pip row — the same `StatBlock` component renders both
     live current/max stats and capacity stats. _(live-play — always interactive in the play view)_

## Fixed constraints

- Single accent per sheet from the existing `--tone` tokens (pilot orange / mech teal / crawler magenta).
- All game-data cards render via `ReferenceEntityDisplay` (SRD language untouched).
- Barlow / Barlow Semi Condensed typography.
- Live-play interactivity (gauges editable, conditions toggle) and the three modes
  (read-only snapshot / editable live-play / editing build) from `sheetViewProps.ts`.
- ADR-007 automation boundary, snapshot + print support.
- No changes to `srd` / the SRD reference display.

## Implementation phasing (after a direction is chosen)

1. **Shared shell primitives** — edge wordmark, poster grid in `LiveSheet` / `SheetHero`, and (if the
   chosen direction uses them) a gauge component in `component-lib` `components/stat/`.
2. **Pilot sheet** to spec (hero regions + body slabs re-gridded) as the reference implementation.
3. **Mech + Crawler** parity.
4. **Footer iconography** for ability/system cards (AP cost / action-type / rest) — shared, so
   regression-check `srd`.
5. **Responsive + print + snapshot** passes, `/a11y-scan`, full CI (`/validate`).

## Risks / open questions

- The two-column poster fights the current **condense-on-scroll sticky bar + mobile segmented
  switch** → each direction needs an explicit desktop-poster / mobile-stack strategy.
- A gauge component is a **shared** `stat/` change → regression-check `srd` (inert there
  without a `max`).
- Paper texture must stay CSP- and print-safe.
</content>
