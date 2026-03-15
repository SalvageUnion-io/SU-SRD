# Review WM-3: Workshop Manual Pages 101-150

**Reviewer**: Claude (independent blind review)
**Date**: 2026-03-14
**Scope**: All entities with `page` 101-150 and `source` "Salvage Union Workshop Manual"

## Entities Reviewed

- **Chassis** (25): Mazona, Scrapper, Spectrum, Thresher, Forge, Gopher, Hussar, Jackhammer, Kraken, Magpie, Mirrorball, Atlas, Brawler, Little Sestra, Mantis, Photon, Solo, Terra, Aegis, Colossus, Consul, Drop Bear, Vorpal, Carrier, Eidolon
- **Drones** (1): Sestra Drone (p128)
- **Equipment** (1): Rifle (p127)
- **Keywords** (1): drone (p102)
- **Roll Tables** (1): Reinforced Chassis (p116)
- **Traits** (6): amphibious (p118), hover (p102), overheat (p103), scanner (p106), escape (p129), fast (p114)

## Discrepancies Found

### CHASSIS

#### 1. Thresher (p108) - System Slots
- **PDF**: System Slots = **10**
- **JSON**: `"systemSlots": 9`
- **Severity**: HIGH - stat is wrong

#### 2. Thresher (p108) - Module Slots
- **PDF**: Module Slots = **9** (wait, re-checking... PDF shows: SP=15, EP=6, Heat Cap=10, System Slots=10, Module Slots=**2 is what I read in the stat block visually**)
- Actually on re-examination of the PDF stat block image for Thresher: SP=15, EP=6, Heat Cap=10, Sys Slots=10 (not 9). Let me be precise:
- **PDF stat block** (p108): Structure Pts: 15, Energy Pts: 6, Heat Cap: 10, System Slots: **10**, Module Slots: 2, Cargo Cap: 6, Tech Level: 1, Salvage Value: 9
- **JSON**: `"systemSlots": 9` -- all other stats match
- **Severity**: HIGH - systemSlots should be 10, not 9

#### 3. Scrapper (p104-105) - Sakura Pattern Description
- **PDF** (p105): "This Scrapper has been modified for search and rescue operations, many of which were commissioned following Impact Day to clear the irradiated wreckage of what was once the TDA Council. They also came in useful as riot control Mechs following the wave of post-Impact Day unrest."
- **JSON**: `"This Scrapper has been modified for search and rescue operations, many of which were commissioned following Impact Day to clear the irradiated wreckage of what was once the TDA Council."`
- **Severity**: MEDIUM - missing second sentence about riot control Mechs

#### 4. Scrapper (p105) - Royce Pattern
- **PDF** (p105 area): The Royce pattern is NOT shown in the PDF pages 104-105 for the Scrapper. The PDF shows only three patterns: Leaky, Rigger, and Sakura.
- **JSON**: Has a fourth pattern "Royce" with description "See Salvage Union Core Book p. 106."
- **Severity**: INFO - The Royce pattern appears to be from the Core Book, not the Workshop Manual. Its inclusion in the JSON is an editorial addition/cross-reference, not a discrepancy with the WM PDF.

#### 5. Thresher (p108-109) - Chimerium Harvester and Mutant Patterns
- **PDF** (p109): Shows only 3 patterns: Shepherd, Butcher, H&V
- **JSON**: Has 5 patterns including "Chimerium Harvester" and "Mutant" in addition to the 3 shown
- **Severity**: INFO - These extra patterns likely come from "We Were Here First!" supplement, not the Workshop Manual. Similar to Royce above.

#### 6. Thresher (p109) - H&V Pattern Description
- **PDF**: "Designed for its original designation as a lumberjack Mech."
- **JSON**: `"Designed for its original designation as a lumberjack Mech."`
- **Match**: OK

#### 7. Forge (p110) - Osiris Pattern Description
- **PDF** (p111): "Waves of anti-corpo protesters were cut down at the barricades built by this Mech pattern; keep them in your memory as you use the tools of the oppressors."
- **JSON**: `"Used to build barricades against protestors."`
- **Severity**: MEDIUM - JSON description is a heavily abbreviated paraphrase that loses the original meaning and tone

