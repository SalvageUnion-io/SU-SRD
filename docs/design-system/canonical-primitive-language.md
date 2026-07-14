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

## 2. The primitive catalog (post-merge)

Every merged component collapses into one file with a prop-controlled API. Old
exports become thin deprecated aliases during migration, then are deleted.

| Component           | File (`packages/suref-react/src/…`)   | Absorbs                                                                                         | Key props                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stamp**           | `components/chrome/Stamp.tsx`         | `base/Text` pseudoheader                                                                        | `size` · `surface` (on-tone / on-ink / inverse) · `as`                                                                                                                                                                                               |
| **StatDisplay**     | `components/stat/StatDisplay.tsx`     | StatControl · StatBlock · **MiniStat (dropped)** · ValueDisplay · Field/Input · InlineEditField | `label` · `value` · `max` (bottom label, bigger) · `bottomLabel` · `mode` (read/edit → edit adds steppers) · **`dots`** (default `false` → box goes rectangular) · `orientation` (vertical / horizontal = ValueDisplay) · `tone` · `min` · `inverse` |
| **VitalGauge**      | `components/stat/VitalGauge.tsx`      | DashboardGauge                                                                                  | `label` · `value` · `max` · `danger` · `editable` · `skin` (sheet / instrument) · `dense` · `tone`                                                                                                                                                   |
| **Badge**           | `components/chrome/Badge.tsx`         | Tag · Pill · Chip · CalloutMetaStamp · StatusBadge shell · cost-pennant · Range · TL            | `form` (label / label+value) · `surface` (solid / ghost / tone / quiet) · `shape` (chip / pennant / pill) · `tone`                                                                                                                                   |
| **Btn**             | `components/chrome/Btn.tsx`           | FilterChip · Sel                                                                                | `variant` (primary / secondary / ghost / danger / control) · `size` · `disabled`                                                                                                                                                                     |
| **Slab**            | `components/chrome/Slab.tsx`          | SectionChead · SectionSeparator                                                                 | `label` · `variant` (dashed / solid) · `count` · `actions`                                                                                                                                                                                           |
| **DisplayCard**     | `components/shared/DisplayCard.tsx`   | the card shell + tabs                                                                           | `tone` · `mode` (full / compact / head / tooltip / instrument) · `tabs` · `footMeta` · `footActions` · `spine`                                                                                                                                       |
| **RollTable**       | `components/shared/RollTable.tsx`     | —                                                                                               | `table` · `showCommand` · `onRollResult`                                                                                                                                                                                                             |
| **ConditionSwatch** | `components/stat/ConditionSwatch.tsx` | StatBlock TALLY · ConditionToggle glyph                                                         | `state` (intact / damaged / destroyed) · `interactive`                                                                                                                                                                                               |
| **SlotGrid**        | `components/shared/SlotGrid.tsx`      | StorageManifest cargo pips                                                                      | `used` · `cap` · `scale` (pip / sheet)                                                                                                                                                                                                               |
| **Modal**           | `components/ui/ModalShell.tsx`        | ConfirmDialog · SelectorDialog · SheetPicker                                                    | `title` · `tone` (action / danger) · `footer`                                                                                                                                                                                                        |
| **Tooltip**         | `components/ui/Tooltip.tsx`           | keyword / distance tips                                                                         | `title` (SeamStamp) · `content`                                                                                                                                                                                                                      |
| **Toast**           | `components/ui/Toaster.tsx`           | —                                                                                               | `status` · `message`                                                                                                                                                                                                                                 |
| **EmptyState**      | `components/chrome/EmptyState.tsx`    | ad-hoc empties                                                                                  | `headline` · `body` · `action`                                                                                                                                                                                                                       |
| **Skeleton**        | `components/skeleton/Skeleton.tsx`    | card / list skeletons                                                                           | `mode` · `rows`                                                                                                                                                                                                                                      |
| **InlineRef**       | `components/chrome/InlineRef.tsx`     | `parseTraitReferences`                                                                          | `resolved` · `href`                                                                                                                                                                                                                                  |
| **Icons**           | `components/chrome/glyphs.tsx`        | action-type · pennant · X                                                                       | `name` (currentColor)                                                                                                                                                                                                                                |

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
