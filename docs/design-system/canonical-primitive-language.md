# Canonical Primitive Language — Design System & Migration Plan

> **Status:** Plan / design record. This document is the plan for unifying the
> SU-SRD UI onto **one canonical primitive language** — no more "legacy vs
> canon." Every surface (suref-web, in-the-union-now, suref-react) conforms to
> the same vocabulary, tokens, and prop APIs described here.
>
> **Companion:** the visual codex (live before/after + variant gallery + prop
> tables) is the design artifact:
> <https://claude.ai/code/artifact/21df6224-cb0d-4520-a411-10f5646b4cf7>.
> Read it for the rendered examples; this doc is the buildable plan.
>
> **The governing laws** — context laws, the rendering matrix, foundations, the
> irreducible atom set, the merge map, and the value-cell / StampSeam laws — are
> the comprehensive ruleset in [`ruleset.md`](./ruleset.md). This doc is the
> _build order_; that doc is the _rules_. Where they disagree, the ruleset wins.

---

## 1. The principle

There is **one** canonical language. The "older entity-display vs newer
design-spec chrome" split was the analysis lens that got us here; the target is a
single vocabulary that every component conforms to. When this plan is done, the
words "legacy" and "canon" no longer describe our components — they are all just
**the design system.**

Guiding laws (all already visualised in the codex):

- **The ink Stamp** is the one label/header atom. Tracking `0.04em` everywhere.
- **StampSeam** — a stamp may ride a container's border line (self-height-centred,
  never fixed `-mb-2` margins). Used on value wells, card callouts, and (to save
  space) on badges/ValueDisplays and tooltip titles.
- **One paper.** Reading surfaces are the **system white `--color-paper` = #fbfaf7**
  (not pure white, not cream). Pure white survives only inside stamps and the
  ValueDisplay value cell.
