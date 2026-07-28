# ADR-029: Unified Contribution Model & Stat Provenance

## Status

**Proposed.** Subordinate to [ADR-021](ADR-021-itun-surface-taxonomy.md) (the
governing surface/mode taxonomy) and paired with the amendment to
[ADR-022](ADR-022-provenance-log-and-overrides.md) that makes a cap override an
absolute pin. Extends the "modified stats" rust language of
[ADR-026](ADR-026-entity-card-design-rules.md) from stat cells to prose.

## Context

Two problems were found together, and they share one cause.

**1. Content cannot declare what it does.** The dataset has _two_ mechanisms for
saying "this thing changes that number", and neither is reachable from an
ability:

|                  | Engine A                                                           | Engine B                                           |
| ---------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| Field            | `statBonus` (`MechStatBonusSchema`)                                | `effects` (`ChoiceEffectSchema`)                   |
| Vocabulary       | `structurePoints`, `energyPoints`, `heatCapacity`, `cargoCapacity` | `addTrait`, `removeTrait`, `setRange`, `addDamage` |
| Declared on      | systems, modules                                                   | `choices[].choiceOptions[]` only                   |
| Applied by       | `rules/derivedStats.ts`                                            | `resolveChoiceView.ts`                             |
| Records using it | 8                                                                  | a handful of choice-bearing granted equipment      |

