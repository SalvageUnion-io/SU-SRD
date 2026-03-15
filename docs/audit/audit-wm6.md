# Audit Report: WM-6 (Workshop Manual pages 251-300)

## Summary
- Pages reviewed: 251-300
- Entities checked: 51
- Discrepancies found: 15

## Discrepancies

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Artl | creatures.json | page | 296 (stat block on Creatures page) | 266 (Denizens overview page) | wrong-data |
| 2 | Molebear | creatures.json | page | 297 (stat block on Creatures page) | 266 (Denizens overview page) | wrong-data |
| 3 | Carrion Bird | creatures.json | page | 297 (stat block on Creatures page) | 266 (Denizens overview page) | wrong-data |
| 4 | Chimeripede | creatures.json | page | 296 (stat block on Creatures page) | 272 (encounter table page) | wrong-data |
| 5 | Meld Splitter | meld.json | page | 289 (stat block on Meld page) | 270 (encounter table page) | wrong-data |
| 6 | Wasteland Herd | squads.json | page | 301 (stat block on Squads page) | 270 (encounter table page) | wrong-data |
| 7 | Trooper | npcs.json | page | 298 (stat block on People page) | 274 (encounter table page) | wrong-data |
| 8 | Machine Gun Squad | squads.json | page | 300 (stat block on Squads page) | 274 (encounter table page) | wrong-data |
| 9 | Defacer Drone | drones.json | page | 294 (stat block on Drones page) | 274 (encounter table page) | wrong-data |
| 10 | Combat Drone | drones.json | page | 294 (stat block on Drones page) | 270 (encounter table page) | wrong-data |
| 11 | Heavy Combat Drone | drones.json | page | 294 (stat block on Drones page) | 270 (encounter table page) | wrong-data |
| 12 | Pest Drone | drones.json | page | 295 (stat block on Drones page) | 270 (encounter table page) | wrong-data |
| 13 | Typhon | bio-titans.json | content | "Vengeance of the earth. This terrifying spiked worm can even swallow a Colossus whole. Some believe the spirits of miners in the Ferrous Range, who died in industrial accidents, summoned this being in vengeance." | Same text (matches) but PDF reads "can even swallow" vs JSON "can even swallow" -- however the PDF omits the comma after "Ferrous Range" that is absent in JSON too. Text matches. | N/A (verified clean on re-check) |
| 14 | Meld Drone Swarm | meld.json | content | "A swarm of multiple zombie-like Meld Drones" (PDF: "A swarm of multiple zombie-like Meld Drones") | "A swarm of multiple zombie-like Meld Drones" (missing period) | typo |
| 15 | Electrophorus | bio-titans.json | content | PDF: "A vast, eel-like Bio-Titan able to harness bioelectric energy. Rumoured to dwell at the deepest point of the world's oceans within the Amara Trench in the Oceanic Rim." | JSON: "A vast, eel-like Bio-Titan able to harness bioelectric energy. Rumoured to dwell at the deepest point of the world's oceans within the Amara Trench in the Oceanic Rim." | N/A (verified clean on re-check) |

**Note on discrepancies 13 and 15:** On closer inspection these matched. Removing from count. Revised count: 13 discrepancies.

## Revised Discrepancy Table

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Artl | creatures.json | page | 296 | 266 | wrong-data |
| 2 | Molebear | creatures.json | page | 297 | 266 | wrong-data |
| 3 | Carrion Bird | creatures.json | page | 297 | 266 | wrong-data |
| 4 | Chimeripede | creatures.json | page | 296 | 272 | wrong-data |
| 5 | Meld Splitter | meld.json | page | 289 | 270 | wrong-data |
| 6 | Wasteland Herd | squads.json | page | 301 | 270 | wrong-data |
| 7 | Trooper | npcs.json | page | 298 | 274 | wrong-data |
| 8 | Machine Gun Squad | squads.json | page | 300 | 274 | wrong-data |
| 9 | Defacer Drone | drones.json | page | 294 | 274 | wrong-data |
| 10 | Combat Drone | drones.json | page | 294 | 270 | wrong-data |
| 11 | Heavy Combat Drone | drones.json | page | 294 | 270 | wrong-data |
| 12 | Pest Drone | drones.json | page | 295 | 270 | wrong-data |
| 13 | Meld Drone Swarm | meld.json | content | PDF has no trailing period on description | JSON: "A swarm of multiple zombie-like Meld Drones" (no period -- matches PDF) | N/A (verified clean) |

**Final revised count: 12 discrepancies (all wrong page numbers).**

## Final Discrepancy Table

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Artl | creatures.json | page | 296 | 266 | wrong-data |
| 2 | Molebear | creatures.json | page | 297 | 266 | wrong-data |
| 3 | Carrion Bird | creatures.json | page | 297 | 266 | wrong-data |
| 4 | Chimeripede | creatures.json | page | 296 | 272 | wrong-data |
| 5 | Meld Splitter | meld.json | page | 289 | 270 | wrong-data |
| 6 | Wasteland Herd | squads.json | page | 301 | 270 | wrong-data |
| 7 | Trooper | npcs.json | page | 298 | 274 | wrong-data |
| 8 | Machine Gun Squad | squads.json | page | 300 | 274 | wrong-data |
| 9 | Defacer Drone | drones.json | page | 294 | 274 | wrong-data |
| 10 | Combat Drone | drones.json | page | 294 | 270 | wrong-data |
| 11 | Heavy Combat Drone | drones.json | page | 294 | 270 | wrong-data |
| 12 | Pest Drone | drones.json | page | 295 | 270 | wrong-data |

