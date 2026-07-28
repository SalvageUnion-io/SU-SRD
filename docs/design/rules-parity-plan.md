# Rules Parity & Stat Provenance — Delivery Plan

> **Decisions live in the ADRs, not here.**
> [ADR-029](../adrs/ADR-029-contribution-model-and-stat-provenance.md) (the
> contribution model + provenance) and the
> [ADR-022 amendment](../adrs/ADR-022-provenance-log-and-overrides.md#amendment-2026-07-overrides-become-absolute-pins)
> (overrides become absolute pins) are authoritative. This document is the
> **delivery breakdown** — units, sizes, dependencies and definition of done.

## The problem in one paragraph

ITUN's derivation is sound and its Change Log is built, but content cannot
declare what it does and no derived value can explain itself. The dataset has two
modifier engines — `statBonus` for four mech maxima, and `ChoiceEffectSchema` for
traits/damage/range — and **neither is reachable from an ability**, so Beefcake,
Bionic Arms, Bionic Legs and Modular Face Implant are inert prose and the numbers
on the sheet are wrong for any pilot holding them. Separately, every maximum is a
flat sum returning a bare number, so nothing can say why `Max SP` is 25.

## Measured baseline

Surveyed against the core book (1.2) and the three expansions, verified directly
against the working tree.

| Finding                                                                   | Count |
| ------------------------------------------------------------------------- | ----: |
| Records whose text changes a **maximum**                                  |    23 |
| — correctly encoded (`statBonus` ×8, crawler `mutations` ×1)              |     9 |
| — **stated but never applied**                                            |     5 |
| — correctly excluded (chassis-integrated, current-pool, already-modelled) |     9 |
| Records that change a **trait, damage value or range**                    |   ~21 |
| Derivations that expose a breakdown (`crawlerMaxSPParts`, one screen)     |     1 |
| Change Log entries ever tagged `kind: 'transaction'`                      |     0 |
| Rules modules implemented, tested, and unreachable                        |     3 |

The five stated-but-unapplied: **Composite Armour** (a plain defect — its text
fits `statBonus.structurePoints` exactly and the field is simply absent), plus
**Beefcake**, **Bionic Arms**, **Bionic Legs** and **Modular Face Implant**,
which the schema cannot express at all.

Two traps worth carrying into the work, both verified:

- **Chassis-integrated bonuses are already absolute.** "Integrated Cargo Bay: +10,
  _to 16_" — the Mule's `cargoCapacity` **is** 16 (Gopher 12, Atlas 30). Backfilling
  these double-counts.
- **Not every stated number is a cap modifier.** Mender's "+4 SP each time you
  heal" modifies another effect's output; Armour Plating states no cap change at
  all and is correctly unencoded.

## Sequencing decisions taken

| Question               | Decision                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                  | **Full contextual parity** — all six phases below                                                                                                          |
| Migration              | **Convert every `max*Modifier` to an absolute pin.** Lossless; no displayed number changes. Accepted cost: some sheets gain an override marker they lacked |
| Model                  | **Converge the two engines** into one contribution vocabulary; widen where effects may be _declared_, leave `resolveChoiceView`'s application logic alone  |
| Process                | **ADR-022 amendment + new ADR-029**, both before code                                                                                                      |
| Duration-bound effects | **In scope**, as `duration: activated` contributions applied only by the Dashboard against ephemeral play state (ADR-019)                                  |
| Order                  | **Provenance first** (A→B), then the model and data (C→D), then Dashboard wiring (F)                                                                       |
| Surfaces               | Live Sheet, Dashboard, **partner cards, Frozen snapshot, wizard previews, entity reference cards**                                                         |

## Units

Sizes use the repo's existing effort labels: **S** under 1 day · **M** 1–2 · **L** 2–3 · **XL** 3+.

### Phase A — Foundation (blocks everything downstream)

| ID     | Unit                        | Size | Depends | Done when                                                                                                                                                                                 |
| ------ | --------------------------- | ---- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1** | ADR-022 amendment + ADR-029 | S    | —       | Both merged; `docs/README.md` index updated                                                                                                                                               |
| **A2** | Parity audit + CI gate      | M    | A1      | Scans every record stating a mechanical change; asserts a contribution or a reasoned exemption; names record + sentence on failure. Advisory for one week, then blocking                  |
| **A3** | Absolute-pin overrides      | L    | A1      | `max*Override` replaces the six delta fields; IDB migration lossless (property test: no displayed maximum changes); `VitalGauge` reads an explicit `overridden` flag, never a subtraction |

### Phase B — Provenance (the visible feature)

| ID     | Unit                            | Size | Depends | Done when                                                                                                                                  |
| ------ | ------------------------------- | ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **B1** | Breakdown-shaped derivations    | L    | A3      | Every maximum returns `StatBreakdown`, generalizing `crawlerMaxSPParts`; scalar functions become `.total` wrappers so no call site changes |
| **B2** | Provenance panel primitive      | M    | B1      | component-lib panel opens on hover **and** focus **and** tap; contributions link to the granting entity; passes a11y scan                  |
| **B3** | Live Sheet wiring               | M    | B2, A3  | All gauges carry breakdowns; **an override appends as the final line**, never replaces the list; revert target visible                     |
| **B4** | Dashboard wiring                | S    | B2      | `DashboardGauge` stops discarding the props; Guided Play gains the "teach as it enforces" affordance                                       |
| **B5** | Partner cards + Frozen snapshot | M    | B2      | Partner stats explain their `bonusPerTechLevel` scaling in `PartnerCard`; snapshots show the breakdown and never the revert                |
| **B6** | Wizard previews                 | S    | B2      | **Superseded — see note below.** The wizard already renders a shared-derivation breakdown, and its prose teaches a rule the panel cannot   |

> **B6 note (resolved during B3–B5).** The unit was written as "retire the bespoke
> `sp-breakdown` string in favour of the shared panel". That is the wrong goal.
> The wizard's inline prose — _"the bonus derives from your Crawler type, so it
> follows a type change automatically"_ — teaches a **rule**, not just the
> arithmetic, and Guided Creation exists to teach while it enforces
> ([ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md)). Replacing it with a
> hover panel would trade a visible explanation for a hidden one in the mode that
> most needs the visible version. The underlying requirement — that the wizard's
> breakdown comes from the shared derivation and cannot drift — is **already
> satisfied**: `CrawlerStatsStep` calls `crawlerMaxSPParts` directly. No change
> made; recorded so it is not "fixed" later by someone reading the original DoD.

### Phase C — The converged model

| ID     | Unit                           | Size | Depends | Done when                                                                                                                                                              |
| ------ | ------------------------------ | ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | Contribution schema            | XL   | A2      | One vocabulary: `op` / `target` / `amount` / `stacks` / `voidWhen` / `duration`, covering the four cap keys plus `addTrait` / `removeTrait` / `setRange` / `addDamage` |
| **C2** | Declaration sites              | L    | C1      | Abilities, systems, modules, bays and crawler types may all carry contributions. **Ability parity is the acceptance test**                                             |
| **C3** | Resolver extension             | L    | C2      | Contributions from non-choice sources flow through `resolveChoiceView`; its application logic is unchanged and its tests still pass                                    |
| **C4** | Inline rules-bearing indicator | M    | C2      | The granting **sentence** is marked on entity reference cards, extending ADR-026 §5's rust "modified" language to a prose span                                         |

### Phase D — Data backfill

| ID     | Unit                             | Size | Depends | Done when                                                                                                                              |
| ------ | -------------------------------- | ---- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Composite Armour                 | S    | —       | `statBonus.structurePoints: 5` + test. **Fits today's schema — shippable immediately**                                                 |
| **D2** | Cap-class backfill               | M    | C2      | Beefcake, Bionic Arms, Bionic Legs, Modular Face Implant; Pilot Bay explicitly triaged as a grant-at-a-moment, not a standing modifier |
| **D3** | Trait / damage / range backfill  | L    | C3      | The ~21 records the audit surfaces; one record per change, each with a test                                                            |
| **D4** | Coverage past the four mech keys | L    | C2      | Pilot HP/AP/inventory, system + module slots, crawler bays and weapon mounts                                                           |

### Phase E — Change Log truth (independent quick wins)

| ID     | Unit                             | Size | Depends | Done when                                                                       |
| ------ | -------------------------------- | ---- | ------- | ------------------------------------------------------------------------------- |
| **E1** | Tag transactions + pass `source` | S    | —       | Dashboard writes emit `kind: 'transaction'`; no entry reads `source: 'unknown'` |
| **E2** | Log `entityStore.transfer()`     | S    | —       | Cargo stow/load and scrap hand-offs appear in the Change Log                    |

### Phase F — Dashboard rules wiring

| ID     | Unit                               | Size | Depends | Done when                                                                                                                         |
| ------ | ---------------------------------- | ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **F1** | Activated contributions            | L    | C1, B2  | Squeeze It In and Hull Magnetiser work; expiry lives in ephemeral play state, never IndexedDB; the panel annotates remaining life |
| **F2** | Wire salvage                       | M    | —       | `salvage.ts` reachable from the Dashboard                                                                                         |
| **F3** | Wire crafting                      | M    | —       | `crafting.ts` reachable                                                                                                           |
| **F4** | Wire scrap-mech                    | M    | —       | `scrapMech.ts` reachable                                                                                                          |
| **F5** | Downtime writes                    | L    | F2–F4   | Downtime stops narrating and starts writing, with ADR-007 confirmation on destructive consequences                                |
| **F6** | `RuleBrief` at enforcement moments | S    | —       | A disabled Push cites the Heat Cap rule rather than greying out silently                                                          |

## Critical path

```
A1 ──► A3 ──► B1 ──► B2 ──► B3 / B4 / B5 / B6
  └──► A2 ──► C1 ──► C2 ──► C3 ──► D3
                      └──► D2 / D4 / C4
```

`D1`, `E1`, `E2`, `F2`–`F4` and `F6` hang off nothing and can be picked up at any
time — useful for parallel capacity or a short slot.

**Rough total: ~41 person-days** (S=0.5, M=1.5, L=2.5, XL=4). Phases C and F are
each about a quarter of the work.

## Definition of done

Parity is reached when:

1. Every record whose text states a mechanical change — cap, trait, damage or
   range — either encodes it or carries a reasoned exemption, **enforced in CI**.
2. Any content type that can modify a character can declare it. Abilities are not
   second-class citizens of the schema.
3. Every derived value can name its own contributions on **every** surface that
   shows it — gauges, damage readouts and trait lists alike.
4. An override is distinguishable from a modifier **in storage**, not by
   arithmetic, and is shown **on top of** the full derivation rather than in place
   of it.
5. Every mutation is logged with a truthful `kind` and `source`.
6. Every implemented rules module is reachable from the mode ADR-021 assigns it.

## Explicitly out of scope

- **Procedural adjudication** — surfaced, never enforced. Unchanged by design.
- **Effect-of-an-effect modifiers** (Mender's "+4 SP each time you heal") — modifies
  another effect's output, not a stat. Exempted by the audit, not modelled.
- **Net-new homebrew authoring** — a future authoring surface, not a Free-Edit
  affordance.
- **Change Log replay / time travel** — the log is shaped for it; the surface stays
  deferred.
- **Live Sheet hard blocks** — wanting one is a proposal to amend ADR-021, not a bug.
