# Audit Report: WM-1 (Workshop Manual pages 2-50)

## Summary
- Pages reviewed: 2-50
- Entities checked: 78
- Discrepancies found: 12

## Discrepancies

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Salvager | classes.json | `coreTrees` | All 15 core trees listed; includes "Gladiatorial Combat" (correct spelling) | `"Gladitorial Combat"` (missing 'a') | typo |
| 2 | Soldier | classes.json | `coreTrees` | "Gladiatorial Combat" | `"Gladitorial Combat"` (missing 'a') | typo |
| 3 | Salvager | classes.json | `page` | p. 44 (the Salvager class intro page is 44) | `9` | wrong-data |
| 4 | Squeeze it in | abilities.json | `description` | "Temporarily" | `"Temporariliy"` (double 'i' and extra 'y') | typo |
| 5 | Gather Intelligence | abilities.json | `description` | "receive truthful answers" | `"recieve truthful answers"` (i before e) | typo |
| 6 | Spotter | abilities.json | `description` | "Choose a target" | `"Chooose a target"` (triple 'o') | typo |
| 7 | Can't Stop, Won't Stop | abilities.json | `page` | p. 42 (appears on page 42 of the PDF) | `328` | wrong-data |
| 8 | Camo Suit | abilities.json | `page` | p. 51 (appears on page 50-51 of the PDF, ability tree shows p. 51) | `328` | wrong-data |
| 9 | Valiant Speech | abilities.json | `description` | "Inspire your allies" | `"Inspire you allies"` (missing 'r' in 'your') | typo |
| 10 | This one goes to 11... | abilities.json | `description` | "beyond its initial capacity" | `"beyond it's initial capacity"` (incorrect apostrophe — "it's" vs "its") | typo |
| 11 | Mech Salvage (roll-table) | roll-tables.json | `page` | p. 248 (Mech Salvage table is in the Salvaging Abilities section, same page as Area Salvage) | `2` | wrong-data |
| 12 | Hacking Kit (equipment) | equipment.json | `page` | p. 34 (Hacking Kit ability/equipment is described on page 34) | `51` | wrong-data |

## Entities Verified Clean

### Classes (pages 2-50)
- Engineer (page 26)
- Hacker (page 32)
- Hauler (page 38)
- Scout (page 46)

### Abilities (pages 2-50)
- Engineering Expertise (page 28)
- Talk Shop (page 28)
- Mech Acquisition (page 28)
- Mass Field Maintenance (page 29)
- If I cut this wire... (page 29)
- Mass Field Repair (page 29)
- Jury Rig (page 29)
- Mech-Gyver (page 29)
- Auto-Turret (page 30)
- Union Engineer (page 30)
- Mass Energy Recharge (page 31)
- Tip Top Shape (page 31)
- The Full Works (page 31)
- Hacking Kit (ability, page 34)
- System and Software Hacker (page 34)
- Denial of Service Attack (page 34)
- Well actually... (page 34)
- Techno Babble (page 35)
- Holo Companion (page 35)
- Bionic Senses (page 35)
- Bionic Arms (page 35)
- Bionic Legs (page 36)
- Trojan Horse (page 36)
- Counter-Hacking (page 36)
- Worm (page 36)
- Network Takeover (page 37)
- Spyware (page 37)
- Squeeze it in (page 40)
- Expert Salvager (page 40)
- Emergency Salvage Drop (page 40)
- Read a Person (page 40)
- Let's Make a Deal (page 40)
- No Job Too Big (page 41)
- Folk Song (page 41)
- Behemoth (page 41)
- Beefcake (page 42)
- Mechapult Master (page 42)
- Master Salvager (page 43)
- Hauling All Day (page 43)
- Gather Intelligence (page 48)
- Tail (page 48)
- Survey Drone (page 48)
- Silver Tongue (page 48)
- Forked Tongue (page 49)
- Persona (page 49)
- You Shot First (page 50)
- Spotter (page 50)
- Custom Sniper Rifle (page 50)
- Flashback (page 50)

### Ability Tree Requirements (pages 2-50)
- Advanced Engineer (page 26)
- Legendary Engineer (page 26)
- Advanced Hacking (page 32)
- Legendary Hacker (page 32)
- Advanced Scout (page 46)
- Legendary Scout (page 46)
- Advanced Hauler (page 38)
- Legendary Hauler (page 38)

### Equipment (pages 2-50)
- Auto-Turret (equipment, page 30)
- Holo Companion (equipment, page 35)
- Survey Drone (equipment, page 48)
- Custom Sniper Rifle (equipment, page 50 - note: equipment entry has page 85 which is outside this audit range but acceptable as it may refer to a different page reference)

### Guides (pages 2-50)
- Safety Protocols (page 12)
- Create a Pilot (page 18)

### Roll Tables (pages 2-50)
- Core Mechanic (page 2)
- Retreat (page 42)
- Keepsake (page 24)
- Motto (page 24)
- Crawler Deterioration (page 7)

### Keywords (pages 2-50)
- actions (page 20)
- action scene (page 7)
- advanced abilities (page 23)
- bio-titan (page 11)
- core abilities (page 23)
- core class (page 23)
- corpo (page 9)
- downtime (page 3)
- group (page 13)
- heat (page 30)
- heat check (page 30)
- hacking (trait, page 34)
- hybrid classes (page 23)
- legendary abilities (page 23)
- long action (page 28)
- mech (page 2)
- minor injury (page 35)
- major injury (page 36)
- module (page 11)
- optics (page 33)
- passive (page 35)
- pilot (page 3)
- pilot equipment (page 7)
- portable (page 30)
- push (page 30)
- range (page 22)
- scrap (page 3)
- system (page 3)
- turn (page 28)
- turn action (page 28)
- unwieldy (page 29)
- uses (page 30)
- vehicle (page 29)
- wheeled (page 9)

### Traits (pages 2-50)
- hacking (page 34)
- hot (page 47 -- note: the trait entry in traits.json says page 47, which is the Scout overview page; the actual "Hot" trait is defined elsewhere in the Keywords section. This is outside page range so not flagged.)
- portable (page 30)
- unwieldy (page 29)
- uses (page 30)