## Entities Verified Clean

### Bio-Titans (pages 276-287)
- Scylla (page 276) -- name, SP 39, description, actions all match
- Typhon (page 278) -- name, SP 67, description, actions all match
- Chrysalis (page 280) -- name, SP 80, description, actions all match
- Phantom (page 282) -- name, SP 54, description, actions all match
- Electrophorus (page 284) -- name, SP 96, description, actions all match
- Tyrant (page 286) -- name, SP 215, description, actions all match

### Meld (pages 289-290)
- Meld Drone (page 289) -- name, HP 3, salvage 1, description, actions match
- Meld Drone Swarm (page 289) -- name, HP 6, salvage 3, description, actions match
- Meld Nanoid (page 289) -- name, SP 5, salvage 5, Fast trait, description, actions match
- Meld Behemoth (page 290) -- name, SP 60, description, actions match

### Vehicles (pages 292-293)
- Power Loader (page 292) -- name, SP 1, T1, SV 1, systems, description match
- Box Wheel (page 292) -- name, SP 1, T1, SV 1, Personnel Capacity (4), Wheeled, description match
- Fighting Box Wheel (page 293) -- name, SP 2, T1, SV 2, Personnel Capacity (6), Wheeled, systems match
- Armoured Box Wheel (page 293) -- name, SP 4, T2, SV 3, Personnel Capacity (18), Wheeled, systems match
- Tank (page 293) -- name, SP 6, T3, SV 4, systems match
- Rotorcraft (page 293) -- name, SP 3, T4, SV 3, Personnel Capacity (6), Hover, systems match
- Machine Gun Turret (page 293) -- name, SP 2, T1, SV 1, Immobile, systems match

### Drones (pages 294-295) -- stat blocks verified, page numbers wrong in JSON (see discrepancies)
- Salvo Drone (page 294) -- name, SP 3, T1, SV 2, systems, description match
- Survey Drone (page 294) -- name, SP 1, T1, SV 1, systems, description match
- Walker Drone (page 295) -- name, SP 6, T2, SV 3, systems, description match
- Hover Drone (page 294) -- name, SP 4, T4, SV 3, systems, description match (note: JSON page 294 matches PDF)
- Needle Drone (page 295) -- name, SP 2, T4, SV 3, systems, description match

### Creatures (pages 296-297) -- stat blocks verified, some page numbers wrong in JSON
- Irradiated Scorpion (page 296) -- name, HP 4, description, actions match
- Wasteland Bear (page 297) -- name, HP 5, description, actions match (JSON page 297 matches)

### NPCs/People (page 298)
- Wastelander (page 298) -- name, HP 2, description, actions match
- Raider (page 298) -- name, HP 3, description, actions match
- Veteran (page 298) -- name, HP 9, description, actions match
- Combat Pilot (page 298) -- name, HP 10, description, actions match
- Ace (page 298) -- name, HP 16, description, actions match

### Squads (page 300-301)
- Waster Mob (page 300) -- name, HP 4, description, actions match
- Raider Band (page 300) -- name, HP 6, description, actions match
- Rifle Squad (page 300) -- name, HP 10, description, actions match
- Missile Squad (page 300) -- name, HP 10, description, actions match
- Elite Blade Squad (page 301) -- name, HP 20, description, actions match
- Elite Beam Squad (page 301) -- name, HP 20, description, actions match
- Drone Squadron (page 301) -- name, HP 8 (SP in JSON -- see note), description, actions match

### Keywords (pages in range)
- irradiated (page 296) -- content matches PDF context
- incapacitated (page 255) -- content matches PDF context
- squad (page 300) -- content matches PDF context

### Traits (pages in range)
- burrower (page 278) -- generic trait text, page references Typhon's specific version
- fly (page 280) -- generic trait text, page references Chrysalis's specific version
- poison (page 296) -- content matches PDF context

### Guides (pages in range)
- Tough Choices (page 254) -- all content, steps, list items match PDF
- Map Movement (page 263) -- all content, steps, movement rates match PDF

### Roll Tables (pages in range)
- Reaction Roll (page 268) -- all table entries, labels, values match PDF

### Equipment (pages in range)
- Improvised Melee Weapon (page 298) -- correct page, referenced on People page
- Salvaging Tools (page 298) -- correct page, referenced on People page

## Notes
- All 12 discrepancies are page number issues where the JSON points to a page where the entity is mentioned (encounter tables or overview sections) rather than the page containing the actual stat block. This appears to be a systematic pattern affecting creatures, drones, NPCs, and squads that are first mentioned in encounter tables (pages 270-274) but have their stat blocks later (pages 289-301).
- The Drone Squadron in squads.json uses `damageType: "SP"` and `hitPoints: 8`. The PDF shows "8 SP" for this entity, which is correct -- this squad has Structure Points rather than Hit Points, unlike other squads.
- Salvo Drone and Hover Drone JSON page numbers (294) match the PDF correctly.
- Walker Drone and Needle Drone JSON page numbers (295) match the PDF correctly.
- Wasteland Bear JSON page (297) matches the PDF correctly.
- All NPC stat block pages (298) match for Wastelander, Raider, Veteran, Combat Pilot, Ace.
- All squad pages (300-301) match for Waster Mob, Raider Band, Rifle Squad, Missile Squad, Elite Blade Squad, Elite Beam Squad, Drone Squadron -- except Machine Gun Squad (274 vs 300) and Wasteland Herd (270 vs 301).
