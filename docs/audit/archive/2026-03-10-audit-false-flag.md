# False Flag Expansion Audit
*Date: 2026-03-10*
*Auditor: false-flag agent*
*PDF: False Flag Digital Edition 1.1*

## Summary
- Total False Flag entries found: 40 (across 9 files)
- Total issues found: 8
- Issues by type:
  - Wrong page: 3
  - Wrong/incomplete content: 3
  - Missing field: 0
  - Dead key: 0
  - Purposeless key: 0
  - Data classification conflict: 1
  - Pattern data gap: 1

## All Discovered Entries

| # | File | Entity Name | Page | Status |
|---|------|-------------|------|--------|
| 1 | sources.json | False Flag | 1 | Clean |
| 2 | traits.json | dependable | 8 | Clean |
| 3 | roll-tables.json | Rumour | 8 | Clean |
| 4 | keywords.json | anomalous zone | 9 | Clean |
| 5 | keywords.json | difficult terrain (False Flag) | 9 | Clean |
| 6 | keywords.json | freezing | 9 | Clean |
| 7 | keywords.json | low visibility | 9 | Clean |
| 8 | keywords.json | surface ice | 9 | Clean |
| 9 | keywords.json | corporate scrip | 9 | Clean |
| 10 | roll-tables.json | Meld Encounter | 9 | ISSUE |
| 11 | roll-tables.json | Anomalous Zone | 10 | ISSUE |
| 12 | chassis.json | Kelpie | 54 | ISSUE |
| 13 | chassis.json | Trooper | 56 | Clean |
| 14 | chassis.json | Pioneer | 58 | ISSUE |
| 15 | chassis.json | Parasite | 60 | Clean |
| 16 | chassis.json | Big Brother | 62 | ISSUE |
| 17 | chassis.json | X0315 | 64 | Clean |
| 18 | drones.json | Big Brother Drone | 62 | Clean |
| 19 | systems.json | Frost Protection | 67 | Clean |
| 20 | systems.json | Hydrologic Locomotion System | 67 | Clean |
| 21 | systems.json | K4 Rifle | 67 | Clean |
| 22 | systems.json | Cryopod System | 67 | Clean |
| 23 | systems.json | Meld Injector | 68 | Clean |
| 24 | systems.json | Meld Manipulator | 68 | Clean |
| 25 | systems.json | Overcharged Green Laser | 68 | Clean |
| 26 | systems.json | Nanite Sifter | 68 | Clean |
| 27 | systems.json | Meld Spore Launcher | 68 | Clean |
| 28 | systems.json | Meld System Replicator | 69 | Clean |
| 29 | systems.json | Meld Tendrils | 69 | Clean |
| 30 | modules.json | Heating Unit | 59 | ISSUE |
| 31 | modules.json | Pop Goes The Weasel | 59 | ISSUE |
| 32 | modules.json | Meld Module Replicator | 59 | ISSUE |
| 33 | modules.json | Meld Regenerator | 70 | Clean |
| 34 | modules.json | Meld Distorter | 70 | Clean |
| 35 | equipment.json | DronTek Rifle | 71 | Clean |
| 36 | equipment.json | Portable Cryopod | 71 | Clean |
| 37 | equipment.json | Overcharged Green Laser Rifle | 71 | Clean |
| 38 | equipment.json | Handheld Meld Injector | 71 | Clean |
| 39 | equipment.json | Handheld Meld Manipulator | 71 | Clean |
| 40 | equipment.json | Meld Rifle | 71 | Clean |

## Issues by File

### modules.json

#### Heating Unit (page 59)
**Issue**: Wrong page number
**Details**: Data says page 59. The Heating Unit module description appears on PDF page 69 in the "SYSTEMS_MODULES_EQUIPMENT.dll" section. Page 59 is the Pioneer's Deerstalker Pattern page, which does not feature the Heating Unit.
**Suggested fix**: Change `"page": 59` to `"page": 69`

#### Pop Goes The Weasel (page 59)
**Issue**: Wrong page number
**Details**: Data says page 59. The Pop Goes The Weasel module description appears on PDF page 69 in the "SYSTEMS_MODULES_EQUIPMENT.dll" section. Page 59 is the Pioneer's Deerstalker Pattern page.
**Suggested fix**: Change `"page": 59` to `"page": 69`

#### Meld Module Replicator (page 59)
**Issue**: Wrong page number
**Details**: Data says page 59. The Meld Module Replicator description appears on PDF page 69 in the "SYSTEMS_MODULES_EQUIPMENT.dll" section. Page 59 is the Pioneer's Deerstalker Pattern page.
**Suggested fix**: Change `"page": 59` to `"page": 69`

### chassis.json

