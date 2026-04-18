# Rainmaker Expansion Audit
*Date: 2026-03-10*
*Auditor: rainmaker agent*
*PDF: Rainmaker Digital Edition 1.1*

## Summary
- Total Rainmaker entries found: 28 (across 8 files) + 2 patterns on core chassis
- Total issues found: 10
- Issues by type:
  - Wrong page: 4
  - Wrong/incomplete content: 3
  - Missing field: 2
  - Missing source attribution on patterns: 2

## Critical Issues

### 1. Wader chassis stats completely wrong (chassis.json, page 60)

Six of eight numeric stats in the data do not match the PDF (page 61 stat block):

| Stat | Data | PDF | Match |
|------|------|-----|-------|
| structurePoints | **7** | **23** | WRONG |
| energyPoints | **10** | **8** | WRONG |
| heatCapacity | **6** | **14** | WRONG |
| systemSlots | **8** | **14** | WRONG |
| moduleSlots | 3 | 3 | OK |
| cargoCapacity | 6 | 6 | OK |
| techLevel | **1** | **2** | WRONG |
| salvageValue | **4** | **8** | WRONG |

**Suggested fix**: Update all six incorrect stats to match the PDF.

### 2. Agares missing "Hell Fumes" chassis ability (chassis.json, page 66)

PDF page 67 clearly lists three chassis abilities for Agares: **Automech**, **Hell Fumes**, and **Demonic Visage**. The Hell Fumes description is identical to the Stolas's (which correctly has it). The data only has:
```json
"chassisAbilities": ["Automech", "Demonic Visage"]
```

**Suggested fix**: Add `"Hell Fumes"` to the chassisAbilities array. The action already exists in actions.json (line 12192).

### 3. Ravager chassis ability name and content mismatch (chassis.json + actions.json, page 64)

**PDF (page 65)** says:
> **Integrated Advanced Deployable Locomotion System**: This system functions as a deployable Locomotion System but boosts the damage dealt and damage reduced by 1 SP. Whilst deployed all of the attacks the Ravager makes whilst deployed deal an additional 3SP damage and whenever the Ravager receives damage it is reduced by 3 SP to a minimum of 1.

**Data** (chassis.json line 5417, actions.json line 12214) says:
> **Integrated Advanced Stabilising Locomotion System**: This Chassis Ability functions as a Stabilising Locomotion System. (p.181 SU Core Book) It has the following improvements:
> - The Ravager reduces all damage dealt to it by 3 SP whilst stabilised, to a minimum of 1.
> - The first attack the Ravager makes on its turn whilst stabilised deals an additional 3 SP damage.

Key differences:
1. **Name**: "Deployable" vs "Stabilising" — different base systems
2. **Scope of attack bonus**: PDF says "all of the attacks" vs data says "the first attack" — significant mechanical difference
3. **Base modifier**: PDF includes "boosts the damage dealt and damage reduced by 1 SP" as base modifier; data omits this

**Suggested fix**: Rename to "Integrated Advanced Deployable Locomotion System" and update action content to match PDF wording. Verify intended mechanical behavior with source.

## Moderate Issues

### 4. Creatures page numbers wrong (creatures.json)

All three creatures are listed as page 81, but the CREATURES section appears on **page 80** (confirmed by page sequence: p78 Patterns, p79 NPCs, p80 Creatures, p81 Apophis).

| Entry | Data page | Actual page |
|-------|-----------|-------------|
| Basement Frogs | 81 | **80** |
| Ghost | 81 | **80** |
| Ghost Haunt | 81 | **80** |

**Suggested fix**: Change all three from page 81 to page 80.

### 5. Hill Worm Pattern Typhon page number wrong (bio-titans.json)

The Hill Worm Pattern Typhon appears on page 80 (same CREATURES page as above), but the data has `"page": 82`.

**Suggested fix**: Change page from 82 to 80.

### 6. Fell Stalkers Squad — "Thermal Goggles" vs "Thermal Optics" (squads.json, page 79)

PDF page 79 lists the Fell Stalkers Squad ability as **"Thermal Optics"**. The data references **"Thermal Goggles"** (an action in actions.json that says "T3 Pilot Equipment, acts as Thermal Optics"). While the action exists and is internally consistent, the name does not match the PDF.

**Suggested fix**: Verify whether "Thermal Goggles" is an intentional distinction (squad-level equipment variant) or should be renamed to match the PDF's "Thermal Optics".

### 7. Royce Pattern (Scrapper) missing source attribution (chassis.json)

