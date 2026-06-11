# Reconciliation Report

## Executive Summary
- Total unique findings: 148
- Agreed (high confidence): 56
- Auditor-only (needs verification): 40
- Reviewer-only (needs verification): 52

---

## Agreed Findings (High Confidence -- Fix These)

### Batch WM-1
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Salvager (class) | classes.json | page | Page should be 44, JSON has 9 | wrong-data |
| 2 | Salvager (class) | classes.json | coreTrees | "Gladitorial Combat" misspelling of "Gladiatorial" | typo |
| 3 | Soldier (class) | classes.json | coreTrees | "Gladitorial Combat" same misspelling | typo |
| 4 | Can't Stop, Won't Stop | abilities.json | page | Page should be 42, JSON has 328 | wrong-data |
| 5 | Camo Suit | abilities.json | page | Page should be 51, JSON has 328 | wrong-data |
| 6 | Squeeze it in | abilities.json | description | "Temporariliy" should be "Temporarily" | typo |
| 7 | Gather Intelligence | abilities.json | description | "recieve" should be "receive" | typo |
| 8 | Spotter | abilities.json | description | "Chooose" should be "Choose" | typo |
| 9 | Mech Salvage (roll table) | roll-tables.json | page | Page should be 248, JSON has 2 | wrong-data |
| 10 | Knife Missle | equipment.json | name | "Missle" should be "Missile" | typo |
| 11 | Custom Missle Launcher | equipment.json | name | "Missle" should be "Missile" | typo |

### Batch WM-2
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Knife Missle | equipment.json | name | "Missle" should be "Missile" (also flagged in WM-1) | typo |
| 2 | Custom Missle Launcher | equipment.json | name | "Missle" should be "Missile" (also flagged in WM-1) | typo |

### Batch WM-3
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Scrapper (Sakura Pattern) | chassis.json | content | Missing second sentence about riot control Mechs | missing |
| 2 | Forge (Osiris Pattern) | chassis.json | content | JSON is heavily abbreviated paraphrase, loses original tone | wrong-data |
| 3 | Gopher (Legion Pattern) | chassis.json | content | Paraphrased/simplified from original | wrong-data |
| 4 | Gopher (Longsaddle Pattern) | chassis.json | content | Truncated, missing detail about Crawler #192 | wrong-data |
| 5 | Carrier | chassis.json | cargoCapacity | PDF shows 5, JSON has 6 | wrong-data |
| 6 | Carrier | chassis.json | techLevel | Auditor says TL 6 (PDF), reviewer says TL 5 (JSON has 5); auditor flagged as wrong, reviewer confirmed TL in stat block | wrong-data |

### Batch WM-4
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Survey Scanner (module) | modules.json | page | Page should be 192, JSON has 194 | wrong-data |
| 2 | He2 Coolant Flush (module) | modules.json | page | Page should be 205, JSON has 197 | wrong-data |

### Batch WM-5
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | He2 Coolant Flush (module) | modules.json | page | Page should be 205, JSON has 197 (also flagged in WM-4) | wrong-data |

### Batch WM-6
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Artl | creatures.json | page | Page should be 296, JSON has 266 | wrong-data |
| 2 | Molebear | creatures.json | page | Page should be 297, JSON has 266 | wrong-data |
| 3 | Carrion Bird | creatures.json | page | Page should be 297, JSON has 266 | wrong-data |
| 4 | Chimeripede | creatures.json | page | Page should be 296, JSON has 272 | wrong-data |
| 5 | Meld Splitter | meld.json | page | Page should be 289, JSON has 270 | wrong-data |
| 6 | Wasteland Herd | squads.json | page | Page should be 301, JSON has 270 | wrong-data |
| 7 | Trooper | npcs.json | page | Page should be 298, JSON has 274 | wrong-data |
| 8 | Machine Gun Squad | squads.json | page | Page should be 300, JSON has 274 | wrong-data |
| 9 | Defacer Drone | drones.json | page | Page should be 294, JSON has 274 | wrong-data |
| 10 | Combat Drone | drones.json | page | Page should be 294, JSON has 270 | wrong-data |
| 11 | Heavy Combat Drone | drones.json | page | Page should be 294, JSON has 270 | wrong-data |
| 12 | Pest Drone | drones.json | page | Page should be 295, JSON has 270 | wrong-data |