`AbilitySchema` carries neither. So Beefcake ("Any Mech you Pilot increases its
Max Structure Points by 3+X … your Pilot increases their Max Hit Points by 2"),
Bionic Arms, Bionic Legs and Modular Face Implant are inert prose — the numbers
on the sheet are simply wrong for any pilot holding them. The content type most
likely to modify a character is the one type that can declare nothing.

A survey of the core book plus the three expansions found **23 records whose
text changes a maximum** (9 encoded, 5 stated-but-unapplied, 9 correctly
excluded) and a further **~21 that change a trait, damage value or range**.

One case is a plain defect rather than a schema gap: **Composite Armour** states
"increases your Mech's Max SP by 5 for each Composite Armour System you have
installed" — exactly the shape `statBonus.structurePoints` exists for — and
carries no `statBonus` at all.

**2. No derived value can explain itself.** Every maximum is computed as a flat
sum that returns a bare `number`, so nothing downstream can say _why_ it is that
number. The single exception is `crawlerMaxSPParts`, which returns
`{ base, typeBonus, modifier, total }` and is rendered on exactly one screen (the
crawler wizard, as "20 + 5 type bonus (Battle) = 25"). The shape to generalize
already exists and is already proven; it is used once.

These are one problem. A contribution that cannot be _declared_ also cannot be
_attributed_, and a value assembled from anonymous addends cannot be explained.

## Decision

### 1. One contribution model

**A single vocabulary replaces both engines.** A contribution is a **source**, an
**operation**, and a **target** — regardless of whether the operation raises Max
SP, adds Burn 1, or bumps damage by 1.

```
Contribution {
  op        // the four cap keys, plus addTrait | removeTrait | setRange | addDamage
  target    // self | pilot | pilotedMech | crawler | <named item>
  amount    // an integer, or a small expression over tech level
  stacks    // per installed copy (the existing statBonus semantic)
  voidWhen  // damaged | destroyed — with the current-value clamp
  duration  // permanent (default) | activated (see §4)
}
```

**Any content type may declare contributions** — abilities, systems, modules,
crawler bays, crawler types, equipment. Ability parity is the point of the
exercise; a schema in which abilities are second-class is the bug.

**Do not fork the resolver.** `resolveChoiceView.ts` already applies
trait/damage/range correctly, including upgrading a duplicate trait's magnitude
(Explosive 1 → 2), and is already shared by srd and ITUN. This ADR widens where
effects may be **declared**; how they are **applied** is left alone.

**"Never infer a number from prose" survives.** The existing instruction on
`MechStatBonusSchema` is correct and is promoted to govern the whole model. The
remedy for an unencoded record is **authoring** the number where the text states
one flatly, or recording an explicit exemption — never inference. See §5.

### 2. Derivations return parts, not numbers

Every derivation returns a breakdown generalizing the existing
`crawlerMaxSPParts` shape:

```
StatBreakdown { contributions: Contribution[], derived, total, overridden }
```

Each contribution carries a **label**, a **source kind**, a **signed amount**,
and — where it exists — a **ref** to the granting entity, so provenance UI can
link back to it. Existing scalar functions (`mechMaxSP`, `pilotMaxHP`, …) become
thin `.total` wrappers so no call site changes when this lands.

### 3. Provenance is a property of the value, not of a surface

Any surface that renders a derived value can render its breakdown. Concretely:
Live Sheet, Dashboard, partner cards (rendered in place since #590), Frozen
snapshot, wizard previews, and entity reference cards.

- The panel opens on **hover, focus _and_ tap**. Hover alone is unreachable by
  keyboard and on touch, and is not acceptable.
- **Frozen** shows the breakdown and never the revert — a published snapshot has
  no editing affordance ([ADR-010](ADR-010-srd-choices-ephemeral-vs-persisted.md)).
- **The Dashboard carries it.** `DashboardGauge` currently discards the
  override/breakdown props. Restoring them _is_ the "teach as they enforce"
  affordance [ADR-021](ADR-021-itun-surface-taxonomy.md) requires of Guided Play
  and the Dashboard presently lacks.
- **An override appends; it never replaces.** See the ADR-022 amendment.

### 4. Duration-bound effects are Dashboard-applied, and never persisted on the entity

Some contributions are temporary: Squeeze It In (+4 Cargo, 12 hours, stacks with
itself), Hull Magnetiser (Cargo += the mech's System Slot Value, 1 hour,
toggleable).

These are **in scope as `duration: activated` contributions**, with two hard
constraints:

- They are **applied only by the Dashboard** (Guided Play). No other mode may
  switch one on — activating an effect is a lifecycle transaction.
- They resolve against **ephemeral play state**, never the persisted entity, per
  [ADR-019](ADR-019-dashboard-play-state-ephemeral.md). Time does not enter the
  data layer; reference data declares _that_ an effect is activated and for how
  long, and play state records _when_.

The provenance panel shows them like any other contribution, annotated with
their remaining life ("Squeeze It In +4 — expires in 9h").

### 5. The parity audit is the durable guarantee

A CI check scans every reference record whose text states a mechanical change —
a cap, a trait, a damage value, a range — and asserts **either** a structured
contribution **or** an explicit, reasoned exemption. Exemption classes, each
established by a real record:

| Class                     | Example                                                 | Why exempt                                                                             |
| ------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Chassis-integrated        | "Integrated Cargo Bay: +10, **to 16**"                  | Already the absolute chassis stat (Mule is 16). Encoding it double-counts.             |
| Current-pool effect       | Parasitic Membrane, Bite, Transfer                      | Moves or restores a current pool; reads a cap without changing it.                     |
| Already-modelled mechanic | Rad Wave Generator → Major Injuries                     | Handled by the existing injury penalty.                                                |
| Effect-of-an-effect       | Mender: "+4 SP each time you heal"                      | Modifies another effect's output, not a stat. Out of the model.                        |
| Grant at a moment         | Pilot Bay: "a **one-off** improvement of +2 HP / +1 AP" | A transaction, not a standing modifier. Encoding it as standing re-applies it forever. |

The audit is what makes "content denotes what it claims" **stay** true across
future content drops, rather than being a one-time sweep that silently rots. It
is the first thing built and the last thing removed.

### 6. Rules-bearing prose is marked inline

On entity reference cards, the indicator that a contribution exists is rendered
**inline with the sentence that grants it**, not as a separate badge or footer
row. It extends the **rust "modified" language** already established by
[ADR-026](ADR-026-entity-card-design-rules.md) §5 for choice- and
scaling-touched stat cells, applying it to a prose span.

This is deliberate and does double duty:

- A reader sees _which clause_ the app actually understands, adjacent to the
  claim itself.
- Unmarked prose that plainly states a number becomes a **visible coverage gap in
  the product**, not only a CI failure. The parity backlog is legible to anyone
  reading a card.

Note ADR-026 §5 currently scopes the rust language to `Stat` cells and
explicitly not `VitalGauge`. This ADR does not change that; it adds a third
carrier (a prose span) alongside it.

## Consequences

- **Ability parity becomes possible at all.** Today it is not expressible, so no
  amount of data work fixes Beefcake.
- **One vocabulary, one provenance implementation.** The alternative — extending
  both engines separately — means two things to learn, two places to look when a
  number is wrong, and a third mechanism the first time someone needs an ability
  to grant a trait.
- **Ordering is forced.** The ADR-022 override amendment must land _before_ any
  automatic contribution, or a rules-legal bonus renders as a hand override. See
  that ADR for why.
- **The dataset gains authoring obligations.** Every future record stating a flat
  mechanical change must encode it or justify itself to the audit. This is the
  intended cost.
- **`resolveChoiceView` becomes load-bearing for more of the app**, which raises
  the value of its existing test coverage and the bar for changing it.
- Duration-bound effects introduce the first contributions whose value depends on
  play state rather than reference data alone. §4's constraints exist to stop
  that leaking into IndexedDB.

## Cross-references

- [ADR-021](ADR-021-itun-surface-taxonomy.md) — governing; which mode enforces what.
- [ADR-022](ADR-022-provenance-log-and-overrides.md) — the Change Log and stat
  overrides; amended by this work to make an override an absolute pin.
- [ADR-026](ADR-026-entity-card-design-rules.md) — entity card design rules; §5's
  rust "modified" language, extended here to prose.
- [ADR-019](ADR-019-dashboard-play-state-ephemeral.md) — ephemeral play state, the
  home of activated contributions.
- [ADR-006](ADR-006-pure-rules-logic.md) — rules as pure functions; breakdowns
  stay pure and side-effect-free.
- [ADR-010](ADR-010-srd-choices-ephemeral-vs-persisted.md) — the Frozen end of the
  display contract.
- [architecture/rules-engine-boundary.md](../architecture/rules-engine-boundary.md)
  — the authoritative mode × rule-class matrix.