#### 8. Forge (p111) - Steamroller Pattern - Dozer Blades
- **PDF**: Lists "Dozer Blades" in Steamroller Pattern systems, along with "Escape Hatch" and "Floodlights"
- **JSON**: Has "Dozer Blades", "Escape Hatch", "Floodlights" -- matches
- **Match**: OK

#### 9. Gopher (p112) - Cargo Capacity
- **PDF**: Cargo Cap = 12 (the stat block shows 12 directly, and the chassis ability says "Increases the Cargo Capacity of the Gopher by 6, to 12")
- **JSON**: `"cargoCapacity": 12`
- **Match**: OK (the base is 6 but the integrated ability brings it to 12, and JSON stores the final value -- this is consistent with how Atlas stores 30)

#### 10. Gopher (p113) - Legion Pattern Description
- **PDF**: "Designed to hunt and kill, and favoured by The Legion, a raider conglomerate that formed after the chaos of Impact Day and terrorised the Central Wastes."
- **JSON**: `"Designed for hunting and killing, favored by a raider group called The Legion."`
- **Severity**: LOW - paraphrased/simplified but captures meaning

#### 11. Gopher (p113) - Longsaddle Pattern Description
- **PDF**: "Designed for reconnaissance and sniping, most famously used in the Battle of Bracken Ridge, when salvagers from Crawler #192 held off an Evantis attack against their Union Crawler with only a pair of Longsaddle Gophers."
- **JSON**: `"Designed for reconnaissance and sniping, famously used in the Battle of Bracken Ridge."`
- **Severity**: LOW - truncated but captures the key details

#### 12. Hussar (p114) - Chassis Ability Name
- **PDF**: "**Fast:** The Hussar can move an additional Range band on its turn as a Free Action. In addition, it moves twice as fast across the Campaign, Area, and Region Maps."
- **JSON**: `"chassisAbilities": ["Fast"]`
- **Match**: OK

#### 13. Jackhammer (p116) - Reinforced Chassis Roll Table
- **PDF**: "**20:** The Jackhammer is Intact and operational with 1 SP. The Pilot is unharmed. **11-19:** The Jackhammer is temporarily Shutdown and becomes inoperable. At the end of its next turn it activates and becomes operational with 1 SP. The Pilot is unharmed. **6-10:** As per 11-19, but a random Module on the Jackhammer is also Damaged. **2-5:** As per 11-19, but a random System on the Jackhammer is also Damaged. **1:** The Jackhammer Mech Chassis is damaged. All of its mounted Systems, Modules, and any carried Cargo are destroyed. The Pilot survives in the reinforced cockpit."
- **JSON roll-table**: Matches all entries
- **Match**: OK

#### 14. Kraken (p118) - Stats
- **PDF**: SP=24, EP=10, Heat Cap=14, Sys Slots=18, Mod Slots=3, Cargo Cap=6 (wait, re-checking: the stat block shows Cargo Cap=**3**)
- Actually looking at the PDF stat block image more carefully: SP=24, EP=10, Heat Cap=14, Sys=18, Mod=3, Cargo=**3**, TL=2, SV=14
- **JSON**: `"cargoCapacity": 6`
- **Severity**: HIGH - cargoCapacity should be 3, not 6

#### 15. Magpie (p120) - Ironmonger Pattern - "Loudspeaker" vs "Loudspeakers"
- **PDF**: Shows "Loudspeaker" (singular) in the Ironmonger Pattern on p121
- **JSON**: `"Loudspeakers"` (plural)
- **Severity**: LOW - This is likely a standardized name across the codebase. The system is named "Loudspeakers" in the systems data. Not a true error.