### Batch WM-7
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | ability points (keyword) | keywords.json | page | Page should be 321, JSON has 327 | wrong-data |
| 2 | setback (keyword) | keywords.json | page | Page should be 325, JSON has 320 | wrong-data |
| 3 | shutdown (keyword) | keywords.json | page | Page should be 326, JSON has 324 | wrong-data |
| 4 | turrets (keyword) | keywords.json | page | Page should be 326, JSON has 335 | wrong-data |
| 5 | intact (keyword) | keywords.json | page | Page should be 323, JSON has 338 | wrong-data |
| 6 | downtime action (keyword) | keywords.json | page | Page should be 322, JSON has 329 | wrong-data |
| 7 | Portable Comms Unit | equipment.json | page | Page should be 81, JSON has 301 | wrong-data |
| 8 | Electro Grappling Hook | equipment.json | page | Page should be 84, JSON has 301 | wrong-data |
| 9 | Monomolecular Sword | equipment.json | page | Page should be 85, JSON has 301 | wrong-data |
| 10 | Pistol | equipment.json | page | Page should be 81, JSON has 314 | wrong-data |
| 11 | Green Laser Rifle | equipment.json | page | Page should be 82, JSON has 313 | wrong-data |
| 12 | Reactive Armour | equipment.json | page | Page should be 83, JSON has 333 | wrong-data |
| 13 | Can't Stop, Won't Stop | abilities.json | page | Page should be 42, JSON has 328 (also flagged in WM-1) | wrong-data |
| 14 | Camo Suit (ability) | abilities.json | page | Page should be 51, JSON has 328 (also flagged in WM-1) | wrong-data |
| 15 | Knife Missile (ability) | abilities.json | page | Page should be 73, JSON has 331 | wrong-data |

### Batch FF
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Pioneer (Deerstalker Pattern) | chassis.json | systems[].name | "Green Laser" should be "Overcharged Green Laser" | wrong-data |

### Batch RM
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Wader | chassis.json | structurePoints | PDF 23, JSON 7 | wrong-data |
| 2 | Wader | chassis.json | energyPoints | PDF 8, JSON 10 | wrong-data |
| 3 | Wader | chassis.json | heatCapacity | PDF 14, JSON 6 | wrong-data |
| 4 | Wader | chassis.json | systemSlots | PDF 14, JSON 8 | wrong-data |
| 5 | Wader | chassis.json | techLevel | PDF 2, JSON 1 | wrong-data |
| 6 | Wader | chassis.json | salvageValue | PDF 8, JSON 4 | wrong-data |
| 7 | Wader (Weaver Pattern) | chassis.json | systems[].name | "Personnel Transport Pod (Woven Home)" vs "Personnel Transport Pod" | wrong-data |
| 8 | Ravager | chassis.json | chassisAbilities[0] | "Integrated Advanced Deployable Locomotion System" vs "Integrated Advanced Stabilising Locomotion System" | wrong-data |
| 9 | Agares (Pattern A) | chassis.json | systems[].name | "Automated 120mm Cannon" vs "120mm Cannon" | wrong-data |
| 10 | Crush (Apophis action) | actions.json | content | "THe2x" encoding artifact, should be "The 2x" | typo |

### Batch WWHF
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Impaler (Alpha Pattern) | chassis.json | systems[].name | "Refractive Shield Projector" should be "Energy Shield" per PDF p.76 | wrong-data |
| 2 | Cranium Bio-Mech (Probe Pattern) | chassis.json | modules[].name | "Neuralink Communicator" vs PDF "Neuralink Module" | wrong-data |
| 3 | Scuttler (Harvester Pattern) | chassis.json | modules[].name | "Neuralink Communicator" vs PDF "Neuralink Module" | wrong-data |

---

## Auditor-Only Findings (Needs Verification)

