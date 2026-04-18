# actions.json Audit Report
*Date: 2026-03-10*
*Team: actions-audit (team-lead-2 + 5 workers)*
*Scope: All 615 actions across all sources — schema compliance + rules accuracy vs PDFs*

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total actions audited | 615 |
| Unique IDs | 615 (no duplicates) |
| Duplicate names | 1 ("Consume (Bio-Maw)" — identical entries) |
| Missing `actionType` | 247 / 615 (40%) |
| P1 critical issues | 18 |
| P2 important issues | 24 |
| P3 polish issues | 12 |

**Source PDFs used:**
- `rules/Salvage Union Digital Edition 1.2.pdf`
- `rules/We Were Here First Digital Edition 1.1.pdf`
- `rules/Rainmaker Digital Edition 1.1.pdf`
- `rules/False Flag Digital Edition 1.1.pdf`

---

## 1. Rules Accuracy Issues — Core Book

These are confirmed errors against `Salvage Union Digital Edition 1.2.pdf`.

### 1.1 Missing Actions (not in data, exist in PDF)

**Bionic Arms (Passive ability) — MISSING**
- PDF p.35: "Bionic Arms" is a Passive ability in the Augmentation Tree granting a bionic arms attack
- Data only has the hidden sub-action "Bionic Arms Attack" — the parent Passive ability entry is absent
- Fix: Add `Bionic Arms` Passive ability (`actionSource: "abilities"`)

**Automated Weapon Turret sub-actions — 3 MISSING**
- PDF p.178 defines three turret configurations referenced by the Automated Weapon Turret system's `choices` array:
  - Automated Machine Gun Turret (Close, 2 SP, Ballistic/Pinning)
  - Automated Green Laser Turret (Medium, 4 SP, Energy/Hot(2))
  - Automated 120mm Cannon Turret (Long, 6 SP, Ballistic/Explosive(1))
- Fix: Add all three as action entries in actions.json

### 1.2 Name Discrepancies

| Data Name | PDF Name | Page | Source |
|-----------|----------|------|--------|
| Navigation | Navigation Module | p.192 | modules |
| Video Projection Array | Projection Array | p.199 | modules |
| Gauss Cannon | Gauss Rifle | p.202 | modules |
| Eggs Mayhem | Eggs | p.193 | modules |
| Adv. Epoxy Applicator | Advanced Epoxy Applicator | p.84 | equipment |
| Portable Comms Unit | Portable Communications Unit | p.81 | equipment |

Note: `He₂ Coolant Flush` uses a subscript `₂` character vs `He2` elsewhere — minor encoding inconsistency.

### 1.3 Missing Traits (confirmed against PDF)

| Action | Missing Trait | PDF Page |
|--------|--------------|---------|
| Missile Pod | `uses (6)` | p.179 |
| Vectored Thrust Unit | `hot (2)` | p.171 |
| Welding Laser (module) | `hot (2)` | p.190 |
| He₂ Coolant Flush | `hot (2)` + `uses (3)` | p.199 |
| Flamethrower (module) | `hot (2)` | p.202 |
| Incinerator | `hot (3)` | — |
| Plasma Projector | `hot (4)` | — |
| Inferno Mortar | `hot (3)` | — |

**Spurious trait:**
- Laser Guidance has `guided` trait — not present in PDF (p.197). Should be removed.

### 1.4 Missing Damage / Range Fields

| Action | Missing Field | Correct Value | PDF Page |
|--------|--------------|---------------|---------|
| Pin (Grappling Harpoon sub-action) | `damage` | `{ damageType: "SP", amount: 1 }` | p.167 |
| Rigging Arm | `range` | `["Close"]` | p.167 |
| Anti-Mech Mine Layer | `range` + `actionType` + `content` | range: `["Close"]`, type: `"Short"` | p.178 |

### 1.5 Missing activationCost (confirmed against PDF)

All of these have explicit AP costs in the PDF but missing `activationCost` in data:

| Action | PDF Cost | actionType |
|--------|---------|-----------|
| Refractive Shield Projector | 2 EP | Reaction |
| Electro-Magnetic Shield Projector | 2 EP | Reaction |
| Laser Anti-Missile System | 1 EP | Reaction |
| Shield Dome | X EP | Turn |
| Night Vision Goggles | 1 AP | Free |

**Questionable:**
- First Aid Kit has `activationCost: 2` but the PDF does not list a cost — may be from errata.

### 1.6 Stub / Incomplete Actions