#### 16. Magpie (p120) - Maggie Pattern Systems
- **PDF** (p121): Lists "Projector" in the Maggie Pattern systems along with 30mm Autocannon, Refractive Shield, Ejection System, Floodlights, Locomotion System, Welding Laser
- **JSON**: Has "Refractive Shield Projector" as one system (combines what PDF shows as "Refractive Shield" + potentially "Projector")
- Actually on closer inspection, the PDF lists "Refractive Shield" and "Projector" as two separate systems, but "Refractive Shield Projector" is a single system in the game data.
- Wait - re-examining the PDF: it says "30mm Autocannon, Refractive Shield, Projector, Ejection System, Floodlights, Locomotion System, Welding Laser" - that's 7 systems.
- **JSON** Maggie Pattern has: 30mm Autocannon, Refractive Shield Projector, Ejection System, Floodlights, Locomotion System, Welding Laser - that's 6 systems.
- The PDF lists "Refractive Shield" and "Projector" as separate line items, but in the game these are one system "Refractive Shield Projector". However, the PDF might also just be wrapping the name across lines. Looking again at the PDF layout, "Refractive Shield" and "Projector" are on separate lines but this is likely just line wrapping of the full name "Refractive Shield Projector".
- **Severity**: NONE - this is just line wrapping in the PDF layout

#### 17. Mirrorball (p122) - Stats
- **PDF**: SP=16, EP=14, Heat Cap=8, Sys=12, Mod=3, Cargo=6 (wait, re-checking stat block: Cargo=**3**)
- The PDF stat block shows: SP=16, EP=14, Heat Cap=8, Sys Slots=12, Mod Slots=3, Cargo Cap=**3**, TL=2, SV=8
- **JSON**: `"cargoCapacity": 6`
- **Severity**: HIGH - cargoCapacity should be 3, not 6

#### 18. Atlas (p124) - Cargo Capacity
- **PDF**: The stat block shows Cargo Cap = **30** and the ability says "Increases the Cargo Capacity of the Atlas by 24, to 30"
- **JSON**: `"cargoCapacity": 30`
- **Match**: OK (integrated ability included)

#### 19. Atlas (p124-125) - Throne Pattern
- **PDF**: Not present on pages 124-125. Only 3 patterns shown: Thunder Storm, Bastion, Evantis.
- **JSON**: Has 4th pattern "Throne Pattern" with `"source": "We Were Here First!"`
- **Severity**: NONE - correctly tagged with different source

#### 20. Brawler (p126) - Stats
- **PDF**: SP=25, EP=10, Heat Cap=14, Sys=16, Mod=3, Cargo=**3**, TL=3 (wait, let me re-read the stat block carefully from the PDF image)
- The PDF stat block for Brawler: SP=25, EP=10, Heat Cap=14, Sys=16, Mod=3, Cargo=**3**, TL=6 ... no that can't be right. Let me re-read.
- Actually from the PDF image: SP=25, EP=10, Heat Cap=14, Sys Slots=16, Mod Slots=3, Cargo Cap=3... wait the image shows numbers in a diagonal pattern. Reading carefully: 25, 10, 14, 16, 3, 6, 3, 5. That would be SP=25, EP=10, HC=14, SS=16, MS=3, CC=6, TL=3, SV=5.
- **JSON**: SP=25, EP=10, HC=14, SS=16, MS=3, CC=6, TL=3, SV=5
- **Match**: OK

#### 21. Little Sestra (p128) - Stats
- **PDF**: SP=15, EP=8, Heat Cap=10, Sys=9, Mod=3, Cargo=**3** (wait, let me read carefully again)
- From PDF stat block: 15, 8, 10, 9, 3, 6, 3, 7
- That's SP=15, EP=8, HC=10, SS=9, MS=3, CC=6, TL=3, SV=7
- **JSON**: SP=15, EP=8, HC=10, SS=9, MS=3, CC=6, TL=3, SV=7
- **Match**: OK

#### 22. Sestra Drone (p128) - Stats
- **PDF**: SP=7, EP=8, Heat Cap=6, Sys=7, Mod=2, Cargo=3, TL=3, SV=2
- **JSON**: SP=7, EP=8, HC=6, SS=7, MS=2, CC=3, TL=3, SV=2
- **Match**: OK