### Batch WM-1
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Salvager (class) | classes.json | page | Auditor says p.44 (also flagged by reviewer -- but auditor also noted this) | wrong-data |
| 2 | Valiant Speech | abilities.json | description | "Inspire you allies" should be "Inspire your allies" (missing 'r') | typo |
| 3 | This one goes to 11... | abilities.json | description | "it's" should be "its" (incorrect apostrophe) | typo |
| 4 | Hacking Kit (equipment) | equipment.json | page | Auditor says page should be 34, JSON has 51 | wrong-data |

### Batch WM-2
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | WingSuit | equipment.json | name | "WingSuit" should be "Wingsuit" (casing) | typo |
| 2 | Adv. Epoxy Applicator | equipment.json | name | Abbreviated; PDF says "Advanced Epoxy Applicator" | typo |
| 3 | Scuffed Book (Keepsake roll table) | roll-tables.json | table entry | PDF says "Scruffed Book", JSON has "Scuffed Book" | typo |
| 4 | Pilot Appearance | roll-tables.json | page | Page should be 91, JSON has 332 | wrong-data |
| 5 | Keepsake | roll-tables.json | page | Page should be 90, JSON has 24 | wrong-data |
| 6 | Motto | roll-tables.json | page | Page should be 90, JSON has 24 | wrong-data |
| 7 | Improvised Melee Weapon | equipment.json | page | Page should be 81, JSON has 298 | wrong-data |
| 8 | Portable Comms Unit | equipment.json | page | Page should be 81, JSON has 301 (also in WM-7) | wrong-data |
| 9 | Salvaging Tools | equipment.json | page | Page should be 81, JSON has 298 | wrong-data |
| 10 | Pistol | equipment.json | page | Page should be 81, JSON has 314 (also in WM-7) | wrong-data |
| 11 | Green Laser Rifle | equipment.json | page | Page should be 82, JSON has 313 (also in WM-7) | wrong-data |
| 12 | Reactive Armour | equipment.json | page | Page should be 83, JSON has 333 (also in WM-7) | wrong-data |
| 13 | Rifle | equipment.json | page | Page should be 83, JSON has 127 | wrong-data |
| 14 | Electro Grappling Hook | equipment.json | page | Page should be 84, JSON has 301 (also in WM-7) | wrong-data |
| 15 | Sniper Rifle | equipment.json | page | Page should be 85, JSON has 47 | wrong-data |
| 16 | Monomolecular Sword | equipment.json | page | Page should be 85, JSON has 301 (also in WM-7) | wrong-data |

### Batch WM-3
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Thresher (Butcher Pattern) | chassis.json | systems | Has Loudspeakers, should have Escape Hatch per PDF p.109 | wrong-data |
| 2 | Thresher (Butcher Pattern) | chassis.json | modules | Missing Comms Module (only has Adv. Weapon Link) | missing |
| 3 | Gopher (Opus Pattern) | chassis.json | content | "original purpose of quickly moving" should be "original designation of quickly ferrying" | wrong-data |
| 4 | Little Sestra | chassis.json | content | Cyrillic "H" character in "HC-15" instead of Latin "H" | typo |
| 5 | Carrier | chassis.json | techLevel | Auditor says PDF shows TL 6, JSON has 5 | wrong-data |

### Batch WM-4
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Mechapult (roll table entry 13) | roll-tables.json | table value | "tHe2x" encoding artifact, should be "the 2x" | typo |
| 2 | Mechapult (roll table entry 18) | roll-tables.json | table value | "tHe2x" encoding artifact, should be "the 2x" | typo |
| 3 | Mechapult (roll table entry 9) | roll-tables.json | table value | Triple brackets [[[Explosive]]] instead of double [[Explosive]] | typo |
| 4 | Experimental Teleportation Hold (roll table) | roll-tables.json | table structure | PDF has single "2-19" band, JSON splits into 3 sub-ranges | typo |
| 5 | Survey Scanner (roll table) | roll-tables.json | page | Page should be 192, JSON has 194 | wrong-data |