The Royce pattern on the Scrapper chassis (page 78 of Rainmaker PDF) has no `source` or `page` fields. The PatternSchema supports these optional fields for cross-source patterns.

**Suggested fix**: Add `"source": "Rainmaker"` and `"page": 78` to the Royce pattern object.

### 8. Gruman Pattern (Neura-Phage) missing source attribution (chassis.json)

Same issue as above. The Gruman pattern on the Neura-Phage chassis (page 78 of Rainmaker PDF) has no `source` or `page` fields.

**Suggested fix**: Add `"source": "Rainmaker"` and `"page": 78` to the Gruman pattern object.

## Informational Notes

### Cerberus head stat blocks not separately modeled (chassis.json, page 72)

The PDF (pages 72-75) shows the Cerberus with separate stat blocks for each head (Kyrios, Phren, Morphos) and the main chassis body. The data captures only the chassis-level stats (SP 40, Energy 18, etc.) and describes head loadouts in content blocks within the pattern. Individual head stats (e.g., Kyrios SP 25, Phren SP 15, Morphos SP 20) are not modeled as separate fields.

This is a modeling limitation — the ChassisSchema has no mechanism for sub-chassis stat blocks. Not flagged as an error, but worth noting for completeness. The Cerberus Control System chassis ability text covers the multi-head rules.

### Wader pattern "Personnel Transport Pod" vs PDF "Personnel Transport Pod (Woven Home)"

The PDF calls the system "Personnel Transport Pod (Woven Home)" in the Weaver pattern, but the data references the standard "Personnel Transport Pod" system. The "(Woven Home)" is likely a flavor name for the pattern-specific variant. The reference to the standard system is correct.

## Entries by File

### chassis.json
*7 entries from Rainmaker source + 2 patterns on core chassis*

#### Wader (page 60)
**CRITICAL** — 6 of 8 stats wrong. See issue #1 above.

#### Stolas (page 62)
**Clean** — All stats match PDF (SP 20, Energy 10, Heat Cap 15, Sys 16, Mod 3, Cargo 6, TL 2, SV 6). Pattern B systems and modules match. Chassis abilities (Automech, Hell Fumes) correct.

#### Ravager (page 64)
**Issue** — Chassis ability name and content mismatch. See issue #3 above. Stats correct (SP 23, Energy 8, Heat Cap 14, Sys 14, Mod 3, Cargo 6, TL 2, SV 8). Hunchback Pattern loadout correct.

#### Agares (page 66)
**Issue** — Missing "Hell Fumes" chassis ability. See issue #2 above. Stats correct (SP 26, Energy 12, Heat Cap 17, Sys 18, Mod 4, Cargo 6, TL 3, SV 8). Pattern A loadout correct.

#### Black Dragon (page 68)
**Clean** — All stats match (SP 28, Energy 10, Heat Cap 17, Sys 19, Mod 4, Cargo 6, TL 4, SV 7). Cerys pattern loadout correct. Excoriate chassis ability present.

#### Paladin (page 70)
**Clean** — All stats match (SP 32, Energy 15, Heat Cap 12, Sys 20, Mod 5, Cargo 6, TL 4, SV 10). Lot pattern loadout correct including preselected Longsword. Energy Smite chassis ability present.

#### Cerberus (page 72)
**Clean** (with informational note) — Chassis stats match (SP 40, Energy 18, Heat Cap 30, Sys 5, Mod 2, Cargo 6, TL 5, SV 18). TAC-OS pattern loadout matches all 4 sections (3 heads + chassis). See informational note about head stat modeling.

#### Royce Pattern on Scrapper (page 78)
**Issue** — Missing `source` and `page` fields. See issue #7.

#### Gruman Pattern on Neura-Phage (page 78)
**Issue** — Missing `source` and `page` fields. See issue #8.

### systems.json
*1 entry from Rainmaker source*

#### Napalm Shotgun (page 76)
**Clean** — Stats match PDF: TL 4, slots 3, SV 3. Action reference present.

### modules.json
*1 entry from Rainmaker source*

#### Genetic Lock (page 76)
**Clean** — Stats match PDF: TL 2, slots 4, SV 1. Action reference present.

### equipment.json
*6 entries from Rainmaker source*

#### Deployable .50 Cal Machine Gun (page 77)
**Clean** — TL 2, action reference present.

#### Machine Pistols (page 77)
**Clean** — TL 3, action reference present.

#### Epoxy Gun (page 77)
**Clean** — TL 1, action reference present.

#### Rebar Lance (page 77)
**Clean** — TL 2, two actions (Rebar Lance + Lance Charge) matching PDF.