**Eggs Mayhem** — All structured fields are absent (actionType, activationCost, range, traits, damage). PDF p.193 shows Eggs as a module with a Turn Action attack. All fields need populating.

**Anti-Mech Mine Layer** — Has `activationCost: 1` but no `actionType`, no `content`, no `range`. PDF p.178: "Short Action // Range: Close // Uses (5)". Full entry needed.

**Repair (Fabrication Bay)** — Stale stub (`id: 36835956`) with `displayName: "Repair"` but no actionType, cost, range, or content. The Fabrication Bay system already has proper action entries. This should be removed.

### 1.7 Page Number Errors

| Action / Entity | Data `page` | Correct `page` | PDF |
|----------------|------------|----------------|-----|
| Napalm Launcher (system) | 71 | 72 | Core Book Black Market |
| Rad Wave Generator (system) | 71 | 72 | Core Book Black Market |

---

## 2. Rules Accuracy Issues — Expansions

### 2.1 We Were Here First

No action data errors found. All WWHF actions verified correct against PDF pp.54–75.

### 2.2 Rainmaker

**Thermal Goggles (Fell Stalkers Squad) — NAME ERROR**
- Data: `"Thermal Goggles"` (actionSource: squads)
- PDF p.79: **"Thermal Optics"**
- The action's own content references "Thermal Optics" — the name field is wrong
- Fix: Rename to `"Thermal Optics (Fell Stalkers Squad)"` with `displayName: "Thermal Optics"`

### 2.3 False Flag

No action data errors found. All False Flag actions verified correct against PDF pp.67–71.

### 2.4 Expansion Modules (provenance confirmed)

The 15 "Meld Bio-Module" actions previously of unknown origin are now mapped:
- **WWHF p.75** (7 actions): Burst/Power (Adrenal Glands), Chimerium Cell, Regeneration Glands/Regrowth, Olfactory Glands/Olfactory Scan
- **False Flag pp.69–70** (7 actions): Heating Unit, Pop Goes The Weasel, Meld Replicator → **should be "Meld Module Replicator"**, Meld Regenerator/Nanite Reconstruction/Nanite Repair, Meld Distorter
- **Rainmaker p.76** (1 action): Genetic Lock — all correct except missing `actionType: "Passive"`

**Name error:**
- `Meld Replicator` → correct name is **`Meld Module Replicator`** (False Flag p.69)

None of these 15 actions have `source` or `page` fields set. All should be attributed to their expansion.

---

## 3. Schema & Data Quality Issues

### 3.1 Duplicate Action

**"Consume (Bio-Maw)"** — two entries with different IDs, identical content:
- `8ec910ec-a87a-4d06-a8c6-f07ddb240cf9` (systems)
- `bbe55547-f26f-4ef0-9aba-4372fa9a98c8` (systems)

Fix: Remove one. Keep the ID that is referenced by the Bio-Maw system entity.

### 3.2 Orphaned Actions (no `actionSource`)

3 actions have no `actionSource` field:

| Name | ID | Notes |
|------|----|-------|
| Hack | `78dd32b6` | Well-formed (Turn, range, hacking trait, tableName). Likely `actionSource: "abilities"` or `"systems"`. Has invalid tableName (see §4). |
| Portable Comms Unit () | `174a2143` | Empty parens in name, no data beyond id+name. Stub/duplicate of equipment version. Should be removed. |
| Pilot Equipment | `10f0cd71` | Only has `pilot equipment` trait. Category placeholder, not a real action. Should be removed or categorized. |

### 3.3 Trait Encoding Inconsistencies

**`hot (x)`** — used on 2 actions (Blue Beam Laser, Alpha Strike). All other `hot` traits use `{ type: "hot", amount: <number> }`. The `(x)` is embedded in the type string with `amount: undefined`. Should be `{ type: "hot", amount: "X" }`.

**`deadly (creatures only)`** — used on 1 action (Stinger, creatures). Should be `{ type: "deadly" }` with the qualifier noted in content, not in the trait type string.

**`armor` vs `Armour`** — PDF uses "Armour" (British spelling) in the Traits section. Data uses lowercase `armor`. Pick one and be consistent. (6 actions affected.)

### 3.4 Empty `traits: []` Arrays

13 actions have `traits: []` (empty array) instead of omitting the field:

