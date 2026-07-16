# ADR-024: Entity Card Design Rules (the single reference-entity renderer)

## Status

Accepted.

## Context

The reference-entity display was reconciled from a 57-file legacy render core
(`ReferenceEntityDisplay/`, "RED") onto a single card. That migration
(methodology + staged plan in
[`docs/design/entity-card-reconciliation.md`](../design/entity-card-reconciliation.md))
settled a set of **design rules** along the way — about how choices render, how
stats read, how tech-level scaling looks, and which data carries a tech level.
Those rules were decided interactively and proven in Ladle, but were only
recorded in commit messages. This ADR enshrines them so they are not
re-litigated, and points at the Ladle stories that demonstrate each.

See also: [ADR-010](ADR-010-srd-choices-ephemeral-vs-persisted.md) (choices
ephemeral vs persisted), [ADR-021](ADR-021-itun-surface-taxonomy.md) (surface/mode
taxonomy — which surface may enforce vs. free-edit), [ADR-023](ADR-023-drone-equipment-installed-loadout.md)
(drone loadout).

## Decision

### 1. One renderer; `ReferenceEntityDisplay` is a compat shim

`ReferenceEntityCard` (`components/referenceEntity/card/`) is the **only**
reference-entity renderer. The barrel still exports `ReferenceEntityDisplay`, but
it is a thin **compat shim** that maps the legacy sugar (`mode` / `compact` /
`listing` → `size`; `status` → `damaged`; the old single-SV `statsOverride`
`{value, bottomLabel}` → `StatItem[]`) and forwards to the card. New code may call
either; there is no second card. The legacy RED core is deleted.

### 2. Entities always render as the card — layer UI on top

Never hand-assemble entity markup or replace the card to add app UI. Selection
halos, control buttons, status cycles, count-steppers, choice pickers, and the
tech-level stepper are **layered onto** the card (props / overlays), never a
substitute for it. (Universal rule; predates this ADR, restated here.)

### 3. Choices interweave by data shape, not special cases

A `choice` **content-block marker** (`ContentBlock.choiceId`, schema in
`salvageunion-reference`) positions a choice inline in the body where it belongs;
the renderer walks content and drops the choice group at its marker. Prefer
changing the _data shape_ over special-casing the renderer.

- **Read-only choices render SOLID** — every option at full strength (a static,
  readable list). The **dim-until-chosen** affordance is **editable-only**: an
  unchosen option is dimmed, the chosen option un-dims and gains a **"Chosen"
  stampseal** (no rust selection ring). Options are always a
  `button[aria-pressed]` so the chosen state stays queryable in both modes
  (read-only is inert).
- Demo: `Compositions/Reference Entity Write Layer` → **ChoiceEquipment**.

### 4. The stat atom has exactly two modes: Normal and Compact

A `StatDisplay` in the card cluster is either **Normal** (the vertical value box,
full labels) or **Compact** (the horizontal `[label | value]` cell, shortform
labels). **Compact IS horizontal** — there is no separate "horizontal" mode/axis.
Editable stats grow a `+/-` stepper column in either mode. Pips are never nested
inside a stat cell.

- Demo: `Atoms/Stat Display` → **Shapes** / **EditSteppers**.

### 5. "Modified stats" — the rust language

A stat/trait cell that a **choice touched** (e.g. picking a Weapon Type adds the
Ballistic trait; a Modification sets Range → Far) OR that **tech-level scaling
changed** gets the **rust "modified" border** (`--color-rust`); an added trait
also gets a rust label ground. The value itself updates. This applies to
**statblocks / `StatDisplay` cells only** — not `VitalGauge`.

- Demo: `Compositions/Reference Entity Write Layer` → **ChoiceEquipment** /
  **TechLevelScaling**.

### 6. Effective / editable tech level drives scaling

Some granted, TL-scalable pilot equipment (e.g. Custom Sniper Rifle) resolves an
**effective tech level** that drives its Modification-choice cap
(`constraints.scalesWithField: techLevel`) AND any `perTechLevel` datavalue
(e.g. "+1 SP damage per Tech Level after the first").

- Effective TL = `max(baseTL, effectiveTechLevel ?? scalingParent.techLevel ??
baseTL)` — it **floors at the entity's base TL** (a granted item is never below
  its own tech level; so a TL1 item with no crawler shows `0/1`, not unbounded).
- **Both contexts are supported** (a card may use either or both):
  **controlled from without** — pass `effectiveTechLevel` (the crawler level in
  ITUN, via `scalingParent`); the header TL reads it and Damage + cap reflect it,
  read-only. **Editable in place** — pass `onTechLevelChange`; the header "TL" cell
  becomes an editable `+/-` stepper.
- Damage scaling is resolved by `resolveDataValueForTechLevel` and surfaced with
  the rust "modified" border (rule 5).
- Demo: `Compositions/Reference Entity Write Layer` → **TechLevelScaling**.

### 7. Data rule: granted-only pilot equipment is TL1

Equipment that exists **solely to be granted** by an ability and has **no
standalone existence / no inherent rules tech level** (created by the ability —
"that only you can use" / "you have constructed…") is modeled at **TL1**. Its
granting ability's tier is not its tech level. Equipment that exists of its own
accord with a rules-based standalone tech level keeps that tech level. (Applied to
Custom Sniper Rifle, Holo Companion, Mecha Companion; the other grant-only pilot
equipment was already TL1.)

## Consequences

- The design rules are demonstrable and regression-guarded: each has a Ladle story
  (canonical groups `Compositions/Reference Entity *` and `Atoms/Stat Display`),
  and the story-coverage guard keeps every barrel-exported visual component
  storied.
- Rule 7 is a shared-data change: it changes the tech-level badge on suref-web /
  the Discord bot as well as ITUN. It is a data ruling, not a computed value —
  future granted-only equipment should be authored at TL1 directly.
- The compat shim (rule 1) is intentionally retained; there is no plan to rewrite
  every call site to the card's native API. It is the stable public entry.