#### Kelpie (page 54)
**Issue**: System Slots value differs from PDF
**Details**: Data says `systemSlots: 8`. PDF SPEC.sts panel on p.54 shows `SYSTEM SLOTS: 6`. However, calculating slot costs for both patterns:
- 10 Finger Pattern: Rigging Arm (2) + Frost Protection (3) + Escape Hatch (1) + Floodlights (1) + Cargo Pod (1) = **8 slots**
- Sifter Pattern: Nanite Sifter (4) + Cryopod System (3) + Floodlights (1) = **8 slots**
Both patterns require exactly 8 system slots, confirming the data value of 8 is correct and the PDF has a typo.
**Suggested fix**: None needed in data. The PDF appears to have a typo (6 should be 8). Note for reference only.

#### Pioneer — Deerstalker Pattern (page 58-59)
**Issue**: Wrong system reference in pattern
**Details**: The Deerstalker pattern's systems array contains `"Green Laser"` (a Tech 2 system from the core book). The PDF p.59 clearly shows `OC_green_laser.sys` in the file tree and lists "Overcharged Green Laser" in the LOADOUT section. The Overcharged Green Laser is a distinct False Flag system (Tech 3, p.68).
**Suggested fix**: In the Deerstalker pattern's systems array, change `{"name": "Green Laser"}` to `{"name": "Overcharged Green Laser"}`

**Additional note — Tracking Node placement**: The data lists "Tracking Node" in the pattern's `systems` array, but the PDF p.59 shows `tracking_node.mdl` under _MODULES and lists it under MODULES in the LOADOUT. However, Tracking Node is defined as a System entity in `systems.json` (from the core book, p.172). The PDF appears to have misclassified it. No data change recommended, but worth noting.

#### Big Brother — DronTek Pattern (page 62-63)
**Issue**: Pattern only captures 1 of 4 drone configurations
**Details**: The PDF p.63 shows 4 distinct drone loadouts for the DronTek Pattern:
1. **SHIELD DRONE**: Refractive Shield Projector, Electro-Magnetic Shield Projector / Energy Cell
2. **ANTI-MISSILE DRONE**: Laser Anti-Missile System, Chaff Launcher x2 / Evasion Protocols
3. **FIRE SUPPORT DRONE**: .50 Cal Machine Gun, Target Painter / Sonic Screecher
4. **MINELAYER DRONE**: Anti-Mech Mine Layer / Self Destruct

The data only captures drone type 1 (Shield Drone):
```json
"drone": {
  "systems": ["Refractive Shield Projector", "Electro-Magnetic Shield Projector"],
  "modules": ["Energy Cell"]
}
```
This is a schema limitation — the `drone` field in `PatternSchema` is a single `{ systems, modules }` object, not an array.
**Suggested fix**: This would require a schema change to support multiple drone configs (e.g., `drones: { name, systems, modules }[]`). Flag for future consideration. At minimum, document the other 3 drone loadouts in the pattern's `content` field.

### roll-tables.json

#### Meld Encounter (page 9)
**Issue**: Minor content omission on entry 1
**Details**: The PDF entry for roll result "1" reads: "Meld Behemoth (See p.288 - 291 SU Core Book)". The data only has `"value": "Meld Behemoth"`, omitting the cross-reference to the core book pages.
**Suggested fix**: Change entry 1 value to `"Meld Behemoth (See p.288 - 291 SU Core Book)"` — or keep as-is if cross-references are intentionally excluded from data.

#### Anomalous Zone (page 10)
**Issue**: Content is paraphrased/summarized rather than verbatim
**Details**: All 20 anomaly entries use shortened/rephrased text compared to the PDF. Examples:
- Entry 1 (Meld Dust Swarm): Omits that swarms are "carried by the wind towards reactor sources, anomalies, and areas with many biological signatures (such as settlements or even mass graves)"
- Entry 3 (Sludger): Omits mention of the "Nanite Salvaging" trait specifically
- Entry 4 (Gravity Musher): Simplified from detailed description about "some anomalies may be larger than others"
- Entry 7 (Zapper): Data says "a random Mech or Vehicle within Medium Range" but PDF says the target gains 1 EP (both are in the data actually, but the Medium Range detail is added)
- Entry 18 (Transmogrification): Data omits "choose a random System or Module on it" detail

The core mechanical effects are generally preserved, but flavor text and some specifics are lost. This appears to be a deliberate summarization choice rather than an error, but some mechanical details are affected.
**Suggested fix**: Review each entry against the PDF and restore any missing mechanical details. Flavor text summarization is acceptable.

## Clean Entries (No Issues Found)

### sources.json (1 entry)
- **False Flag** (p.1): Purchase link present, description paragraphs match PDF back cover text. All fields valid.

### traits.json (1 entry)
- **dependable** (p.8): Text matches PDF verbatim. Correct page.