- **systems (6):** Adv. Fabrication Arm, Fabrication Arm, Grappling Harpoon, Nanite Repair Arm, Riveting Gun, Welding Laser
- **abilities (7):** Area Salvage, Load, Mech Salvage, Mount, Patch Up, Repair, Scrap

Fix: Remove the `traits` field from these actions (omit rather than empty array).

### 3.5 Missing `source` and `page` Fields

- All 615 actions lack `source` and `page` fields — these live on parent entities, not on actions. Intentional.
- Exception: the 15 expansion bio-modules should have `source` set to their respective expansion books since they are module sub-actions without a natural parent-level attribution in the current schema.

---

## 4. Cross-Cutting Issues

### 4.1 actionType Gap (247 missing — 40%)

**By source:**

| actionSource | Total | Missing | % Missing |
|---|---|---|---|
| squads | 26 | 26 | 100% |
| npcs | 15 | 15 | 100% |
| crawlers | 5 | 5 | 100% |
| creatures | 14 | 11 | 79% |
| meld | 8 | 6 | 75% |
| chassis | 58 | 43 | 74% |
| equipment | 78 | 47 | 60% |
| systems | 150 | 54 | 36% |
| abilities | 108 | 12 | 11% |
| modules | 91 | 7 | 8% |
| (none) | 3 | 2 | 67% |

**Key rule from PDF (p.326):** "All Weapon Systems require a Turn Action to activate unless stated otherwise." This means ~82 weapon-like actions (those with `damage`) that are missing `actionType` should be `Turn`.

**Note:** `Passive` is a PDF *keyword*, not an action type. The PDF defines exactly 6 action types (Turn, Free, Reaction, Short, Long, DownTime). Our schema includes Passive as a convenience — this is an intentional data modeling decision, not an error.

**Recommended classification for missing actions:**
- Has `damage` + `range` → `Turn`
- Locomotion system (Hover, Amphibious, etc.) → `Passive`
- Cargo/storage systems (Integrated Cargo Bay, etc.) → `Passive`
- NPC/creature/squad attacks → `Turn`
- Chassis passive abilities (reactors, armor plating) → `Passive`

### 4.2 Invalid tableName Reference

**"Hack"** action (`78dd32b6`) has `tableName: "Hack"` but no roll table named "Hack" exists in roll-tables.json.

### 4.3 Non-Standard Trait Types

| Trait | Count | Issue |
|-------|-------|-------|
| `hot (x)` | 2 | Amount embedded in type string |
| `deadly (creatures only)` | 1 | Rules qualifier in type string |
| `irradiated` | 1 | PDF Keywords section (p.323), not a Traits entry |
| `pilot equipment` | 14 | PDF Keywords section (p.324), not a Traits entry |
| `armor` | 6 | PDF spells it "Armour" |
| `bio-equipment` | 1 | Expansion-specific, not in core PDF |
| `dependable` | 2 | Not in core PDF traits section |
| `deployable` | 1 | Not in core PDF traits section |
| `meld infection` | 9 | Expansion-specific |

Note: TraitSchema uses `z.string()` for `type` — all values pass schema validation. These are consistency/accuracy concerns.

**PDF traits defined but unused in any action:**
- Burrower, Fast, Fly, Immobile, Vulnerable — all are conditions or chassis-level traits, not weapon action traits. Absence is expected.

### 4.4 Naming Misspellings

| Current | Correct |
|---------|---------|
| Knife Missle (equipment entity) | Knife Missile |
| Custom Missle Launcher (equipment entity) | Custom Missile Launcher |

These are equipment entity names (in equipment.json), not action names — included here as they were found during the equipment action audit.

---

## 5. Prioritized Fix List

### P1 — Critical (data errors affecting gameplay)