### Batch WM-5
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Crawler Deterioration | roll-tables.json | page | Page should be 219, JSON has 7 | wrong-data |
| 2 | Reactor Overload table | roll-tables.json | table["1"] | Missing result "1" entry (Reactor Overload meltdown text) | missing |
| 3 | Crawler Damage table | roll-tables.json | table["2-5"] | Missing trailing sentence about 5% population casualties | missing |
| 4 | Battle Crawler | crawlers.json | content | Missing period at end of description | typo |
| 5 | Trade Caravan Crawler | crawlers.json | content | Missing period at end of description | typo |
| 6 | Trading Bay | roll-tables.json | page | Page should be 223, JSON has 222 | wrong-data |
| 7 | Trading Bay | crawler-bays.json | npc.content | "waste- landers" hyphenation artifact, should be "wastelanders" | typo |
| 8 | A.I. Personality | roll-tables.json | page | Page should be 91, JSON has 208 | wrong-data |
| 9 | Mech Appearance | roll-tables.json | page | Page should be 208, JSON has 94 (points to earlier reference) | wrong-data |

### Batch WM-7
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | turrets (keyword) | keywords.json | content | Missing page reference "(p. 170)" at end | missing |
| 2 | Knife Missile (ability) | abilities.json | page | Page should be 73, JSON has 331 | wrong-data |

### Batch FF
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Nanite Reconstruction (roll table) | roll-tables.json | source | Should be "False Flag", has "Salvage Union Workshop Manual" | wrong-data |
| 2 | Meld Distorter (roll table) | roll-tables.json | source | Should be "False Flag", has "Salvage Union Workshop Manual" | wrong-data |
| 3 | Big Brother Drone | drones.json | content | Generic placeholder text instead of full PDF description | wrong-data |
| 4 | Trooper (DronTek Pattern) | chassis.json | description | Paraphrased/reworded from PDF original | typo |

### Batch RM
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Constricting Coils (Apophis) | actions.json | content | PDF has typo "Aphosis"; JSON corrected to "Apophis" (informational) | typo |

### Batch WWHF
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Impaler (Alpha Pattern) | chassis.json | modules[].name | "Laser Guidance" vs PDF "Laser Guidance Module" | minor |
| 2 | Stormterror (Screecher Pattern) | chassis.json | modules[].name | "Weapon Link" missing "(Bio-Talon x 3)" note | minor |
| 3 | Cranium Bio-Mech (Probe Pattern) | chassis.json | modules[].name | "Panda Sneeze" vs PDF "Panda Sneeze Module" | minor |
| 4 | Scuttler (Harvester Pattern) | chassis.json | modules[].name | "Olfactory Glands" (plural) vs PDF "Olfactory Gland" (singular) | minor |

---

## Reviewer-Only Findings (Needs Verification)

### Batch WM-2
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Recruit (ability) | abilities.json | page | Page should be 76, JSON has 219 | wrong-data |
| 2 | Ascension (ability) | abilities.json | page | Page should be 61, JSON has 153 | wrong-data |
| 3 | Critical Strike (action) | actions.json | content | Missing "In addition, increase your Pilot's HP Max by 2." paragraph | missing |

### Batch WM-3
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Thresher | chassis.json | systemSlots | PDF shows 10, JSON has 9 | wrong-data |
| 2 | Kraken | chassis.json | cargoCapacity | Reviewer thinks PDF may show 3, JSON has 6 (needs visual verification) | wrong-data |
| 3 | Mirrorball | chassis.json | cargoCapacity | Reviewer thinks PDF may show 3, JSON has 6 (needs visual verification) | wrong-data |
| 4 | Consul | chassis.json | cargoCapacity | Reviewer thinks PDF shows 5, JSON has 6 | wrong-data |
| 5 | Vorpal (Zap Pattern) | chassis.json | systems[].name | "Shield Dome" should be "Aeon Shield Dome" | wrong-data |
| 6 | Mantis | chassis.json | chassisAbilities | "Integrated Frog Prince" missing "Module" suffix | minor |
| 7 | Solo (Sakura Pattern) | chassis.json | content | Adds surname "Kureigh", changes "triggering" to "in" vs PDF | wrong-data |