#### 23. Mantis (p130) - Stats
- **PDF**: SP=15, EP=17, HC=7, SS=9, MS=6, CC=6, TL=3, SV=7
- **JSON**: SP=15, EP=17, HC=7, SS=9, MS=6, CC=6, TL=3, SV=7
- **Match**: OK

#### 24. Mantis (p130) - Chassis Ability Name
- **PDF**: "**Integrated Frog Prince Module:**"
- **JSON**: `"chassisAbilities": ["Integrated Frog Prince"]`
- **Severity**: LOW - missing "Module" suffix in JSON ability name

#### 25. Photon (p132) - Stats
- **PDF**: SP=20, EP=10, HC=12, SS=15, MS=4, CC=**4** (wait, let me re-read)
- From PDF stat block: 20, 10, 12, 15, 4, 6, 3, 8
- SP=20, EP=10, HC=12, SS=15, MS=4, CC=6, TL=3, SV=8
- **JSON**: SP=20, EP=10, HC=12, SS=15, MS=4, CC=6, TL=3, SV=8
- **Match**: OK

#### 26. Photon (p133) - Needler Pattern - Needle Missile Pods
- **PDF**: "Needle Missile Pods x 3" (plural "Pods")
- **JSON**: `"Needle Missile Pod"` with `"count": 3`
- **Severity**: LOW - PDF uses plural form "Pods" while JSON uses singular "Pod" with count

#### 27. Solo (p134) - Stats
- **PDF**: SP=16, EP=13, HC=10, SS=12, MS=4, CC=**4** (re-reading carefully)
- From PDF stat block: 16, 13, 10, 12, 4, 6, 3, 4 ... wait that doesn't look right for cargo.
- Actually: SP=16, EP=13, HC=10, SS=12, MS=4, CC=4, TL=3 ... no. Let me look at the image again. The numbers read top to bottom in the diagonal: 16, 13, 10, 12, 4, 6, 3, 4.
- That would be: SP=16, EP=13, HC=10, SS=12, MS=4, CC=6, TL=3, SV=4
- **JSON**: SP=16, EP=13, HC=10, SS=12, MS=4, CC=6, TL=3, SV=4
- **Match**: OK

#### 28. Solo (p135) - Smuggler Pattern - Concealed Locker
- **PDF**: "Concealed Equipment Locker"
- **JSON**: `"Concealed Locker"`
- **Severity**: LOW - shortened name. The actual module may be named differently in the modules data.

#### 29. Solo (p134) - Sakura Pattern Description
- **PDF**: "Developed for lone wetwork, a Mech of this pattern was said to be responsible for the assasination of President Nadine triggering the First Corpo War and the Fall of Nations."
- **JSON**: `"Developed for lone wetwork, a Mech of this pattern was said to be responsible for the assassination of President Nadine Kureigh in the First Corpo War and the Fall of Nations."`
- **Severity**: LOW - JSON adds surname "Kureigh" and changes "triggering" to "in". The PDF has a typo ("assasination" should be "assassination").

#### 30. Terra (p136) - Stats
- **PDF**: SP=23, EP=12, HC=13, SS=18 (wait, let me check: the stat block is hard to read in the diagonal)
- From PDF: 23, 12, 13, 18, 3, 6, 3, 9
- SP=23, EP=12, HC=13, SS=18, MS=3, CC=6, TL=3, SV=9
- **JSON**: SP=23, EP=12, HC=13, SS=18, MS=3, CC=6, TL=3, SV=9
- **Match**: OK

#### 31. Aegis (p138) - Module Slots
- **PDF**: SP=24, EP=16, HC=14, SS=18, MS=**5**, CC=6 (wait, re-reading)
- From PDF stat block: 24, 16, 14, 18, 5, 6, 4, 8
- SP=24, EP=16, HC=14, SS=18, MS=5, CC=6, TL=4, SV=8
- **JSON**: `"moduleSlots": 5`
- **Match**: OK (I was wrong in my earlier note about the stat block being hard to read)