1. **Add missing "Bionic Arms" Passive ability** — Sub-action exists, parent is gone
2. **Add 3 Automated Weapon Turret sub-actions** — Referenced by system choices, don't exist
3. **Remove duplicate "Consume (Bio-Maw)"** — Identical entries, keep one
4. **Fix "Thermal Goggles" → "Thermal Optics" (Fell Stalkers Squad)**
5. **Fix "Meld Replicator" → "Meld Module Replicator"**
6. **Fix "Gauss Cannon" → "Gauss Rifle"**
7. **Fix "Video Projection Array" → "Projection Array"**
8. **Fix Red Laser (Drone Squadron) range: `"Medium"` → `"Close"`**
9. **Add missing `damage: {SP, 1}` to Pin (Grappling Harpoon sub-action)**
10. **Add missing `range: ["Close"]` to Rigging Arm**
11. **Complete Anti-Mech Mine Layer** — add actionType "Short", range ["Close"], content
12. **Complete Eggs Mayhem** — add actionType, activationCost, range, traits, damage per PDF p.193
13. **Add missing activationCost to Refractive Shield Projector (2), Electro-Magnetic Shield Projector (2), Laser Anti-Missile System (1), Shield Dome ("X")**
14. **Add missing `uses (6)` trait to Missile Pod**
15. **Add missing `hot` traits to 7 modules** (Welding Laser, He₂ Coolant Flush, Flamethrower, Incinerator, Plasma Projector, Inferno Mortar, Vectored Thrust Unit)
16. **Remove spurious `guided` trait from Laser Guidance**
17. **Fix "Navigation" → "Navigation Module"**
18. **Delete stale stub: "Repair (Fabrication Bay)"** and "Portable Comms Unit ()" orphan

### P2 — Important (data quality, usability)

1. **Populate `actionType` for ~82 weapon-like actions** (those with `damage`) → `Turn`
2. **Populate `actionType` for Passive-like chassis, locomotion, and storage actions** → `Passive`
3. **Populate `actionType: "Passive"` for** Bio-Wings, Frost Protection, Hydrologic Locomotion System, Cryopod System, Meld System Replicator, Genetic Lock
4. **Populate `actionType: "Turn"` for** K4 Rifle, Napalm Shotgun, Napalm Launcher, Rad Wave Generator
5. **Fix `hot (x)` trait encoding** on Blue Beam Laser and Alpha Strike → `{ type: "hot", amount: "X" }`
6. **Fix `deadly (creatures only)` → `deadly`** on Stinger
7. **Add missing `activationCost: 1` to Night Vision Goggles**
8. **Add `source` + `page` fields to 15 expansion bio-modules** (WWHF ×7, False Flag ×7, Rainmaker ×1)
9. **Fix page refs**: Napalm Launcher and Rad Wave Generator → page 72 (not 71)
10. **Fix "Adv. Epoxy Applicator" → "Advanced Epoxy Applicator"**
11. **Fix "Portable Comms Unit" → "Portable Communications Unit"**
12. **Fix "Eggs Mayhem" → "Eggs"** (or verify if "Mayhem" is intentional)
13. **Resolve "Hack" orphan** — assign `actionSource` or remove; fix invalid `tableName`
14. **Remove "Pilot Equipment" orphan** — category placeholder, not a real action

### P3 — Polish (hygiene, consistency)

1. **Remove 13 empty `traits: []` arrays** (omit field instead)
2. **Standardize `armor` → `Armour`** (or vice versa) across all 6 actions
3. **Remove "He₂" subscript** — standardize to "He2" across all references
4. **Populate `actionType`** for remaining 165 non-weapon missing-type actions (Passive vs other)
5. **Populate `activationCost`** for remaining non-Passive actions that are missing it
6. **Verify "First Aid Kit" activationCost: 2** — not in PDF, may be from errata
7. **Verify "Bio-Scanner" actionType/cost** — inferred from convention, not explicit in PDF
8. **Fix "Knife Missle" → "Knife Missile"** (equipment.json)
9. **Fix "Custom Missle Launcher" → "Custom Missile Launcher"** (equipment.json)
10. **Review 22 missing-content squad/NPC actions** — confirm intentional (stat-only variants)
11. **Handle REDACTED equipment** — 12 equipment entities have broken action references; either add stub actions or mark as intentionally empty
12. **Consider deprecating `hot (x)` and `deadly (creatures only)` trait types** from the schema

---

## Appendix: actionSource Breakdown

| actionSource | Total | With actionType | Missing |
|---|---|---|---|
| systems | 150 | 96 (64%) | 54 |
| abilities | 108 | 96 (89%) | 12 |
| modules | 91 | 84 (92%) | 7 |
| bio-titans | 59 | 40 (68%) | 19 |
| chassis | 58 | 15 (26%) | 43 |
| equipment | 78 | 31 (40%) | 47 |
| squads | 26 | 0 (0%) | 26 |
| npcs | 15 | 0 (0%) | 15 |
| meld | 8 | 2 (25%) | 6 |
| creatures | 14 | 3 (21%) | 11 |
| crawlers | 5 | 0 (0%) | 5 |
| (none) | 3 | 1 (33%) | 2 |
| **TOTAL** | **615** | **368 (60%)** | **247 (40%)** |
