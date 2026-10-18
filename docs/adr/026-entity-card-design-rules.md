# ADR-026: Entity Card Design Rules (the single reference-entity renderer)

The full record behind [Decisions](../ARCHITECTURE.md#decisions) entry 26, which summarises it.

## Status

Accepted. **Amended (refresh tokens):** §5's "modified" border moved from rust
to a heavier solid ink frame when the rust allowlist (ruleset §3.1) reserved
rust for actions. It does not use the dash: ruleset §3.9 says canon is solid
and dashes mark homebrew and the edit state, and no board on the origin gives
the modified treatment a dash.
**Amended (EDL):** `ReferenceEntityCard` is the Card and Page form; lists,
prose and Peeks go through `src/components/entity/` (the
[entity display language](../design-system/entity-display-language.md)), whose
Peek draws this card at small size.

## Context

The reference-entity display was reconciled from a 57-file legacy render core
(`ReferenceEntityDisplay/`, "RED") onto a single card. That migration settled a set of **design rules** along the way — about how choices render, how
stats read, how tech-level scaling looks, and which data carries a tech level.
Those rules were decided interactively and proven in the story catalog (since deleted), but were only
recorded in commit messages. This ADR enshrines them so they are not
re-litigated; the card's and `Stat`'s tests now hold them.

See also: [ADR-010](../ARCHITECTURE.md#decisions) (choices
ephemeral vs persisted), [ADR-021](021-cantina-surface-taxonomy.md) (surface/mode
taxonomy — which surface may enforce vs. free-edit), [ADR-023](../ARCHITECTURE.md#decisions)
(drone loadout).

## Decision

### 1. One Card and Page renderer — `ReferenceEntityCard`

`ReferenceEntityCard` (`components/referenceEntity/card/`) is the **only**
renderer of a reference entity's Card and Page, with no compat shim in front of it: size is `size`,
damage is `damaged`, and stat overrides are `StatItem[]`. Call the card.

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

**Choice placement splits by kind:**

- **Freeform choices** (`source.kind: 'text'`, or no `source` — e.g. a
  companion's Name / a crawler's Keepsake / Motto) are **simple inputs**, inline
  in the body: editable, a text field; read-only, the chosen value as prose, or
  nothing when empty.
- **Multiple-choice choices** (`source.kind` is `table` / `options` / `catalog` /
  `systemVariant`, or `cardinality.max` is above one or `{ scalesWith }` —
  "choose from the list below") always render **inline in the body**, in both modes.

- **Read-only choices render SOLID** — every option at full strength (a static,
  readable list). The **dim-until-chosen** affordance is **editable-only**: an
  unchosen option is dimmed, the chosen option un-dims and gains a **"Chosen"
  stampseal** (no rust selection ring). Options are always a
  `button[aria-pressed]` so the chosen state stays queryable in both modes
  (read-only is inert).
### 4. The stat atom has one anatomy — and NO pips

A `Stat` is the label-first `[label | value]` chip; `size` picks its rung of the
sizing ladder. Editable stats grow a `+/-` stepper pair. The vertical value box
it once also drew was retired for chips (2026-10-14), crew-lead HP first.

**`Stat` has no pip mode.** A value/max tracker is the chip's `value /max` (a
fill bar is `VitalGauge`); individual pips live only in `VitalGauge`, never
inside a stat cell.

### 5. "Modified stats" — the heavier-frame language

A stat/trait cell that a **choice touched** (e.g. picking a Weapon Type adds the
Ballistic trait; a Modification sets Range → Far) OR that **tech-level scaling
changed** gets the **"modified" frame: a heavier solid ink frame** (`Stat`'s
`modified` state: the border plus a 1px ink ring). It was rust until the rust
allowlist (ruleset §3.1) reserved rust for actions, and it never takes the dash:
dashes are the pencil/override cue of the edit state and the homebrew cue
(ruleset §1, §3.9), and a canon stat on a read-only card must not wear them.
The value itself updates. This applies to **statblocks / `Stat`
cells only** — not `VitalGauge`.

### 6. Effective / editable tech level drives scaling

Some granted, TL-scalable pilot equipment (e.g. Custom Sniper Rifle) resolves an
**effective tech level** that drives its Modification-choice cap
(`cardinality.max.scalesWith: techLevel`) AND any `perTechLevel` datavalue
(e.g. "+1 SP damage per Tech Level after the first").

- Effective TL = `max(baseTL, scalingParent.techLevel ?? baseTL)` — it **floors
  at the entity's base TL** (a granted item is never below its own tech level; so
  a TL1 item with no crawler shows `0/1`, not unbounded).
- The level is **controlled from without**: the card takes `scalingParent` (the
  crawler level in the app); the header TL reads it and Damage + cap reflect it,
  read-only.
- Damage scaling is resolved by `resolveDataValueForTechLevel` and surfaced with
  the "modified" border (rule 5).
### 7. Data rule: granted-only pilot equipment is TL1

Equipment that exists **solely to be granted** by an ability and has **no
standalone existence / no inherent rules tech level** (created by the ability —
"that only you can use" / "you have constructed…") is modeled at **TL1**. Its
granting ability's tier is not its tech level. Equipment that exists of its own
accord with a rules-based standalone tech level keeps that tech level. (Applied to
Custom Sniper Rifle, Holo Companion, Mecha Companion; the other grant-only pilot
equipment was already TL1.)

## Consequences

- The design rules are regression-guarded by the card's and `Stat`'s own
  tests.
- Rule 7 is a shared-data change: it changes the tech-level badge on srd /
  the Discord bot as well as the app. It is a data ruling, not a computed value —
  future granted-only equipment should be authored at TL1 directly.
