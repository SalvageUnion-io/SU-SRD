# Action Variant Reconciliation — Proposal & Classification

> **Status: maintainer-reviewed.** This document re-examines the "numbered / parenthetical
> action variant" divergences in `data/actions.json`. It is an evidence-based classification
> that received maintainer (game-content) sign-off. Every verdict below is evidence-based,
> but "which stat block is canonical" is ultimately a game-content judgment call. The two
> borderline items were resolved by the maintainer — **Flag A: left intentional (no change);
> Flag B: `displayName` metadata added.** See [Flagged for maintainer review](#flagged-for-maintainer-review)
> for the resolutions and [Edits applied](#edits-applied) for exactly what changed.

## TL;DR

- The earlier version of this doc framed the parenthetical variants (e.g.
  ".50 Cal Machine Gun (Machine Gun Squad)") as **data-quality drift** to be merged.
  A full re-sweep of the current data shows that premise is **largely mistaken and the
  old notes are stale** (they mis-stated `.50 Cal` damage, missed `uses (3)` on Beta
  Fission Gun, and describe a "numbered" Custom Sniper Rifle variant that no longer
  exists — the data has been revised since).
- The variants are **intentional, entity-scoped stat blocks**, not duplicates. Each
  record is keyed by `actionSource` (which _kind_ of entity owns it — a Mech `systems`
  weapon, an `equipment` item, a `squads` / `npcs` / `creatures` / `bio-titans` stat
  block, a `modules` grant, etc.) and linked back to its base weapon via `displayName`.
- A sweep of all **686 records** finds **42 name-families with 2+ members** and
  **0 duplicate IDs**. Every divergence traces to a **distinct game entity**.
- **High-confidence data-entry errors found: 0.** Under the project's "when in doubt,
  treat as intentional and leave it" rule, no automated stat reconciling edits were warranted.
- **2 borderline items were flagged** for maintainer judgment (a possibly-dropped trait
  and some metadata inconsistencies). Maintainer resolutions: **Flag A — left intentional,
  no change; Flag B — `displayName` metadata added** to the two records that lacked it.

## The architecture (why these are not duplicates)

An "action" is not globally unique by name. The same weapon/action name can legitimately
appear many times, once per entity that can perform it:

- `.50 Cal Machine Gun` exists as a Mech Weapon System (`actionSource: "systems"`, 2 SP,
  `ballistic/jamming/pinning`) **and** as the `.50 Cal Machine Gun (Machine Gun Squad)`
  NPC-squad stat block (`actionSource: "squads"`, 3 SP, adds `multi-attack (2)`).
- The parenthetical suffix names the **owning entity** (`(Machine Gun Squad)`,
  `(Veteran)`, `(Ace)`, `(Scylla)`, `(Fabrication Arm)`, …).
- `displayName` carries the **base weapon name**, so the UI can group/label the variant
  under its parent while keeping a distinct stat block.

Because each record is a distinct entity's stat block, the divergences are content, not
corruption. Collapsing them would destroy legitimate NPC/squad/creature stat blocks and
per-item repair grants — the opposite of a fix.

## Methodology

A **read-only** extraction (no writes to `actions.json`; the no-reformat convention
governs edits, not analysis) grouped every record by its base name (`displayName` when
present, otherwise the `name` with the trailing parenthetical stripped) and dumped
`{name, displayName, actionSource, range, damage, traits, actionType, has-content}`
for each member. Duplicate-ID and trait-vocabulary checks were run over the whole file.
Results: 686 records, 42 multi-member families, 0 duplicate IDs, no invalid trait types.

## Observed design conventions

Three deliberate conventions explain essentially every divergence:

1. **Squad buff pattern.** A `squads` stat block of a weapon adds `multi-attack (2)`,
   nudges damage up ~1, and drops single-use bookkeeping traits (`uses`, `heavy`) and the
   flavor `content`. Consistent across `.50 Cal`, `Beta Fission Gun`, `Monomolecular
Sword`, `Red Laser`, `Rocket Launcher`, `Improvised Explosive Device (Flint Children
Squad)` — clearly intentional (a squad is many soldiers firing at once).
2. **NPC "wields standard gear" pattern.** An `npcs` stat block copies the base weapon's
   stats **exactly** and only drops the flavor `content`. Holds for `Pistol (Combat
Pilot)`, `Rifle (Trooper)`, `Sniper Rifle (Ace)`, `Green Laser Rifle (Veteran)`,
   `Improvised Firearm (Raider)`, and the Saboteur mine/bomb copies.
3. **One action, many granting items.** Utility actions are duplicated per item that
   grants them, each a distinct `systems`/`modules`/`equipment` entry: `Patch` (12),
   `System Repair` (10), `Chassis Repair` (9), plus `Coolant Flush`, `Repair`, and the
   `Laser Guidance` / `Multi-Targeter` / `Pinpoint Targeter` targeting modules.

## Per-family classification (all 42 families)

Verdict key: **INTENTIONAL** = distinct entity / documented convention, leave as-is ·
**FLAG** = borderline, referred to maintainer, not auto-edited.

### Squad weapon variants (convention 1) — INTENTIONAL

| Base                         | Variant                 | Divergence                                                                                   | Why intentional                      |
| ---------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------ |
| .50 Cal Machine Gun          | (Machine Gun Squad)     | `systems`→`squads`, 2→3 SP, +`multi-attack(2)`                                               | Squad buff pattern                   |
| Beta Fission Gun             | (Elite Beam Squad)      | `equipment`→`squads`, Medium→Long, 7→9 SP, +`multi-attack`, −`heavy`/`uses`, `explosive 2→1` | Squad buff pattern (elite)           |
| Monomolecular Sword          | (Elite Blade Squad)     | `equipment`→`squads`, 4→6 SP, +`multi-attack`, −`silent`                                     | Squad buff pattern                   |
| Red Laser                    | (Drone Squadron)        | `systems`→`squads`, 3→4 SP, +`multi-attack`                                                  | Squad buff pattern                   |
| Rocket Launcher              | (Missile Squad)         | `equipment`→`squads`, 5→6 SP, +`multi-attack`, −`heavy`                                      | Squad buff pattern                   |
| Improvised Explosive Device  | (Flint Children Squad)  | `equipment`→`squads`, 3→4 SP, +`multi-attack`, −`uses`                                       | Squad buff pattern (also see Flag B) |
| Metal Bars and Ripping Hands | (Ghost) / (Ghost Haunt) | 1 SP → 2 SP +`multi-attack`                                                                  | Two distinct creatures               |

### NPC "wields standard gear" (convention 2) — INTENTIONAL

| Base                        | Variant        | Divergence                       | Why intentional |
| --------------------------- | -------------- | -------------------------------- | --------------- |
| Pistol                      | (Combat Pilot) | identical stats, drops `content` | NPC copy        |
| Rifle                       | (Trooper)      | identical stats, drops `content` | NPC copy        |
| Sniper Rifle                | (Ace)          | identical stats, drops `content` | NPC copy        |
| Green Laser Rifle           | (Veteran)      | identical stats, drops `content` | NPC copy        |
| Improvised Firearm          | (Raider)       | identical stats, drops `content` | NPC copy        |
| Electrostatic Mine          | (Saboteur)     | identical stats incl. content    | NPC copy        |
| Hobbler Mine                | (Saboteur)     | identical stats incl. content    | NPC copy        |
| Oil Bomb                    | (Saboteur)     | identical stats                  | NPC copy        |
| Improvised Explosive Device | (Saboteur)     | identical stats, drops `content` | NPC copy        |

### Stripped NPC/squad utility references — INTENTIONAL

`First Aid Kit (NPC)`, `Salvaging Tools (NPC)`, `High Tensile Wire (Raider Band)`,
`Electro Grappling Hook (Elite Blade Squad)`, `Hover Locomotion System (Drone Squadron)`,
`Thermal Optics (Fell Stalkers Squad)` — each is an entity reference to a utility item
with combat stats stripped. Intentional stat-block shorthand.

### One action, many granting items (convention 3) — INTENTIONAL

`Patch` (12 members), `System Repair` (10), `Chassis Repair` (9), `Coolant Flush` (3),
`Repair` (2), `Laser Guidance` (2), `Multi-Targeter` (2), `Pinpoint Targeter` (2).
Every parenthetical is a different granting item (Fabrication Arm, Welding Laser, Nanite
Repair Injector, Adv. Targeting Array, …). Same action text, distinct owning entity.
Not drift.

### Distinct entities sharing an action name — INTENTIONAL

`Armour Plating` (per-Bio-Titan `uses` value: Scylla 3 / Typhon 2 / Genbu 6),
`Titanic Actions` (13, one per Titan/entity), `Mutated Weapon` (Chimerium Chosen 6 HP vs
Mutant 4 HP), `Random Mutation` (3 Chimerium entities), `Ambush` (+Hunter creature),
`Bite` (meld / Bio-Maw system / Scrap Termite creature — genuinely different weapons),
`Burrower` (Iron Wyrm chassis vs Bio-Titan), `Bio-Rifle` (Chimerium NPC vs equipment),
`Rigging Arm` (Mech system vs Vehicle, which adds `melee` + 1 SP), `Omega Strike`
(Dennis NPC vs ability), `Area Salvage` / `Mech Salvage` (base ability vs Expert Salvager
upgrade). All distinct entities or documented ability upgrades.

## Flagged for maintainer review

Both borderline items were referred to the maintainer for a game-content decision.
**Resolutions are recorded inline below.**

- **Flag A — `Improvised Melee Weapon (Wastelander)` is missing the `silent` trait.**
  The base (`equipment`) has `melee, silent`; the Wastelander (`npcs`) copy has `melee`
  only. This is the single strongest drift signal because it _breaks convention 2_ — every
  other NPC weapon copy replicates the base traits exactly. It reads plausibly as a
  dropped trait. **But** re-adding `silent` is a game-content change (it makes the
  Wastelander's attack undetectable), and a loud improvised weapon could be a deliberate
  choice, so it was left for maintainer judgment rather than edited. _(Note: the sibling
  `Monomolecular Sword (Elite Blade Squad)` also drops `silent`, but there it is explained
  by the squad buff pattern — many attackers are not stealthy.)_
  **→ Resolution (maintainer): LEFT AS-IS — treated as intentional. No change made.**
- **Flag B — metadata inconsistencies (missing `displayName`).**
  `Improvised Explosive Device (Flint Children Squad)` and the standalone `Bite (Bio-Maw)`
  lacked a `displayName`, whereas their sibling variants carry one. Adding `displayName`
  is a metadata/grouping change with no mechanical effect.
  **→ Resolution (maintainer): APPLIED.** `displayName` added, mirroring the exact sibling
  values: `"Improvised Explosive Device"` (matching `Improvised Explosive Device (Saboteur)`)
  and `"Bite"` (matching `Bite (Scrap Termite)`). Text-level edits only; no other fields
  or formatting touched.

## Edits applied

**Two `displayName` additions** to `data/actions.json`, both resolving Flag B under
maintainer sign-off (metadata only, no mechanical effect):

- `Bite (Bio-Maw)` — added `"displayName": "Bite"`.
- `Improvised Explosive Device (Flint Children Squad)` — added
  `"displayName": "Improvised Explosive Device"`.

Both were text-level insertions immediately after the `name` line, mirroring the exact
`displayName` value their sibling variants already carry; no IDs, stats, or existing
formatting were changed.

**No stat divergences were reconciled.** Per-variant review found **zero high-confidence
data-entry errors** — every stat divergence maps to a distinct entity or a documented
convention — and Flag A (`Improvised Melee Weapon (Wastelander)` `silent`) was left
intentional by maintainer decision. Per the project's data-safety rule ("when in doubt,
treat it as intentional and leave it"), no stat/trait/range/damage fields were mutated.
JSON key-order differences noted historically are cosmetic and are intentionally **not**
"fixed" — reordering keys is pure reformatting churn the data conventions forbid.

## Recommendation

1. Treat the parenthetical variants as first-class, entity-scoped stat blocks; do **not**
   merge/collapse them.
2. Flag A (`Improvised Melee Weapon (Wastelander)` `silent`) — **resolved: left as-is**
   (maintainer treats the loud improvised weapon as intentional).
3. Flag B (missing `displayName`s) — **resolved: applied** in this change.