### keywords.json (6 entries)
- **anomalous zone** (p.9): Content accurate, correct page.
- **difficult terrain (False Flag)** (p.9): Content accurate, minor wording simplification ("compared to normal" omitted).
- **freezing** (p.9): Content accurate. Note: freezing effect table is embedded as text in content paragraphs rather than structured as a roll table entity, but this appears intentional.
- **low visibility** (p.9): Content accurate, correct page.
- **surface ice** (p.9): Content accurate, correct page.
- **corporate scrip** (p.9): All 4 paragraphs present and match PDF. Correct page.

### roll-tables.json — Rumour Table (1 entry)
- **Rumour** (p.8): All 20 entries verified against PDF. Text matches verbatim. Flat table type correct.

### chassis.json (4 clean entries)
- **Trooper** (p.56): All stats match PDF. DronTek Pattern systems/modules match p.57 file tree and loadout. Description text accurate. Chassis ability "Dependable Chassis" matches.
- **Parasite** (p.60): All stats match PDF. Stefanus Pattern systems/modules match p.61 file tree and loadout (Needle Missile Pod count:3 correct). Description text accurate. Chassis abilities "Parasitic Reactor" and "Parasitic Membrane" match.
- **X0315** (p.64): All stats match PDF (including Tech Level "N", EP 0, System/Module/Cargo all 0). Chassis abilities match. Empty patterns array is correct (no patterns in PDF). Description text accurate.
- **Kelpie** (p.54): 10 Finger and Sifter pattern loadouts match PDF (aside from systemSlots PDF typo noted above). Description text accurate. Both patterns' content paragraphs match.

### drones.json (1 entry)
- **Big Brother Drone** (p.62): All stats match PDF drone spec panel exactly (SP:3, EP:4, HC:4, SysSlots:4, ModSlots:1, Cargo:2, TL:5, SV:1). Default system "Hover Locomotion System" noted in content.

### systems.json (11 entries)
All 11 False Flag systems verified against PDF pp.67-69:
- **Frost Protection** (p.67): Tech 2, Slot 3, Salvage 4 — all match.
- **Hydrologic Locomotion System** (p.67): Tech 2, Slot 4, Salvage 3 — all match.
- **K4 Rifle** (p.67): Tech 2, Slot 1, Salvage 2 — all match.
- **Cryopod System** (p.67): Tech 3, Slot 3, Salvage 1 — all match.
- **Meld Injector** (p.68): Tech 3, Slot 2, Salvage 2 — all match.
- **Meld Manipulator** (p.68): Tech 3, Slot 2, Salvage 2 — all match.
- **Overcharged Green Laser** (p.68): Tech 3, Slot 4, Salvage 2 — all match.
- **Nanite Sifter** (p.68): Tech 4, Slot 4, Salvage 4 — all match. Has 2 actions (Nanite Sifter, Refine).
- **Meld Spore Launcher** (p.68): Tech N, Slot 7, Salvage 5 — all match.
- **Meld System Replicator** (p.69): Tech N, Slot 6, Salvage 6 — all match. Has 2 actions (Meld System Replicator, Replicate).
- **Meld Tendrils** (p.69): Tech N, Slot 6, Salvage 6 — all match.

### modules.json (2 clean entries)
- **Meld Regenerator** (p.70): Tech N, Slot 3, Salvage 5 — all match. Has 3 actions.
- **Meld Distorter** (p.70): Tech N, Slot 2, Salvage 5 — all match.

### equipment.json (6 entries)
All 6 False Flag equipment items verified against PDF p.71:
- **DronTek Rifle** (p.71): Tech 2 — matches.
- **Portable Cryopod** (p.71): Tech 3 — matches.
- **Overcharged Green Laser Rifle** (p.71): Tech 3 — matches.
- **Handheld Meld Injector** (p.71): Tech 3 — matches.
- **Handheld Meld Manipulator** (p.71): Tech 3 — matches.
- **Meld Rifle** (p.71): Tech 4 — matches.

## Notes

1. **Anomalous Zone table summarization**: The 20 anomaly entries are systematically paraphrased across the board. This appears to be a deliberate editorial choice to keep entries concise. Most mechanical effects are preserved, but some flavor text and minor mechanical details (specific trait names, nuanced conditionals) are lost.

2. **Freezing keyword embedded table**: The Freezing keyword contains a standard roll table (20/11-19/6-10/2-5/1 ranges) embedded as plain text within a content paragraph. This could potentially be extracted into a separate roll table entity for UI rendering consistency, but works as-is.

3. **Big Brother drone schema limitation**: The pattern schema's `drone` field only supports a single drone loadout. The Big Brother's DronTek Pattern in the PDF describes 4 distinct drone configurations. This is a known schema limitation flagged for future consideration.