- **One action colour** — `--color-rust` (#a85222). Hue encodes ontology; state is
  a treatment overlay (redline / strike / X), never a second hue.
- **State palette re-toned warm** (off stock Material): `status-bad #b0432b`,
  `warn #c07a2f`, `ok #6f8a4a`. Roll-tier outcome colours are **Discord-bot-only**
  and also re-toned; the web never colours roll outcomes. **No gradients.**
- **Border weights** are tokens only (`--bw-entity/rail/pill/chrome/hairline`),
  one meaning per weight, holding in both the light sheet and dark instrument.
- **Pip-row split** (gauges + statblocks): max 5 per row, balanced —
  `rows = ceil(n/5); base = floor(n/rows); extra = n % rows → extra rows of
(base+1), then the rest of base` (6→3+3, 8→4+4, 10→5+5).

---

## Progress

Landed on the `worktree-entity-card-capture` branch (PR #466), each increment
green (typecheck 0 · suref-react + ITUN tests · both apps build) and behind the
draft PR pending your screenshot review of the visual deltas:

- **Phase 0 — foundations.** One tokenset: the caps-tracking ladder and the
  semantic border-width `@utilities` promoted into suref-react and deleted from
  ITUN; `--color-paper` → `#fbfaf7`; warm roll/status re-tone. _(Reinvented
  `border-hairline` caught + removed — native `border` is already 1px.)_
- **Phase B — token sweep.** 26 tracking + 28 border drifting arbitraries
  migrated onto the canonical tokens (exact matches only; residuals catalogued).
- **StatDisplay fusion (complete).** The stat cluster is now ONE component.
  `StatDisplay` (`components/shared/StatDisplay.tsx`) renders four anatomies from
  one clean API and **StatControl, ValueDisplay, MiniStat, and StatBlock are
  deleted** (files + tests + barrel exports), with every consumer migrated and
  no aliases:
  - `mode="edit"` → the box + `+`/`−` steppers (was **StatControl**)
  - `orientation="horizontal"` → the black/white `[label | value]` (was **ValueDisplay**)
  - `orientation="horizontal"` + `dots` → the condensed inline `[label · pips · value]` chip (was **MiniStat**)
  - `dots` (or `states[]`) → the framed tracker: code tab, numeral + steppers, pip track / bay tally, unit bar, tones + heat (was **StatBlock**)
  - default → the centred value box

- **Irreducible atoms + follow-ups built.** The remaining net-new atoms now
  exist as conformant, tested primitives with real-SRD Ladle stories: **Stamp**
  (`chrome/Stamp.tsx`) + the **StampSeam** placement util, **ConditionSwatch**
  (`stat/ConditionSwatch.tsx` — its extraction removed the old `linear-gradient`
  swatch fills, fixing a no-gradient-law defect), **SlotGrid**
  (`shared/SlotGrid.tsx`), **Glyph** (`chrome/glyphs.tsx`), the unified **Badge**
  (`chrome/Badge.tsx` — `Tag`/`Pill`/`Chip` now delegate to it as named presets,
  one implementation), **EmptyState** (`chrome/EmptyState.tsx`), **InlineRef**
  (`chrome/InlineRef.tsx`), and a generic **Skeleton** (`skeleton/Skeleton.tsx`).
  _Remaining consolidation: migrate call sites off the `Tag`/`Pill`/`Chip`
  presets to `Badge` directly, then retire the presets (plan phase 4)._
- **Ladle catalog reorganized to mirror the codex** (`.ladle/config.mjs`
  `storyOrder`): read top-to-bottom as **Codex → Foundations → Atoms →
  Compositions → Containers → Reference Entity**, one gallery per atom with every
  prop/variant on real SRD data.

**Visual-review checklist (draft PR):** paper flip to `#fbfaf7`; warm state
re-tone (damaged/destroyed reads a warm brick red); suref-web gaining
`tracking-caps` where it was previously a silent no-op; and the fused
StatDisplay renders (all four anatomies) via the Ladle stories.

### Centralized Ladle catalog

Every primitive now has a story under one **`Primitives/*`** namespace
(`bun run ladle`) — a dev-tool catalog living centrally in
`packages/suref-react/src/stories/primitives/` (Badges · Buttons · Chrome ·
VitalGauge) plus the retitled StatDisplay / DisplayCard / RollTable / Stamp&Text
/ Tooltip / Toaster / ActivationCostBox. Stories only render the shipped
components, so the catalog is ground truth. `ladle build` passes.

### Known deviations — RESOLVED

These catalog-surfaced off-system spots have been reconciled:

- **FilterChip is on the chrome token system** ✅ — active = `bg-ink text-paper`,
  inactive = `bg-paper text-ink hover:bg-wk-bg-2`, with the shared
  `ring-rust/25` focus ring (matching Btn / Sel / StepBtn / MiniBtn). The
  `su-orange` outline and grey inactive fill are gone.
- **One status rendering** ✅ — `StatusBadge` now delegates to `Badge` (surface
  `tone`), so the entity `intact/damaged/destroyed` vocabulary maps onto the one
  shared `ok/warn/bad` badge; no second implementation.
- **Ghost ring is an ink token** ✅ — the Tag/Badge `ghost` surface uses
  `ring-1 ring-inset ring-ink/20`, not a raw `rgba()` inset shadow.
- **One radius scale** ✅ — `--radius-pip/badge/card/panel` (1 / 2 / 3 / 6 px) in
  `theme.css` generate `rounded-pip/badge/card/panel`, registered in `cn()`; every
  `rounded-[Npx]` across the primitives migrated. Stamps stay square.
- **Input focus ring** ✅ — `ring-rust/[0.22]` → the shared `ring-rust/25`.
- **One type scale** ✅ — the semantic ladder (`--text-nano … --text-lede`)
  promoted from ITUN-local into the suref-react `@theme`, generating
  `text-nano … text-lede` on every surface; matching arbitrary `text-[Npx]` in
  the primitives migrated (`text-[11px]` → `text-badge`, etc.).
- **One radius scale** ✅ and **pure white retired** ✅ — see the paper flip
  above; `su-white` is removed, paper is the only light surface.

_Remaining nits, not per-component deviations: the one-off `border-[1.25px]` on
the sm pip, and the `Slab` leader treatments (dashed `repeating-linear-gradient`,
solid `border-ink/35`) — deliberate control-panel shapes on ink tokens, kept._

## 2. The primitive catalog (post-merge)

Every merged component collapses into one file with a prop-controlled API. Old
exports become thin deprecated aliases during migration, then are deleted.

| Component           | File (`packages/suref-react/src/…`)   | Absorbs                                                                                                               | Key props                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stamp**           | `components/chrome/Stamp.tsx`         | `base/Text` pseudoheader                                                                                              | `size` · `surface` (on-tone / on-ink / inverse) · `as`                                                                                                                                                                                               |
| **StatDisplay** ✅  | `components/shared/StatDisplay.tsx`   | StatControl · StatBlock · MiniStat · ValueDisplay — **all fused + deleted**. (Field/Input · InlineEditField deferred) | `label` · `value` · `max` (bottom label, bigger) · `bottomLabel` · `mode` (read/edit → edit adds steppers) · **`dots`** (default `false` → box goes rectangular) · `orientation` (vertical / horizontal = ValueDisplay) · `tone` · `min` · `inverse` |
| **VitalGauge**      | `components/stat/VitalGauge.tsx`      | DashboardGauge                                                                                                        | `label` · `value` · `max` · `danger` · `editable` · `skin` (sheet / instrument) · `dense` · `tone`                                                                                                                                                   |
| **Badge**           | `components/chrome/Badge.tsx`         | Tag · Pill · Chip · CalloutMetaStamp · StatusBadge shell · cost-pennant · Range · TL                                  | `form` (label / label+value) · `surface` (solid / ghost / tone / quiet) · `shape` (chip / pennant / pill) · `tone`                                                                                                                                   |
| **Btn**             | `components/chrome/Btn.tsx`           | FilterChip · Sel                                                                                                      | `variant` (primary / secondary / ghost / danger / control) · `size` · `disabled`                                                                                                                                                                     |
| **Slab**            | `components/chrome/Slab.tsx`          | SectionChead · SectionSeparator                                                                                       | `label` · `variant` (dashed / solid) · `count` · `actions`                                                                                                                                                                                           |
| **DisplayCard**     | `components/shared/DisplayCard.tsx`   | the card shell + tabs                                                                                                 | `tone` · `mode` (full / compact / head / tooltip / instrument) · `tabs` · `footMeta` · `footActions` · `spine`                                                                                                                                       |
| **RollTable**       | `components/shared/RollTable.tsx`     | —                                                                                                                     | `table` · `showCommand` · `onRollResult`                                                                                                                                                                                                             |
| **ConditionSwatch** | `components/stat/ConditionSwatch.tsx` | StatBlock TALLY · ConditionToggle glyph                                                                               | `state` (intact / damaged / destroyed) · `interactive`                                                                                                                                                                                               |
| **SlotGrid**        | `components/shared/SlotGrid.tsx`      | StorageManifest cargo pips                                                                                            | `used` · `cap` · `scale` (pip / sheet)                                                                                                                                                                                                               |
| **Modal**           | `components/ui/ModalShell.tsx`        | ConfirmDialog · SelectorDialog · SheetPicker                                                                          | `title` · `tone` (action / danger) · `footer`                                                                                                                                                                                                        |
| **Tooltip**         | `components/ui/Tooltip.tsx`           | keyword / distance tips                                                                                               | `title` (SeamStamp) · `content`                                                                                                                                                                                                                      |
| **Toast**           | `components/ui/Toaster.tsx`           | —                                                                                                                     | `status` · `message`                                                                                                                                                                                                                                 |
| **EmptyState**      | `components/chrome/EmptyState.tsx`    | ad-hoc empties                                                                                                        | `headline` · `body` · `action`                                                                                                                                                                                                                       |
| **Skeleton**        | `components/skeleton/Skeleton.tsx`    | card / list skeletons                                                                                                 | `mode` · `rows`                                                                                                                                                                                                                                      |
| **InlineRef**       | `components/chrome/InlineRef.tsx`     | `parseTraitReferences`                                                                                                | `resolved` · `href`                                                                                                                                                                                                                                  |
| **Icons**           | `components/chrome/glyphs.tsx`        | action-type · pennant · X                                                                                             | `name` (currentColor)                                                                                                                                                                                                                                |

`StatBlock` is a StatDisplay with `dots`; it is a **48px square** box by default,
going rectangular only when `dots` add chips (or in the horizontal form).
`StatControl` is `mode="edit"`: ink `+`/`−` buttons with a fill (invert-on-hover),
stretched to and flush with the box. `MiniStat` is **dropped entirely**.

---

## 3. Codify the foundations (`theme.css`)

One PR, pixel-safe where possible:

- `--color-paper: #fbfaf7` (the system white). Retire `bg-su-white` / `bg-white`
  from reading surfaces; keep white only for stamp text + the ValueDisplay value
  cell.
- Wire the dead `--bw-entity/rail/pill/chrome` tokens; add `--bw-hairline: 1px`.
  Promote ITUN's `@utility border-*` block into suref-react.
- Promote `--tracking-label: 0.04em` (+ display `0.01`, eyebrow `0.22`) into
  suref-react; retire the 8 drifting tracking values.
- Re-tone the status / roll tokens to the warm palette (`status-bad #b0432b`,
  `warn #c07a2f`, `ok #6f8a4a`; roll tiers add `tough #c19a3e`, `nailed #4b86a0`).
  Exact hex pending sign-off.
- Add the pip-split helper (`pipRows(n)`) next to `heatDangerFrom`.
- Ink-opacity ramp (`--ink-75/50/30/12/8`) for hairlines, placeholders, ghosts.

---

## 4. Migration phases

Each phase is independently shippable; `bun run check:all` + per-surface
screenshots gate anything with a visible delta.

0. **Foundations** — the `theme.css` changes in §3. Mostly token wiring.
1. **Atoms** — build/refactor to the unified prop APIs: Stamp, Frame recipe,
   Badge, **StatDisplay** (absorb StatControl/StatBlock/MiniStat/ValueDisplay/
   Field), **VitalGauge** (absorb DashboardGauge), Btn. Ship `StampSeam` as the
   shared placement utility and `pipRows` for the gauge/statblock tracks.
2. **Deprecate-in-place** — keep old exports (`StatBlock`, `MiniStat`,
   `ValueDisplay`, `StatControl`, `DashboardGauge`, `Tag`, `Pill`) as thin aliases
   forwarding to the new props, so nothing breaks mid-migration. `MiniStat` alias
   maps to nothing renderable — flag its call sites for removal.
3. **Ladle catalog** — one story per primitive (a browsable catalog). Today only
   `Theme.stories.tsx` exists; add `StatDisplay.stories` (every variant row from
   the codex), `Badge`, `VitalGauge`, `DisplayCard`, `RollTable`, `Modal`, …
   Keep the Ladle `bun patch` intact ([[ts7-upgrade-ts6-footholds]]).
4. **Migrate consumers** — grep the call sites across suref-web + ITUN; swap to
   the unified props (StatBlock → StatDisplay `dots`, ValueDisplay →
   `orientation="horizontal"`, DashboardGauge → VitalGauge `skin="instrument"`,
   Tag/Pill → Badge). Remove the aliases when clean. This is where "legacy/canon"
   disappears.
5. **Containers** — Modal, Tooltip (SeamStamp title), Toast, EmptyState,
   Skeleton, Tabs, Divider, SlotGrid, InlineRef, Icons to the same discipline.
6. **Guardrails** — `check:borders` / `check:colors` in `check:all`: no raw
   hex / rgb (tokens only), border-weight tokens only, tracking `0.04`, off-white
   paper, rust = the one action colour. A shared exemption file for the few
   sanctioned literals.
7. **Design sprint — next layer up** — compose the atoms into the higher-level
   shared primitives: full entity cards (`ReferenceEntityDisplay`, `SheetHero`),
   roster / listing rows, the dashboard instruments — each a **composition of
   catalog atoms**, no new one-offs.

---

## 5. Constraints (unchanged)

Local-first, strict CSP (no CDN / eval), Tailwind v4 (CSS-configured),
`suref-react` ships TS source (no build step), Barlow inlined. The **logo** is
off-limits. The **wizards** inherit primitive updates only — no wizard-specific
anatomy ships, and the wizard step-card `--tone-card` palette (pilot blue / mech
rust / crawler peach) is a named exemption from hue=ontology
([[wizard-info-colors]]). Copy stays 1:1 with real SRD data.
