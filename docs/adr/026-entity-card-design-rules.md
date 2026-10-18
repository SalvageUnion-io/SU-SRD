# ADR-026: Entity Card Design Rules (the single reference-entity renderer)

Lists, prose and Peeks go through `src/components/entity/` (the
[entity display language](../design-system/entity-display-language.md)); these
rules govern the Card and Page, and the card's and `Stat`'s tests hold them.

### 1. One Card and Page renderer — `ReferenceEntityCard`

`ReferenceEntityCard` (`components/referenceEntity/card/`) is the **only**
renderer of a reference entity's Card and Page, with no compat shim: size is
`size`, damage is `damaged`, stat overrides are `StatItem[]`.

### 2. Entities always render as the card — layer UI on top

Selection halos, controls, status cycles, steppers, choice pickers and the
tech-level stepper are **layered onto** the card, never a substitute for it.

### 3. Choices interweave by data shape, not special cases

A `choice` content-block marker (`ContentBlock.choiceId`) places a choice
inline in the body; prefer changing the data shape over special-casing the
renderer.

- **Freeform choices** (`source.kind: 'text'`, or no `source`) are simple
  inputs inline in the body: editable, a text field; read-only, the value as
  prose, or nothing when empty.
- **Multiple-choice choices** (`source.kind` `table` / `options` / `catalog` /
  `systemVariant`, or `cardinality.max` above one or `{ scalesWith }`) render
  inline in the body in both modes.
- **Read-only choices render solid**, every option at full strength.
  Dim-until-chosen is editable-only: the chosen option un-dims and gains a
  **"Chosen"** stampseal. Options are always `button[aria-pressed]`.

### 4. The stat atom has one anatomy — and NO pips

A `Stat` is the label-first `[label | value]` chip; `size` picks its rung.
Editable stats grow a `+/-` stepper pair. A value/max tracker is the chip's
`value /max` (a fill bar is `VitalGauge`); pips live only in `VitalGauge`.

### 5. "Modified stats" — the heavier-frame language

A stat or trait cell a **choice touched** or **tech-level scaling changed**
wears `Stat`'s `modified` state: a heavier solid ink frame (border plus a 1px
ink ring), never rust (reserved for actions) and never a dash (edit state and
homebrew). The value itself updates. Statblocks and `Stat` cells only, not
`VitalGauge`.

### 6. Effective / editable tech level drives scaling

Granted, TL-scalable pilot equipment (Custom Sniper Rifle) resolves an
**effective tech level** = `max(baseTL, scalingParent.techLevel ?? baseTL)`,
driving its Modification-choice cap (`cardinality.max.scalesWith: techLevel`)
and any `perTechLevel` value (`resolveDataValueForTechLevel`), shown with the
§5 frame. The card takes `scalingParent` (the crawler level in the Cantina).

### 7. Data rule: granted-only pilot equipment is TL1

Equipment that exists **solely to be granted** by an ability, with no
standalone tech level, is authored at **TL1** (the ability's tier is not its
TL). Equipment with a standalone tech level keeps it.