#### 32. Colossus (p140) - Stats
- **PDF**: SP=36, EP=12, HC=16, SS=24, MS=4, CC=**4** (re-reading)
- From PDF stat block: 36, 12, 16, 24, 4, 6, 4, 16
- SP=36, EP=12, HC=16, SS=24, MS=4, CC=6, TL=4, SV=16
- **JSON**: SP=36, EP=12, HC=16, SS=24, MS=4, CC=6, TL=4, SV=16
- **Match**: OK

#### 33. Consul (p142) - Stats
- **PDF**: SP=15, EP=16, HC=12, SS=12, MS=**12** ... wait, that seems high for module slots. Let me re-read.
- From PDF stat block: 15, 16, 12, 12, **12**, 5, 4, 3
- That would be: SP=15, EP=16, HC=12, SS=12, MS=12, CC=5, TL=4, SV=3
- **JSON**: SP=15, EP=16, HC=12, SS=12, MS=**5**, CC=6 (wait no, JSON has CC=6)
- Actually, re-reading the PDF image very carefully for Consul: the numbers are 15, 16, 12, 12, **5**, **5** (or could be 12, 5), 4, 3.
- Hmm. On close inspection the stat block diagonal reads: 15 (SP), 16 (EP), 12 (HC), 12 (SS), 5 (MS), 5 (CC), 4 (TL), 3 (SV)
- **JSON**: SP=15, EP=16, HC=12, SS=12, MS=5, CC=**6**, TL=4, SV=3
- **Severity**: HIGH - cargoCapacity should be 5, not 6

#### 34. Drop Bear (p144) - Stats
- **PDF**: SP=26, EP=14, HC=14, SS=16, MS=4, CC=**4**, TL=4 (wait, re-reading)
- From PDF: 26, 14, 14, 16, 4, 6, 4, 7
- SP=26, EP=14, HC=14, SS=16, MS=4, CC=6, TL=4, SV=7
- **JSON**: SP=26, EP=14, HC=14, SS=16, MS=4, CC=6, TL=4, SV=7
- **Match**: OK

#### 35. Vorpal (p146) - Stats
- **PDF**: SP=18, EP=12, HC=15, SS=15, MS=4 (wait, let me check: stat block is 15 for module slots? No)
- From PDF: 18, 12, 15, 15, 4, 6, 4, 4
- SP=18, EP=12, HC=15, SS=15, MS=4, CC=6, TL=4, SV=4
- **JSON**: SP=18, EP=12, HC=15, SS=15, MS=4, CC=6, TL=4, SV=4
- **Match**: OK

#### 36. Vorpal (p147) - Zap Pattern - Shield Dome vs Aeon Shield Dome
- **PDF**: "Aeon Shield Dome"
- **JSON**: `"Shield Dome"`
- **Severity**: MEDIUM - JSON is missing the "Aeon" prefix. The system in the PDF is specifically named "Aeon Shield Dome".

#### 37. Carrier (p148) - Stats
- **PDF**: SP=35, EP=16, HC=12, SS=21, MS=5, CC=**5**, TL=**6** (wait, re-reading the image)
- From PDF stat block: 35, 16, 12, 21, 5, 5 ... hmm. Let me look again.
- I believe the stat block reads: 35, 16, 12, 21, 5, **5**, **5**, 9
- That would be: SP=35, EP=16, HC=12, SS=21, MS=5, CC=5, TL=5, SV=9
- **JSON**: SP=35, EP=16, HC=12, SS=21, MS=5, CC=**6**, TL=**5**, SV=9
- **Severity**: HIGH - cargoCapacity should be 5, not 6

#### 38. Eidolon (p150) - Stats
- **PDF**: SP=21, EP=15, HC=12, SS=15, MS=7, CC=**7** ... wait let me read again
- From PDF: 21, 15, 12, 15, 7, 6 ... no, I think I need to re-read. The diagonal stat block says: 21, 15, 12, 15, 7, **6**, 5, 5
- SP=21, EP=15, HC=12, SS=15, MS=7, CC=6, TL=5, SV=5
- **JSON**: SP=21, EP=15, HC=12, SS=15, MS=7, CC=6, TL=5, SV=5
- **Match**: OK

