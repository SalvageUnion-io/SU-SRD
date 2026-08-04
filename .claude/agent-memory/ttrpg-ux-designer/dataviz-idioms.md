# ITUN Dataviz Idioms (quantitative displays)

Pip/track/readout conventions across the stat surfaces. All live-play readouts
are read on phones mid-combat — glanceability is the metric.

> **Rebuilt 2026-08-03 after an audit.** The previous version was written
> against components that no longer exist (`StatBlock`, `MiniStat`,
> `BudgetTrack`, `QuickRollFab`, `FilterChip`, `resultTone`, `OUTCOME_TONE`,
> `data-cpip`). The _idioms_ below survived the refactor; the component names
> did not. Confirm any name against `packages/component-lib/src/index.ts` before
> repeating it.

## The segment-state core (`stat/pipRows.ts`)

One shared logic module. `VitalGauge` (full-width bars) is the only segment
_track_ left — `Stat` has **no** pip mode; pip trackers were retired in favour
of the value box. The row-split helper is shared more widely: `SlotGrid`,
`BayStatus` and `EntitySearcher` all lay out on `statBlockRowStarts`. Each
surface keeps its own styling; only the logic is shared.

Note the module's own header comment still describes a `Stat` pip tracker — it
is stale; read the imports, not the comment.

- `trackSegmentState(index, value, max, dangerFrom)` → `'off' | 'on' | 'danger'`.
  `'off'` = unlit, `'on'` = lit, `'danger'` = lit but past the cap
  (over-capacity) **or** past the heat redline. `dangerFrom` defaults to
  `Infinity` (never).
- `statBlockRows(n)` / `statBlockRowStarts(n)` — the ≤6-per-row, bottom-heavy
  split (7 → 3/4).
- `pipClickValue(index, value)` — click-to-set semantics for editable tracks.
- 1 pip == 1 unit **everywhere** (SP/EP/Heat/cargo/slot). Magnitude is
  consistent across contexts; only density changes.

## Over-capacity = red segments past the cap (unified)

Never clamp the measurement. Render `Math.max(max, value)` segments; anything
lit at index ≥ max reads `status-bad` red, and the numeral reads red with it.
This is why `trackSegmentState` folds over-capacity and heat-danger into one
`'danger'` state — the two reds compose in the same loop rather than fighting.

Clamping was the old behaviour and it was dishonest: it hid the exact condition
the player needed to see.

## Heat escalation (`stat/heatLevel.ts`)

`heatDangerFrom(max)` returns the first 0-based pip index that reads danger —
`ceil(max * 0.7) - 1`, i.e. ~70% of cap. Pass it as a track's `danger` prop.
Inert without a positive max (so SRD reference cards stay neutral).

`heatLevel` / `HeatLevel` / `HEAT_HIGH_RATIO` were removed from the barrel; only
`heatDangerFrom` survives. The `--animate-heat-pulse` keyframe exists in
`theme.css` but **no component applies it** — the colour escalation shipped, the
pulse did not.

## Roll-result colour — scope it

`--color-roll-*` (cascade = red, failure = orange, tough = amber, success =
green, nailed = blue) is the **Core-Mechanic d20 band** scale. `status-warn` and
`status-bad` are aliases of `roll-failure` and `roll-cascade`, so the state
palette and the roll palette are deliberately the same warm ramp.

Do **not** reuse the band colours for table rolls (Heat Check, Critical Damage)
— those are a different scale. Colour those readouts by **severity of the
outcome**: meltdown / catastrophic → `status-bad`; a destroyed system, module or
core → `rust`; safe / survived → `ink`. Colour only reinforces; the text already
names the outcome, so the readout stays WCAG-safe without it.

Contrast map for saturated fills: white text on the dark fills, ink on the
ambers.

## TL colour scale (`--color-tl-1..6`, `-b`, `-n`)

A real sequential blue ramp (tl-1 light `115,201,230` → tl-6 dark `6,52,65`),
plus `tl-b` green (Bio) and `tl-n` purple (Nanite) for the non-numeric tiers.
Keys are lowercase so `var(--color-tl-${tl})` interpolation stays case-stable.

Consumed by the shared `EntitySearcher` facet rail via `tlSwatch(tl)` → a
`Badge` `swatch`. The crawler scrap buckets deliberately do **not** tint by TL:
white text fails on light tl-1/tl-2, and bronze carries the scrap/cargo
semantic. Cross-surface TL colour is knowingly inconsistent; deferred, low
priority.

## Deferred comparability gap

The mech wizard's install surfaces show current used/max but no
"current → new (+delta)" preview when considering an item — the classic
comparability ask. A signed-delta preview is a new primitive, so it has stayed
out of refinement-only passes.