#### Servo Lasso (page 77)
**Clean** — TL 2, action reference present.

#### Fell Rifle (page 77)
**Clean** — TL 3, action reference present.

### squads.json
*5 entries from Rainmaker source*

#### Gully Crusher Squad (page 79)
**Clean** — HP 8, damageType HP, actions and content match PDF.

#### Flint Children Squad (page 79)
**Clean** — HP 8, damageType HP, 3 actions match PDF (IED, Demolition Experts, Minefield).

#### Cuspers Squad (page 79)
**Clean** — HP 6, damageType HP, actions and content match PDF.

#### Fell Stalkers Squad (page 79)
**Issue** — "Thermal Goggles" vs PDF's "Thermal Optics". See issue #6. HP 8, damageType HP, other actions correct.

#### Free Hill Coalition Squad (page 79)
**Clean** — HP 10, damageType HP, actions and content match PDF.

### creatures.json
*3 entries from Rainmaker source*

#### Basement Frogs (page 81 in data)
**Issue** — Page should be 80. See issue #4. HP 2, actions (Pseudo-teeth, Tongue Lash, Ambush), content all correct.

#### Ghost (page 81 in data)
**Issue** — Page should be 80. See issue #4. HP 4, actions correct.

#### Ghost Haunt (page 81 in data)
**Issue** — Page should be 80. See issue #4. HP 12, actions correct.

### bio-titans.json
*4 entries from Rainmaker source*

#### Apophis (page 81)
**Clean** — SP 60, 5 actions match PDF. Content matches.

#### Hill Worm Pattern Typhon (page 82 in data)
**Issue** — Page should be 80 (appears on same CREATURES page). See issue #5. SP 67 (from base Typhon), actions include Metallic Reconstitution + base Typhon abilities.

#### Genbu (page 82)
**Clean** — SP 47, 7 actions match PDF. Content matches.

#### Physalis (page 83)
**Clean** — SP 34, 6 actions match PDF. Content matches.

### sources.json
*1 entry from Rainmaker source*

#### Rainmaker (page 1)
**Clean** — Source entry with purchaseLink and descriptive content. All fields appropriate.

## Full Entry Index

| # | Entity | File | Page (data) | Status |
|---|--------|------|-------------|--------|
| 1 | Wader | chassis.json | 60 | CRITICAL: 6 wrong stats |
| 2 | Stolas | chassis.json | 62 | Clean |
| 3 | Ravager | chassis.json | 64 | Issue: ability name/content |
| 4 | Agares | chassis.json | 66 | Issue: missing Hell Fumes |
| 5 | Black Dragon | chassis.json | 68 | Clean |
| 6 | Paladin | chassis.json | 70 | Clean |
| 7 | Cerberus | chassis.json | 72 | Clean (info note) |
| 8 | Royce Pattern (Scrapper) | chassis.json | - | Issue: missing source/page |
| 9 | Gruman Pattern (Neura-Phage) | chassis.json | - | Issue: missing source/page |
| 10 | Napalm Shotgun | systems.json | 76 | Clean |
| 11 | Genetic Lock | modules.json | 76 | Clean |
| 12 | Deployable .50 Cal Machine Gun | equipment.json | 77 | Clean |
| 13 | Machine Pistols | equipment.json | 77 | Clean |
| 14 | Epoxy Gun | equipment.json | 77 | Clean |
| 15 | Rebar Lance | equipment.json | 77 | Clean |
| 16 | Servo Lasso | equipment.json | 77 | Clean |
| 17 | Fell Rifle | equipment.json | 77 | Clean |
| 18 | Gully Crusher Squad | squads.json | 79 | Clean |
| 19 | Flint Children Squad | squads.json | 79 | Clean |
| 20 | Cuspers Squad | squads.json | 79 | Clean |
| 21 | Fell Stalkers Squad | squads.json | 79 | Issue: Thermal Goggles name |
| 22 | Free Hill Coalition Squad | squads.json | 79 | Clean |
| 23 | Basement Frogs | creatures.json | 81 | Issue: page should be 80 |
| 24 | Ghost | creatures.json | 81 | Issue: page should be 80 |
| 25 | Ghost Haunt | creatures.json | 81 | Issue: page should be 80 |
| 26 | Apophis | bio-titans.json | 81 | Clean |
| 27 | Hill Worm Pattern Typhon | bio-titans.json | 82 | Issue: page should be 80 |
| 28 | Genbu | bio-titans.json | 82 | Clean |
| 29 | Physalis | bio-titans.json | 83 | Clean |
| 30 | Rainmaker | sources.json | 1 | Clean |
