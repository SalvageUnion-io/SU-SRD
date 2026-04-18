# Review: False Flag (Pages 8-71)

Independent blind review comparing JSON data against PDF source.

## Chassis

### Kelpie (p.54)

**DISCREPANCY - System Slots**: PDF shows **6**, JSON has **8**.
- PDF SPEC.sts: SYSTEM SLOTS = 6
- JSON `systemSlots`: 8

**DISCREPANCY - Heat Capacity**: PDF shows **7**, JSON has **7**. OK.

**DISCREPANCY - 10 Finger Pattern systems**: PDF file tree on p.54 shows 5 systems: `rigging_arm.sys`, `frost_protection.sys`, `escape_hatch.sys`, `flood_lights.sys`, `cargo_pod.sys`. JSON has 5 systems matching these. OK.

**DISCREPANCY - 10 Finger Pattern `legalStarting`**: The Sifter Pattern has no `legalStarting` flag (non-starting pattern). The 10 Finger Pattern has `legalStarting: true`. Consistent with the fact that the Sifter Pattern is a converted variant. OK.

All other Kelpie stats (SP: 7, EP: 9, Module Slots: 3, Cargo: 6, TL: 1, SV: 3) match PDF.

### Trooper (p.56)

All stats match PDF (SP: 16, EP: 5, HC: 12, System Slots: 16, Module Slots: 3, Cargo: 6, TL: 2, SV: 5).

**Chassis Ability**: PDF says "This Chassis gains the Dependable Trait. Additionally, you may re-roll results on the Critical Damage Table and on failed Heat Checks." JSON has `"chassisAbilities": ["Dependable Chassis"]`. The ability name is "Dependable Chassis" which is not the heading used in the PDF -- the PDF section heading is "CHASSIS ABILITIES" and the content describes the ability without giving it a specific name. However, this is a naming convention in the data, not a content error.

**DronTek Pattern**: PDF on p.57 file tree shows: `drontek_rifle.sys` (which maps to K4 Rifle in the loadout text), `armoured_shield.sys`, 2x `artic_rigging_arm.sys`, 2x `chaff_launcher.sys`, `ejection_system.sys`, `flood_lights.sys`, `locomotion_system.sys`. That's 9 systems.

JSON has 9 systems: K4 Rifle, Armoured Shield, 2x Articulated Rigging Arm, 2x Chaff Launcher, Ejection System, Floodlights, Locomotion System.

**DISCREPANCY - DronTek Pattern system name**: PDF file tree shows `drontek_rifle.sys` but the loadout text on p.57 does NOT list a "DronTek Rifle" -- it shows a system file. The K4 Rifle system (p.67) is a separate mech system. Looking at the p.57 file tree more carefully, the first system is `drontek_rifle.sys` which likely corresponds to `K4 Rifle` (the DronTek mech rifle). The JSON uses "K4 Rifle" which matches the actual system name on p.67. This seems correct.

Modules: Comms Module, Reactor Flare, M315 Motion Scanner -- matches JSON. OK.

### Pioneer (p.58)

All stats match PDF (SP: 17, EP: 12, HC: 8, System Slots: 14, Module Slots: 4, Cargo: 6, TL: 2, SV: 6). OK.

**Chassis Ability**: "Sub-Zero Engineered Chassis" matches PDF heading. OK.

**Deerstalker Pattern**: PDF p.59 lists:
- SYSTEMS: Mech Melee Armament (Spear), Overcharged Green Laser, Articulated Rigging Arm, Ejection System, Floodlights, Locomotion System, Tracking Node (7 systems)
- MODULES: Comms Module, Multi-Optics, Tracking Node

Wait -- PDF loadout on p.59 shows:
- SYSTEMS: Mech Melee Armament (Spear), Overcharged Green Laser, Articulated Rigging Arm, Ejection System, Floodlights, Locomotion System
- MODULES: Comms Module, Multi-Optics, Tracking Node

**DISCREPANCY - Deerstalker Pattern: Tracking Node placement**: The PDF file tree on p.59 shows `tracking_node.mdl` under `_MODULES` folder, NOT under `_SYSTEMS`. The loadout text also lists "Tracking Node" under MODULES. But in JSON, Tracking Node is listed under `"systems"` array, not `"modules"`.

JSON has:
- systems: Mech Melee Armament, Green Laser, Articulated Rigging Arm, Ejection System, Floodlights, Locomotion System, Tracking Node (7 items)
- modules: Comms Module, Multi-Optics (2 items)

