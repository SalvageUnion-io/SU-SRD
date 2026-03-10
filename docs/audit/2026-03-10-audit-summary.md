# salvageunion-reference Audit Summary
*Date: 2026-03-10*
*Orchestrated by: team-lead (main session)*
*Agents: core-combat, core-other, wwfh, rainmaker, false-flag*

---

## Overview

| Agent | Scope | Entries Audited | Issues Found |
|---|---|---|---|
| core-combat | chassis, actions, systems, modules, equipment | ~219 (actions spot-check only) | 5 |
| core-other | crawlers, classes, abilities, roll-tables, guides, keywords, distances, traits, crawler-bays, crawler-tech-levels, drones, bio-titans, squads, vehicles, creatures, factions, meld | ~200+ | ~30 |
| wwfh | All "We Were Here First!" entries | 49+ | 13 |
| rainmaker | All "Rainmaker" entries | 30 | 10 |
| false-flag | All "False Flag" entries | 40 | 8 |
| **TOTAL** | | **538+** | **66** |

**Good news:** Zero content errors in core-other (all stats, descriptions, table values match PDF exactly). Equipment.json had zero issues. Core chassis stat blocks all verified correct.

**Bad news:** The Rainmaker expansion has critical stat errors; ~30 page number references are wrong in core data; and `actions.json` (611 entries) was not fully audited.

---

## Critical — Fix Immediately

These issues affect gameplay correctness.

### Rainmaker: Wader Chassis Stats Completely Wrong
**File**: `chassis.json`
**Issue**: 6 of 8 stat values differ from PDF.

| Stat | JSON | PDF (p.?) |
|---|---|---|
| SP | 7 | 23 |
| Energy | 10 | 8 |
| TL | 1 | 2 |
| + 3 others | wrong | correct per PDF |

**Fix**: Replace all stat values with correct values from Rainmaker PDF.

---

### Rainmaker: Ravager Chassis Ability Mechanical Mismatch
**File**: `chassis.json` / `actions.json`
**Issue**: Ability name mismatch ("Deployable" in PDF vs "Stabilising" in data) AND a mechanical difference — PDF says "first attack" but data says "all attacks". This changes how the ability functions in play.
**Fix**: Correct both the name and the mechanical text.

---

### Rainmaker: Agares Missing "Hell Fumes" Chassis Ability
**File**: `chassis.json`
**Issue**: PDF shows 3 chassis abilities; data only has 2. "Hell Fumes" is absent entirely.
**Fix**: Add "Hell Fumes" action to `actions.json` and reference it in Agares `chassisAbilities`.

---

### Core Combat: Multi-Function Repair Arm Missing
**File**: `systems.json` (+ `actions.json`)
**Issue**: TL5 system on PDF p.183 has no entry in the data at all. Any chassis that lists it would have a broken reference.
**Fix**: Add system entry to `systems.json` and any associated actions to `actions.json`.

---

### Core Combat: Thresher Butcher Pattern Wrong System + Missing Module
**File**: `chassis.json` (Thresher, Butcher Pattern)
**Issue**: Lists "Loudspeakers" — should be "Escape Hatch". Also missing "Comms Module" from its modules array.
**Fix**: Replace system reference; add missing module.

---

### False Flag: Pioneer Deerstalker References Wrong System
**File**: `chassis.json` (Pioneer, Deerstalker Pattern)
**Issue**: Lists "Green Laser" (core TL2) but PDF p.59 clearly shows "OC_green_laser.sys" (Overcharged Green Laser, False Flag TL3).
**Fix**: Replace system reference with "Overcharged Green Laser".

---

### WWFH: SAKURA 78TH LANCE MSD Wrong Description
**File**: (squad or faction entry)
**Issue**: `description` field contains goals preamble text instead of the actual PDF description: *"A professional and discreet wet work team on a black ops assignment to Gehenna. Led by Lance Leader 'Moto' (Ace)."*
**Fix**: Replace with correct description.

---

## Needs Human Decision

### WWFH: "Refractive Shield Projector" vs "Energy Shield"
**File**: `chassis.json` (Alpha Pattern, Impaler)
**Issue**: Data lists "Refractive Shield Projector" but PDF p.76 says "Energy Shield". Neither name exists in the other's system list — unclear if these are the same system with a renamed entry, or a missing system.
**Decision needed**: Are these the same system? If yes, which name is canonical? If no, "Energy Shield" needs to be added to systems.json.

---

### Core Combat: Aardvark's Tongue Tech Level (TL3 vs TL4)
**File**: `systems.json`
**Issue**: JSON says TL3, but the system appears under a TL4 header in the PDF (p.202). May be intentional placement, or may be a data error.
**Decision needed**: Check if the system text itself specifies TL, or if it's positionally ambiguous.

---

## Page Number Errors (~40 entries)

Page numbers are used for linking UI to PDF. These are non-breaking but affect usability.

### Core Other: ~30 Wrong Pages (roll-tables.json worst offender)

