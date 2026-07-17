# ITUN Dataviz Idioms (quantitative displays)

Confirmed pip/track/badge conventions across the stat surfaces. All live-play
readouts are read on phones mid-combat — glanceability is the metric.

## Pip primitives (`packages/component-lib/src/components/stat/`)

- 1 pip == 1 unit EVERYWHERE (SP/EP/Heat/cargo/slot) — magnitude is consistent
  across contexts. Pip weight is 1.5px everywhere (StatBlock hardcodes
  `border-[1.5px]`; ITUN pips use the `border-chrome` utility = `--bw-chrome`
  1.5px). MiniStat pips are 7px @ 1.25px border (condensed strip only).
- `pipRows.ts`: StatBlock track splits ≤6/row, bottom-heavy (7→3/4). Legacy
  board `.pips` split is ≤5/row top-heavy — intentionally NOT unified (design §6.6).
- MiniStat renders pips only when the track fits ≤12 (`MINISTAT_PIP_MAX`),
  else number-only. StatBlock has no pip cap.

## Over-capacity = red pips past the cap (UNIFIED idiom)

Same encoding everywhere a soft cap can be exceeded: render `Math.max(max,value)`
pips, lit pips at index ≥ max get `border-status-bad bg-status-bad`, the number
reads red, never clamp the measurement. Present in:

- `mech/LoadoutPanel.tsx` BudgetTrack (wizard slots/energy)
- `sheet/StorageManifest.tsx` mech Hold capacity strip (`data-cpip="over"`)
- `stat/StatBlock.tsx` + `stat/MiniStat.tsx` — added in the dataviz pass so the
  hero Hold tracker + condensed-strip Hold MiniStat agree with the Hold panel
  (previously they CLAMPED = dishonest). StatBlock gate: `!isEditable && value>max`
  (catches read-only derived cargo + SYS/MOD slots; editable trackers stay
  clamped 0..max). MiniStat gate: `stat === 'cargo'` only (preserves the AP/HP
  clamp behaviour a test asserts).

## Heat escalation (`stat/heatLevel.ts`) — heat tone only

`high` at ≥70% of cap (lit pips past `heatDangerFrom` go red), `critical` at cap
(red border + `motion-safe:animate-heat-pulse`). StatBlock reddens pips+border
only; MiniStat also reddens the number. Inert without a positive max (srd).
Over-capacity red and heat-danger red compose in the same pip loop.

## Roll-result readouts — severity colour (dataviz pass)

Core-Mechanic d20 band colours (`--color-roll-*`: cascade=red, failure=orange,
tough=amber, success=green, nailed=blue) belong to QuickRollFab + ConditionToggle
ONLY (contrast map: white on dark fills, su-black on the ambers). Do NOT reuse
them for Heat Check / Critical Damage readouts — those are TABLE rolls (different
scale). Those readouts instead colour by SEVERITY of the outcome text:

- `HeatCheckControl.tsx` `resultTone()`: meltdown→status-bad, system/module-
  destroyed & overheat→rust, safe/passed→ink.
- `TakeDamageControl.tsx` `OUTCOME_TONE`: catastrophic→status-bad, system/module/
  core→rust, miraculous-survival→ink.
  Colour only reinforces (the text already names the outcome) — WCAG-safe.

## TL colour scale (`--color-tl-1..6,b,n`)

A real sequential blue ramp (tl-1 light 115,201,230 → tl-6 dark 6,52,65; b=green,
n=purple). USED by InstallStep TL FilterChips (`swatchStyle`). NOT used by the
crawler ScrapPoolSlab buckets (bronze `--cargo-deep`, TL encoded by T1..T6 label

- left→right order). Cross-surface TL colour is inconsistent but tinting the
  scrap buckets is a contrast trap (white text fails on light tl-1/tl-2) and bronze
  carries the scrap/cargo semantic — deferred, low priority.

## Deferred comparability gap

Wizard install (`InstallCard`/`LoadoutPanel`/`InstallStep`) shows current used/max
but NO "current → new (+delta)" preview when considering an item — the classic
dataviz comparability ask. Deferred: a signed-delta preview is a new component,
out of a refinement-only pass.