PDF has:
- systems: 6 items (the file tree shows 6 .sys files)
- modules: 3 items including Tracking Node (the file tree shows 3 .mdl files)

**This is a data error**: Tracking Node should be in `modules`, not `systems`, for the Deerstalker Pattern.

**DISCREPANCY - Deerstalker Pattern system name**: PDF file tree shows `OC_green_laser.sys` and the loadout text says "Overcharged Green Laser". JSON has `"name": "Green Laser"` -- missing the "Overcharged" prefix. Wait, let me recheck.

Actually, looking at the JSON again: `{"name": "Green Laser"}`. The PDF loadout text on p.59 says "Overcharged Green Laser". The system defined on p.68 is called "Overcharged Green Laser". **The JSON pattern entry says "Green Laser" but should say "Overcharged Green Laser"**.

Wait, I need to re-read the JSON more carefully. Line 203 shows `{"name": "Green Laser"}`. But the PDF p.59 file tree shows `OC_green_laser.sys` and the loadout text says "Overcharged Green Laser".

**CONFIRMED DISCREPANCY**: Pattern system should be "Overcharged Green Laser", not "Green Laser".

### Parasite (p.60)

All stats match PDF (SP: 24, EP: 0*, HC: 5, System Slots: 17, Module Slots: 9, Cargo: 6, TL: 5, SV: 13). The EP shows "0*" in the PDF with an asterisk, and JSON has `energyPoints: 0`. OK.

**Chassis Abilities**: "Parasitic Reactor" and "Parasitic Membrane" match PDF. OK.

**Stefanus Pattern** (p.61): PDF loadout lists:
- SYSTEMS: Needle Missile Pod (3), Ejector Pod, High Gain Antenna, Multi-Phase Shield, Spider Locomotion System
- MODULES: Aardvarks Tongue, Comms Module, Eggs Mayhem, Encrypted Comms, Firewall, Mech Scrambler, Panda Sneeze, Reactor Overload, Sleeping Beauty (9 modules)

JSON matches exactly. OK.

### Big Brother (p.62)

All stats match PDF (SP: 43, EP: 9, HC: 14, System Slots: 23, Module Slots: 4, Cargo: 6, TL: 5, SV: 15). OK.

**Chassis Abilities**: "Cumbersome" and "Big Brother Drone Controller" match PDF. OK.

**DronTek Pattern** (p.63): PDF loadout lists:
- SYSTEMS: Stabilising Locomotion System (5), Missile Pod (7), Railgun (9), Ejection System (2)
- MODULES: Comms Module, Adv. Targeting Array, Firewall

JSON matches. OK.

**DronTek Pattern Drone loadouts** (p.63):
PDF shows 4 drone types:
- DRONE 1 (SHIELD): Systems: Refractive Shield Projector, Electro-Magnetic Shield Projector. Modules: Energy Cell.
- DRONE 2 (ANTI-MISSILE): Systems: Laser Anti-Missile System, Chaff Launcher x2. Modules: Evasion Protocols.
- DRONE 3 (FIRE SUPPORT): Systems: .50 Cal Machine Gun, Target Painter. Modules: Sonic Screecher.
- DRONE 4 (MINELAYER): Systems: Anti-Mech Mine Layer. Modules: Self Destruct.

JSON pattern drone only includes DRONE 1 data: `"drone": {"systems": ["Refractive Shield Projector", "Electro-Magnetic Shield Projector"], "modules": ["Energy Cell"]}`.

**DISCREPANCY - Missing drone loadouts**: The JSON pattern only includes Drone 1 (Shield) configuration. Drones 2, 3, and 4 configurations from the PDF are missing. This may be a data model limitation rather than a transcription error, but it means the DronTek Pattern is incomplete.

### Big Brother Drone (p.62)

PDF drone stats: SP: 3, EP: 4, HC: 4, System Slots: 4, Module Slots: 1, Cargo: 2, TL: 5, SV: 1.

JSON matches all stats. OK.

**DISCREPANCY - Drone `techLevel`**: PDF shows Tech Level 5 for the drone. JSON has `techLevel: 5`. OK, matches.