| Entry | File | JSON page | Correct page |
|---|---|---|---|
| Core Mechanic | roll-tables.json | 2 | 232 |
| Group Initiative | roll-tables.json | 330 | 236 |
| Critical Injury | roll-tables.json | 323 | 241 |
| Critical Damage | roll-tables.json | 338 | 240 |
| NPC Action | roll-tables.json | 336 | 267 |
| Morale | roll-tables.json | 167 | 268 |
| Retreat | roll-tables.json | 42 | 268 |
| Mech Salvage | roll-tables.json | 2 | 248 |
| Keepsake | roll-tables.json | 24 | 90 |
| Motto | roll-tables.json | 24 | 90 |
| Pilot Appearance | roll-tables.json | 332 | 91 |
| Mech Appearance | roll-tables.json | 94 | 208 |
| Crawler Deterioration | roll-tables.json | 7 | 219 |
| All 6 TL entries | tech-levels.json | 1 | 162–163 |
| Meld Splitter | meld.json | 270 | 289 |
| 4 creatures | creatures.json | 266/272 | 296/297 |
| 2 squads | squads.json | 274/270 | 300/301 |
| Trooper NPC | npcs.json | 274 | 298 |

*9 additional entries have pages 8–11 / 22–23 that couldn't be verified — may be adventure content.*

### False Flag: 3 Modules Wrong Page (59 → 69)
- Heating Unit
- Pop Goes The Weasel
- Meld Module Replicator

### Rainmaker: 4 Entries Wrong Page (81/82 → 80)
- 3 creatures + Hill Worm Typhon

### Core Combat: 2 Page Refs Wrong
- Survey Scanner: JSON 194 → correct 192
- He2 Coolant Flush: JSON 197 → correct 205

---

## Missing / Incomplete Data

### WWFH: 4 Factions Missing Formation Members
Formations are mechanically significant for mediator encounter setup.

| Faction | Missing |
|---|---|
| Trash Locusts | "Rotorcraft (1x Raider Band inside)" |
| Chimerium Cult | "Waster Mob x 2" |
| Red Mesa Mutants | "Chimerium Mutant Mob" |
| Wagon Wasters | "Waster Mob x 2" |

### False Flag: Big Brother DronTek Missing 3 Drone Configurations
**Issue**: PDF shows 4 drone loadout options (Shield, Anti-Missile, Fire Support, Minelayer). Data only has Shield.
**Note**: This may require a schema change — the current schema appears to support a single `drone` field rather than an array of configurations.

### WWFH: Salvage Cache Table Entry 5 Truncated
**Issue**: Entry reads "An Acid Spitter" — PDF says "An Acid Spitter Mule".

### Rainmaker: Fell Stalkers Squad Wrong Equipment Name
**Issue**: Data says "Thermal Goggles", PDF says "Thermal Optics".

---

## Missing Source Attribution

These entries exist in the data but lack `source` / `page` fields pointing to their expansion:

**WWFH patterns on core chassis (3 entries):**
- Mutant Pattern on Thresher
- Acid Spitter Pattern on Mule
- Chimerium Harvester Pattern on Thresher
*Fix: Add `source: "We Were Here First!"` and correct page ref to each.*

**Rainmaker patterns on core chassis (2 entries):**
- Royce Pattern
- Gruman Pattern
*Fix: Add `source: "Rainmaker"` and `page: 78` to each.*

---

## Dead Keys / Structural Issues

### WWFH: 2 Empty `content: []` Arrays
- Experimental Bio Pattern
- Chimerium Mutant Squad
*Fix: Either populate or remove the key.*

### WWFH: Chimerium Mutation Table Entry 13 — Incorrect Format
*Entry has a label/value split that doesn't match the format of all other entries. Fix to be value-only.*

### False Flag: Meld Encounter Table Entry 1 Missing Cross-Reference
*Missing "(See p.288–291 SU Core Book)" from Meld Behemoth entry.*

### False Flag: Anomalous Zone Table — Paraphrased Text
*All 20 entries use shortened descriptions. Core mechanics preserved but some specifics lost (e.g., "Nanite Salvaging" trait name omitted from Sludger entry). Low priority but worth a pass for fidelity.*

---

## Audit Gaps

### actions.json — Not Fully Audited
`actions.json` has **611 entries** and was only spot-checked by `core-combat`. This file contains all mech/pilot actions, chassis abilities, creature actions, and NPC actions. A dedicated audit pass is strongly recommended — the Ravager and Agares issues found in Rainmaker suggest there may be similar content errors in other action entries.

**Recommendation**: Run a second pass specifically on `actions.json`, grouped by source, checking content against PDF for each action.

### Mech Monday Entries — No PDF Verification
Community-submitted entries (`source: "Mech Monday"`) have no PDF to verify against. These were confirmed structurally sound (all required fields present, valid schema) but content accuracy cannot be audited.

---

## Summary by Priority

| Priority | Count | Category |
|---|---|---|
| Critical (fix now) | 7 | Data errors affecting gameplay |
| Needs decision | 2 | Ambiguous — requires human ruling |
| Page number errors | ~40 | Non-breaking, affects PDF linking |
| Missing data | 7 | Incomplete entries |
| Missing attribution | 5 | Source/page fields absent |
| Dead keys / structure | 4 | Schema hygiene |
| **TOTAL ISSUES** | **65+** | |

Individual audit reports:
- [`2026-03-10-audit-core-combat.md`](./2026-03-10-audit-core-combat.md)
- [`2026-03-10-audit-core-other.md`](./2026-03-10-audit-core-other.md)
- [`2026-03-10-audit-wwfh.md`](./2026-03-10-audit-wwfh.md)
- [`2026-03-10-audit-rainmaker.md`](./2026-03-10-audit-rainmaker.md)
- [`2026-03-10-audit-false-flag.md`](./2026-03-10-audit-false-flag.md)