### Batch WM-4
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Eggs Mayhem action | actions.json | stat fields | Missing activationCost, actionType, range, and Hacking trait | missing |
| 2 | Needle Missile Pod action | actions.json | traits | Missing Uses(30) trait | missing |
| 3 | Missile Pod action | actions.json | traits | Missing Uses(6) trait | missing |
| 4 | Refractive Shield Projector action | actions.json | activationCost | Missing; should be 2 | missing |
| 5 | Electro-Magnetic Shield Projector action | actions.json | activationCost | Missing; should be 2 | missing |
| 6 | Shield Dome action | actions.json | activationCost | Missing; should be X | missing |
| 7 | Laser Anti-Missile System action | actions.json | activationCost | Missing; should be 1 | missing |
| 8 | Multi-Targeter action | actions.json | activationCost | Missing; should be X | missing |
| 9 | Metal Detector (second action) | actions.json | name | Named "Coolant Flush" instead of "Active Scan" | wrong-data |
| 10 | Evasion Protocols action | actions.json | traits | Missing Hot(2) trait | missing |
| 11 | Offensive Protocols action | actions.json | traits | Missing Hot(2) trait | missing |
| 12 | Weapon Link action | actions.json | traits | Missing Hot(X) trait | missing |
| 13 | Adv. Weapon Link action | actions.json | traits | Missing Hot(X) trait | missing |

### Batch WM-5
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Augmented Crawler | crawlers.json | npc.hitPoints | NPC HP is 0 (possibly intentional for A.I.) | wrong-data |
| 2 | Storage Bay | crawler-bays.json | page | Page should be 222, JSON has 221 (off by one) | wrong-data |
| 3 | Trading Bay | crawler-bays.json | npc.content | Bay description placed in NPC content field instead of NPC-specific text | wrong-data |
| 4 | Medium distance | distances.json | content | Missing period at end of paragraph 1; leading space in paragraph 2 | typo |
| 5 | Mech Appearance | roll-tables.json | page | Page should be 208, JSON has 94 (also flagged by auditor) | wrong-data |

### Batch WM-6
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Power Loader | vehicles.json | systems | Missing "x 2" quantity for Rigging Arm | missing |
| 2 | Rotorcraft | vehicles.json | systems | "Rotary Minigun" vs PDF "Rotary Mini Gun" | minor |

### Batch WM-7
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Elite Blade Squad | squads.json | asset_url | Filename says "elite beam squad.jpg" instead of "elite blade squad" | wrong-data |
| 2 | Group Initiative (6-10 result) | roll-tables.json | table value | JSON says "chosen by the **players**" but PDF says "chosen by the **Mediator**" | wrong-data |
| 3 | Pilot Appearance | roll-tables.json | page | Page should be 91, JSON has 332 | wrong-data |
| 4 | Knife Missile (roll table) | roll-tables.json | page | Page should be 73, JSON has 331 | wrong-data |
| 5 | Critical Injury (roll table) | roll-tables.json | page | Page should be 338, JSON has 323 | wrong-data |
| 6 | Group Initiative (roll table) | roll-tables.json | page | Page should be 337, JSON has 330 | wrong-data |
| 7 | vulnerable (keyword/trait) | keywords.json | page | Page should be 321, JSON has 326 | wrong-data |

### Batch FF
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Kelpie | chassis.json | systemSlots | PDF shows 6, JSON has 8 | wrong-data |
| 2 | Pioneer (Deerstalker Pattern) | chassis.json | systems/modules | Tracking Node should be in modules, not systems | wrong-data |
| 3 | Heating Unit (module) | modules.json | page | Page should be 69, JSON has 59 | wrong-data |
| 4 | Pop Goes The Weasel (module) | modules.json | page | Page should be 69, JSON has 59 | wrong-data |
| 5 | Meld Module Replicator (module) | modules.json | page | Page should be 69, JSON has 59 | wrong-data |
| 6 | Big Brother (DronTek Pattern) | chassis.json | drone config | Only Drone 1 (Shield) included; Drones 2-4 missing | missing |
| 7 | Anomalous Zone entry 7 (ZAPPER) | roll-tables.json | content | Missing "within Medium Range" qualifier | missing |