**Drone ability**: PDF says "INTEGRATED HOVER LOCOMOTION SYSTEM: The Big Brother Drone has an Integrated Hover Locomotion System allowing it to hover over obstacles and terrain. See p.179 of the Salvage Union Core Book." JSON `systems` array has `["Hover Locomotion System"]`. The PDF calls it "Integrated Hover Locomotion System" but JSON just says "Hover Locomotion System". This may be intentional (the "Integrated" prefix indicates it's a chassis ability, and the underlying system name is "Hover Locomotion System"). Minor naming difference, likely not an error.

### X0315 (p.64)

All stats match PDF (SP: 5, EP: 0, HC: 1, System Slots: 0, Module Slots: 0, Cargo: 0, TL: N, SV: 15). OK.

**Chassis Abilities**: PDF lists MELD, Integrated Meld Locomotion, Integrated Neuralink Communicator, Mech Replication. JSON matches. OK.

## Systems

### Frost Protection (p.67)
- PDF: Tech 2, Slot 3, Slug 4. JSON: TL 2, Slots 3, SV 4. OK.

### Hydrologic Locomotion System (p.67)
- PDF: Tech 2, Slot 4, Slug 3. JSON: TL 2, Slots 4, SV 3. OK.

### K4 Rifle (p.67)
- PDF: Tech 2, Slot 1, Slug 2. JSON: TL 2, Slots 1, SV 2. OK.
- PDF action: Range Long, Damage 3 SP, Ballistic, Dependable. JSON action matches. OK.

### Cryopod System (p.67)
- PDF: Tech 3, Slot 3, Slug 1. JSON: TL 3, Slots 3, SV 1. OK.

### Meld Injector (p.68)
- PDF: Tech 3, Slot 2, Slug 2. JSON: TL 3, Slots 2, SV 2. OK.

### Meld Manipulator (p.68)
- PDF: Tech 3, Slot 2, Slug 2. JSON: TL 3, Slots 2, SV 2. OK.

### Overcharged Green Laser (p.68)
- PDF: Tech 3, Slot 4, Slug 2. JSON: TL 3, Slots 4, SV 2. OK.
- PDF action: Range Medium, Damage 5 SP, Hot (4), Energy. JSON action matches. OK.

### Nanite Sifter (p.68)
- PDF: Tech 4, Slot 4, Slug 4. JSON: TL 4, Slots 4, SV 4. OK.

### Meld Spore Launcher (p.68)
- PDF: Tech N, Slot 7, Slug 5. JSON: TL N, Slots 7, SV 5. OK.
- PDF action: Range Long, Damage 4SP, Burn (4), Anti-Organic, Explosive (4), Meld Infection. JSON action matches. OK.

### Meld System Replicator (p.69)
- PDF: Tech N, Slot 6, Slug 6. JSON: TL N, Slots 6, SV 6. OK.
- PDF Replicate action: Turn Action, Cost 4EP, Range Close. JSON action matches. OK.

### Meld Tendrils (p.69)
- PDF: Tech N, Slot 6, Slug 6. JSON: TL N, Slots 6, SV 6. OK.
- PDF action: Range Medium, Damage 4SP, Melee, Meld Infection, Multiattack (2). JSON action matches. OK.

**DISCREPANCY - Meld Tendrils action name**: The PDF header says "MELD INJECTOR" for this system's ability description on p.69, but the content describes tendril strikes. This appears to be a PDF error (wrong heading), not a JSON error. The JSON correctly names the action "Meld Tendrils".

## Modules

### Heating Unit (p.69)
- PDF: Tech 1, Slot 1, Slug 1. JSON: TL 1, Slots 1, SV 1. OK.
- PDF action: Free Action, Cost 1EP. JSON action matches. OK.

**DISCREPANCY - Heating Unit page**: JSON has `page: 59` but the Heating Unit system/module info appears on p.67/69 of the PDF (in the systems/modules section). Page 59 is the Pioneer/Deerstalker pattern page. The Heating Unit appears in the pattern file trees on p.54-55 and the full stats are on p.69 (bottom left). JSON `page: 59` should likely be **69**.

Wait -- actually, looking more carefully at the PDF layout, the Heating Unit box appears at bottom-left of p.69. But it could be argued that p.59 references it in context of the Pioneer page. Let me re-examine. The Pioneer is on p.58-59, and the Heating Unit is listed in the Kelpie patterns (p.54-55). The actual Heating Unit stat block is on p.69. The JSON `page` likely should reference where the stat block is: **p.69**, not p.59.

### Pop Goes The Weasel (p.69)
- PDF: Tech 4, Slot 2, Slug 4. JSON: TL 4, Slots 2, SV 4. OK.
- PDF action: Turn Action, Range Medium, Hacking, Cost XEP. JSON action matches. OK.

**DISCREPANCY - Pop Goes The Weasel page**: JSON has `page: 59`. The stat block appears on p.69. Should be **69**.

### Meld Module Replicator (p.69)
- PDF: Tech N, Slot 2, Slug 4. JSON: TL N, Slots 2, SV 4. OK.

**DISCREPANCY - Meld Module Replicator page**: JSON has `page: 59`. The stat block appears on p.69. Should be **69**.

### Meld Regenerator (p.70)
- PDF: Tech N, Slot 3, Slug 5. JSON: TL N, Slots 3, SV 5. OK.

### Meld Distorter (p.70)
- PDF: Tech N, Slot 2, Slug 5. JSON: TL N, Slots 2, SV 5. OK.

## Equipment (p.71)

### DronTek Rifle
- PDF: Tech 2. JSON: TL 2. OK.
- PDF action: Range Long, Damage 4 HP, Dependable. JSON action matches. OK.

### Portable Cryopod
- PDF: Tech 3. JSON: TL 3. OK.

### Overcharged Green Laser Rifle
- PDF: Tech 3. JSON: TL 3. OK.
- PDF action: Range Medium, Damage 6 HP, Energy, Unwieldy. JSON action matches. OK.

### Handheld Meld Injector
- PDF: Tech 3. JSON: TL 3. OK.

### Handheld Meld Manipulator
- PDF: Tech 3. JSON: TL 3. OK.

### Meld Rifle
- PDF: Tech 4. JSON: TL 4. OK.
- PDF action: Range Medium, Damage 4 HP, Anti-Organic, Meld Infection. JSON action matches. OK.

## Keywords

### anomalous zone (p.9)
- PDF: "When Pilots are in an Anomalous Zone, roll on the Anomaly Table on p.10-11 for each journey or each hour spent in the area as appropriate."
- JSON: "When Pilots are in an Anomalous Zone, they must roll on the Anomaly Table on pages 10-11 for each journey or hour spent in the area."
- **Minor wording difference**: PDF says "or each hour spent in the area as appropriate", JSON says "or hour spent in the area" (missing "each" and "as appropriate"). Also PDF says "p.10-11", JSON says "pages 10-11". Also JSON adds "they must" which is not in the PDF.

### difficult terrain (p.9)
- Matches PDF. OK.

### freezing (p.9)
- **DISCREPANCY**: PDF freezing table uses range format "11 - 19", "6 - 10", "2 - 5". The JSON flattens this into a single paragraph. Content is substantively correct but formatting differs from the table layout in the PDF.

### low visibility (p.9)
- Matches PDF. OK.

### surface ice (p.9)
- Matches PDF. OK.

### corporate scrip (p.9)
- Matches PDF. OK.

## Roll Tables

### Rumour Table (p.8)
- All 20 entries match PDF content. OK.

**DISCREPANCY - Rumour #2**: PDF says "Novosrik has been dead for years, and they blame the Vornayans for it." JSON matches. OK.

**DISCREPANCY - Rumour #5**: PDF says "Stefanus listens to everything within Ostfjord Port and stores it all somewhere in the city." JSON matches. OK.

**DISCREPANCY - Rumour #19**: PDF says "An exec living up in Isston has a high tech Medbay." JSON matches. OK. (Note: PDF spells it "Isston" on p.8 but "Isston" on p.53 as well, so consistent.)

**DISCREPANCY - Rumour #20**: PDF says "The Meld wants to destroy us all and become one again." JSON says "The Meld wants to destroy us all and become one again." Matches.

### Meld Encounter Table (p.9)
- PDF: 20: 4x Active Meld Nanites, 11-19: 6x Meld Nanoids, 6-10: 5x Meld Drone Swarm, 2-5: 3x Meld Splitter, 1: Meld Behemoth.
- JSON matches. OK.

**DISCREPANCY - Meld Encounter table entry for roll 1**: PDF says "Meld Behemoth" with a note "(See p.288 - 291 SU Core Book)". JSON just says "Meld Behemoth" without the page reference. Minor omission.

### Anomalous Zone Table (p.10-11)
Comparing all 20 entries:

**DISCREPANCY - Entry 2 (PIERCER)**: PDF says "Piercers create horrendous echoes which reverberate through the skulls of anyone who hears them. Any creature that can hear within the Far Range of a Piercer will suffer a Minor Injury and be deaf for the next hour. This also affects Pilots in Mechs. Piercers tend to emanate from hollow forms of scrap, such as pipes, barrels, empty cockpits, or cargo holds."

JSON says: "These creatures create horrendous echoes. Any creature within their Far Range suffers a Minor Injury and is deaf for an hour, including Pilots in Mechs. Piercers are often found emanating from hollow scrap, pipes, barrels, empty cockpits, or cargo holds."

This is a summarization, not a verbatim copy. The meaning is preserved but wording differs significantly.

**DISCREPANCY - Entry 4 (GRAVITY MUSHER)**: PDF says "Exposed Pilots within the anomaly are reduced to 0 HP and must roll on the Critical Injury Table. If they remain there for longer than a minute, they will be killed." JSON says the same substantively but with slightly different wording. OK.

**DISCREPANCY - Entry 7 (ZAPPER)**: PDF says "they will deal 2 SP damage to a random Mech or Vehicle within Medium Range (including themselves)". JSON says "they deal 2 SP damage to a random Mech or Vehicle (including themselves)". **Missing "within Medium Range"** in the JSON.

**DISCREPANCY - Entry 8 (HEAT HAZE)**: PDF says "Each hour a Mech spends within it will increase its Heat Capacity by 2 and force a Heat Check." JSON says "Each hour, a Mech's Heat increases by 2, forcing a Heat Check." PDF says "Heat Capacity" increases, JSON says "Heat" increases. These mean different things mechanically -- **"Heat Capacity" vs "Heat"** is a significant distinction. The PDF text is "increase its Heat Capacity by 2" which would be a buff (more capacity). But contextually this should be "Heat" (gaining heat), so the JSON may actually be the correct interpretation. Flagging for GM review.

Wait, re-reading the PDF more carefully: "This anomaly causes the area to be superheated. Each hour a Mech spends within it will increase its Heat Capacity by 2 and force a Heat Check." This is ambiguous in the PDF itself. The JSON interpretation of "Heat increases by 2" makes more mechanical sense. This may be a PDF typo that the JSON corrected, but worth noting.

**DISCREPANCY - Entry 9 (SLIMER)**: Minor wording differences but content matches. OK.

**DISCREPANCY - Entry 14 (IRRADIATED ANOMALY)**: PDF says "This anomaly causes radiation to spike to dangerous levels. The area this anomaly is present in counts as Irradiated as per the Salvage Union Core Rules p.323. Further to this anything infected by Meld in the area becomes irradiated as well." JSON says similar but with different wording. OK.

All other Anomalous Zone entries are substantively correct with minor wording/summarization differences throughout.

## Traits

### dependable (p.8)
- PDF: "This weapon won't break, jam, or otherwise suffer any adverse effects through use, including through Tough Choices and Setbacks."
- JSON matches. OK.

## Sources

### False Flag (p.1)
- Content matches PDF introduction. OK.

## Summary of Confirmed Discrepancies

### Data Errors (should be fixed)

| # | Entity | Field | PDF Value | JSON Value | Severity |
|---|--------|-------|-----------|------------|----------|
| 1 | Kelpie (chassis) | systemSlots | 6 | 8 | **HIGH** - incorrect stat |
| 2 | Pioneer Deerstalker Pattern | systems/modules | Tracking Node is a Module | Tracking Node listed as System | **HIGH** - wrong slot type |
| 3 | Pioneer Deerstalker Pattern | systems[1].name | "Overcharged Green Laser" | "Green Laser" | **HIGH** - wrong system name |
| 4 | Heating Unit (module) | page | 69 | 59 | **MEDIUM** - wrong page ref |
| 5 | Pop Goes The Weasel (module) | page | 69 | 59 | **MEDIUM** - wrong page ref |
| 6 | Meld Module Replicator (module) | page | 69 | 59 | **MEDIUM** - wrong page ref |
| 7 | Anomalous Zone entry 7 (ZAPPER) | content | "within Medium Range" | range qualifier missing | **MEDIUM** - missing mechanical detail |

### Minor/Cosmetic Issues

| # | Entity | Field | Note |
|---|--------|-------|------|
| 8 | Big Brother DronTek Pattern | drone config | Only Drone 1 (Shield) loadout included; Drones 2-4 missing |
| 9 | anomalous zone keyword | content | Minor wording differences from PDF ("they must", "pages" vs "p.") |
| 10 | Anomalous Zone table entries | content | Several entries are summarized rather than verbatim from PDF |
| 11 | Meld Encounter entry 1 | content | Missing "(See p.288 - 291 SU Core Book)" page reference |
| 12 | Anomalous Zone entry 8 (HEAT HAZE) | content | PDF says "Heat Capacity" but JSON says "Heat" -- PDF may itself be erroneous |
