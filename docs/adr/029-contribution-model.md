# ADR-029: Unified Contribution Model & Stat Provenance

The model is `packages/salvageunion-reference/lib/rules/contributions.ts` and
`lib/schemas/objects/contributions.ts`. Subordinate to
[ADR-021](021-cantina-surface-taxonomy.md).

### 1. One contribution model

A contribution is a **source**, an **operation** and a **target**, whether it
raises Max SP, adds Burn 1 or bumps damage:

```
Contribution {
  op        // the four cap keys, plus addTrait | removeTrait | setRange | addDamage
  target    // self | pilot | pilotedMech | crawler | <named item>
  amount    // an integer, or a small expression over tech level
  stacks    // per installed copy
  voidWhen  // damaged | destroyed — with the current-value clamp
  duration  // permanent (default) | activated (see §4)
}
```

**Any content type may declare contributions**: abilities, systems, modules,
bays, crawler types, equipment. **Do not fork the resolver**:
`resolveChoiceView.ts` applies trait, damage and range effects for every
surface. **Never infer a number from prose**: author it where the text states
one flatly, or record an exemption (§5).

### 2. Derivations return parts, not numbers

`StatBreakdown { contributions: Contribution[], derived, total, overridden }`;
each contribution carries a label, source kind, signed amount and, where one
exists, a ref to its source. Scalar functions (`mechMaxSP`, `pilotMaxHP`, …)
are thin `.total` wrappers.

### 3. Provenance is a property of the value, not of a surface

Any surface rendering a derived value can render its breakdown, opened on
**hover, focus and tap**. Frozen sheets show it without the revert. Play
carries it as Guided Play's "teach as they enforce" affordance: `VitalGauge`'s
compact rung takes `provenance` and `breakdown`, though Play's vitals
(`PlayVital`) do not pass them yet. An override appends; it never replaces.

### 4. Duration-bound effects are Play-applied, and never persisted on the entity

`duration: activated` contributions (Squeeze It In, Hull Magnetiser) are
switched on only by Play (a lifecycle transaction) and resolve against
the **pilot's seat on the Game** ([ADR-038](038-dashboard-game-surface.md) §2),
never the persisted entity. Reference data says *that* an effect is activated
and for how long; play state records *when*. The panel shows their remaining life.

### 5. The parity audit is the durable guarantee

A CI check scans every record whose text states a mechanical change (cap,
trait, damage, range) and requires **either** a structured contribution **or**
a reasoned exemption:

| Class                     | Example                                                 | Why exempt |
| ------------------------- | ------------------------------------------------------- | ---------- |
| Chassis-integrated        | "Integrated Cargo Bay: +10, **to 16**"                  | Already the chassis stat; encoding double-counts. |
| Current-pool effect       | Parasitic Membrane, Bite, Transfer                      | Moves a current pool; reads a cap without changing it. |
| Already-modelled mechanic | Rad Wave Generator → Major Injuries                     | The injury penalty handles it. |
| Effect-of-an-effect       | Mender: "+4 SP each time you heal"                      | Modifies another effect's output, not a stat. |
| Grant at a moment         | Pilot Bay: "a **one-off** improvement of +2 HP / +1 AP" | A transaction; as standing it re-applies forever. |

### 6. Rules-bearing prose is marked inline

In the app, which applies the rules, a rules-bearing paragraph leads with a
mini ink **AUTO** stamp whose title (and screen-reader text) says the app
applies it; the SRD prints plain prose. The app opts in through the entity
surface's `appliesRules`. Unmarked prose that states a number is a visible
coverage gap.