### Batch RM
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | Ravager/Agares pattern | chassis.json | systems[].name | PDF "Missile Pods" (plural) vs JSON "Missile Pod" (singular) | minor |
| 2 | Stolas Pattern B | chassis.json | modules[].name | PDF "Weapon Link Module (.50 Cal Machine Gun x 5)" vs JSON "Weapon Link" | minor |
| 3 | Fell Stalkers action name | actions.json | name | PDF "Thermal Optics" vs JSON "Thermal Goggles" | wrong-data |
| 4 | Spiked Carapace (Typhon) | actions.json | content | "unborrows" typo, should be "unburrows" | typo |

### Batch WWHF
| # | Entity | File | Field | Issue | Severity |
|---|--------|------|-------|-------|----------|
| 1 | SAKURA 78TH LANCE MSD | factions | content | Opening description text doesn't match PDF | wrong-data |
| 2 | Trash Locusts | factions | formation | Missing Rotorcraft from formation | missing |
| 3 | Wagon Wasters | factions | formation | Missing Waster Mob x 2 from formation | missing |
| 4 | Chimerium Cult | factions | formation | Missing Waster Mob x 2 from formation | missing |
| 5 | Red Mesa Mutants | factions | formation | Missing Chimerium Mutant Mob from formation | missing |
| 6 | Bio-Talon action | actions.json | traits | Missing "Rigging" trait | missing |
| 7 | Adrenal Glands | modules.json | content | Missing "May only be Mounted on a Bio-Mech Chassis" restriction | missing |
| 8 | Regeneration Glands | modules.json | content | Missing Bio-Mech mount restriction | missing |
| 9 | Salvage Cache Table entry 5 | roll-tables.json | table value | "An Acid Spitter" should be "An Acid Spitter Mule" | wrong-data |

## Inline page citations remaining (guides.json)

Deferred from the 2026-06 citation purge (audit Task 6) — long-form guide prose
needs editorial rewrites rather than mechanical deletion:

- line 119: `"Make a copy of the Character Sheet on p. 24; your Pilot starts with 10 Hit Points, 5 Ability Points, and 6 Inventory Slots."`
- line 123: `"Full details on Pilot Stats can be found on p. 20."`
- line 154: `"Pilot Classes can be found from p. 26 to p. 77."`
- line 226: `"Pilot Equipment can be found from p. 78 to p. 87."`
- line 322: `"Full details on The Union Crawler can be found on p. 212."`
- line 345: `"Mech Chassis can be found from p. 100 to p. 159."`
- line 366: `"Details on these can be found on p. 96."`
- line 415: `"The System list can be found on p. 162."`
- line 456: `"The Modules list can be found on p. 188."`
- line 530: `"Crawler types can be found from p. 216 to p. 217."`
- line 551: `"Details on Crawler Stats can be found on p. 218."`
- line 585: `"The System list can be found on p. 162."`
- line 601: `"The Crawler Bay list can be found on p. 221."`
- line 772: `"Full details on the Crawler Pilot Bay can be found on p. 223."`
- line 939: `"...You must roll on the Reactor Overload Table p. 235 to see what happens to your Mech..."`
- line 1071: `"...All Mechs and Pilots can use the Patch Up Ability to restore Mech SP (see p. 249)...the Welding Laser System (see p. 172) or the Engineer's Mass Field Repair Ability (see p. 29)."`
- line 1090: `"...Damaged Mech Chassis...can also be repaired using the Repair Ability...which all Pilots and Mechs have access to (see p. 248)."`
- line 1094: `"...the Welding Laser System (see p. 170) or the Engineer's Mass Field Repair Ability (see p. 29)."`
- line 1239: `"The Patch Up and Repair Ability (see p. 249)..."`
- line 1301: `"The Area Salvage Ability on p. 248 allows a Pilot to Area Salvage."`
- line 1312: `"The Mech Salvage Ability (see p. 248) is intended to emulate..."`