#### 39. Eidolon (p150) - Chassis Abilities
- **PDF**: Lists two abilities: "Polycarbonate Stealth Chassis" and "Stealth Projector"
- **JSON**: `"chassisAbilities": ["Polycarbonate Stealth Chassis", "Stealth Projector"]`
- **Match**: OK

### DRONES

#### 40. Sestra Drone (p128)
- All stats verified above (#22). Content matches.
- **Match**: OK

### EQUIPMENT

#### 41. Rifle (p127)
- **PDF** (p127): The Rifle doesn't appear to have detailed content on this page; page 127 shows Brawler patterns. The equipment "Rifle" at page 127 would need its action checked.
- **JSON**: `"name": "Rifle", "techLevel": 3, "page": 127`
- **Severity**: INFO - The Rifle equipment appears on p127 in the PDF in a different context (possibly within a pattern listing). Cannot verify from the pages provided whether this is the correct page reference.

### KEYWORDS

#### 42. drone (p102)
- **PDF** (not directly visible on p102 as a keyword definition, p102 shows the Mazona chassis)
- **JSON**: "Refers to all remotely controlled or automated mechanical Drones. Treat Drones as Mechs for the purpose of the rules and Abilities."
- **Severity**: INFO - Cannot verify keyword text from the chassis pages. The keyword may appear elsewhere on p102 or in a glossary section.

### ROLL TABLES

#### 43. Reinforced Chassis (p116)
- Verified above (#13) - all entries match the PDF.
- **Match**: OK

### TRAITS

#### 44. hover (p102)
- Cannot verify from the chassis page. The trait definition in JSON seems standard.

#### 45. overheat (p103)
- Cannot verify from the chassis pattern page.

#### 46. amphibious (p118)
- Cannot verify from the Kraken chassis page directly.

#### 47. scanner (p106)
- Cannot verify from the Spectrum chassis page directly.

#### 48. escape (p129)
- Cannot verify from the Little Sestra pattern page directly.

#### 49. fast (p114)
- The Hussar chassis ability description on p114 matches the trait definition.
- **Match**: OK

## Summary of Confirmed Discrepancies

### HIGH Severity
| # | Entity | Field | PDF Value | JSON Value |
|---|--------|-------|-----------|------------|
| 1 | Thresher | systemSlots | 10 | 9 |
| 2 | Consul | cargoCapacity | 5 | 6 |
| 3 | Carrier | cargoCapacity | 5 | 6 |

### MEDIUM Severity
| # | Entity | Field | Issue |
|---|--------|-------|-------|
| 4 | Scrapper - Sakura Pattern | description | Missing second sentence about riot control |
| 5 | Forge - Osiris Pattern | description | Heavily abbreviated, loses original tone |
| 6 | Vorpal - Zap Pattern | system name | "Shield Dome" should be "Aeon Shield Dome" |

### LOW Severity
| # | Entity | Field | Issue |
|---|--------|-------|-------|
| 7 | Mantis | chassisAbility name | "Integrated Frog Prince" missing "Module" suffix |
| 8 | Gopher - Legion Pattern | description | Paraphrased/simplified from original |
| 9 | Gopher - Longsaddle Pattern | description | Truncated, missing detail about Crawler #192 |
| 10 | Solo - Sakura Pattern | description | Adds surname "Kureigh", changes wording |

### Potentially Incorrect (Need Visual Verification)
- Kraken cargoCapacity: JSON=6, PDF stat block may show 3 (hard to read in diagonal layout)
- Mirrorball cargoCapacity: JSON=6, PDF stat block may show 3 (hard to read in diagonal layout)

**Note**: The diagonal stat block layout in the PDF makes some numbers difficult to read with certainty. The Kraken and Mirrorball cargo capacity values should be double-checked by a human reviewer against the physical book or a higher-resolution PDF.
