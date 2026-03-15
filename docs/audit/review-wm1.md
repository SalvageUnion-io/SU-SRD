# Review Report: WM-1 (Workshop Manual pages 2-50)

## Summary
- Pages reviewed: 2-50
- Entities checked: 68
- Discrepancies found: 12

## Discrepancies

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Salvager (class) | classes.json | page | 44 (Salvager class intro page in PDF) | 9 | wrong-data |
| 2 | Salvager (class) | classes.json | coreTrees | Contains "Gladitorial Combat" | "Gladitorial Combat" (misspelling of "Gladiatorial") | typo |
| 3 | Soldier (class) | classes.json | coreTrees | Contains "Gladitorial Combat" | "Gladitorial Combat" (same misspelling) | typo |
| 4 | Soldier (class) | classes.json | page | 52 | 52 (Soldier intro is on p.52, outside this batch's scope but listed here as page is correct) | - |
| 5 | Can't Stop, Won't Stop (ability) | abilities.json | page | 42 (appears on p.42 in PDF) | 328 | wrong-data |
| 6 | Camo Suit (ability) | abilities.json | page | 51 (appears on p.51 in PDF under Advanced Scout Tree) | 328 | wrong-data |
| 7 | Squeeze it in (ability) | abilities.json | description | "Temporarily" | "Temporariliy" | typo |
| 8 | Gather Intelligence (ability) | abilities.json | description | "receive truthful answers" | "recieve truthful answers" | typo |
| 9 | Spotter (ability) | abilities.json | description | "Choose a target in range" | "Chooose a target in range" | typo |
| 10 | Mech Salvage (roll table) | roll-tables.json | page | 248 (Mech Salvage appears on p.248 per TOC and Area Salvage section) | 2 | wrong-data |
| 11 | Knife Missle (equipment) | equipment.json | name | "Knife Missile" (PDF p.73 area) | "Knife Missle" | typo |
| 12 | Custom Missle Launcher (equipment) | equipment.json | name | "Custom Missile Launcher" (PDF p.55 area) | "Custom Missle Launcher" | typo |

## Notes on Discrepancies

### #1 - Salvager class page
The Salvager class intro page in the PDF is page 44 (large "SALVAGER" header). The JSON has `page: 9`, which is the Introduction page. The Salvager is mentioned on p.9 in passing ("of course, salvagers") but the class entry itself starts at p.44.

### #5 - Can't Stop, Won't Stop page
This ability appears on PDF page 42 under the Advanced Hauler Tree. The JSON has page 328, which is incorrect.

### #6 - Camo Suit ability page
This ability appears on PDF page 51 under the Advanced Scout Tree. The JSON has page 328, which is incorrect.

### #10 - Mech Salvage roll table page
The Mech Salvage table is part of the Salvaging Abilities section which is on p.248 per the table of contents. The JSON has page 2, which is clearly wrong.

### #7, #8, #9 - Spelling typos in descriptions
- "Temporariliy" should be "Temporarily" (Squeeze it in)
- "recieve" should be "receive" (Gather Intelligence)
- "Chooose" should be "Choose" (Spotter)

### #2, #3 - "Gladitorial" vs "Gladiatorial"
The PDF itself uses "Gladitorial Combat" on p.22 class wheel and p.45 Salvager abilities list, so this may be intentional/matching the source. However, the standard English spelling would be "Gladiatorial". Flagging as the PDF itself may contain this spelling consistently, meaning the JSON matches the source even if both are misspelled.

### #11, #12 - "Missle" vs "Missile"
The equipment entries "Knife Missle" and "Custom Missle Launcher" misspell "Missile". The PDF uses "Missile" correctly. Note these are `indexable: false` equipment entries granted by abilities.

## Entities Verified Clean

### Classes (pages 2-50)
- Engineer (page 26) - content matches PDF
- Hacker (page 32) - content matches PDF
- Hauler (page 38) - content matches PDF
- Scout (page 46) - content matches PDF

### Abilities - Engineer Trees (pages 26-31)
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
- This one goes to 11... (page 30)
- Mass Energy Recharge (page 31)
- Tip Top Shape (page 31)
- The Full Works (page 31)

### Abilities - Hacker Trees (pages 32-37)
- Hacking Kit (page 34)
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

### Abilities - Hauler Trees (pages 38-43)
- Squeeze it in (page 40) - description typo noted above
- Expert Salvager (page 40)
- Emergency Salvage Drop (page 40)
- Read a Person (page 40)
- Let's Make a Deal (page 40)
- No Job Too Big (page 41)
- Folk Song (page 41)
- Behemoth (page 41)
- Valiant Speech (page 42)
- Beefcake (page 42)
- Mechapult Master (page 42)
- Master Salvager (page 43)
- Hauling All Day (page 43)

### Abilities - Scout Trees (pages 46-51)
- Gather Intelligence (page 48) - description typo noted above
- Tail (page 48)
- Survey Drone (page 48)
- Silver Tongue (page 48)
- Forked Tongue (page 49)
- Persona (page 49)
- You Shot First (page 50)
- Spotter (page 50) - description typo noted above
- Custom Sniper Rifle (page 50)
- Flashback (page 50)
- Wingsuit (page 51) - note: JSON ability page is 51, correct
- Wasteland Celebrity (page 51)
- Teleport Beacon (page 51)

### Ability Tree Requirements (pages 2-50)
- Advanced Engineer (page 26) - requirement: Mech-Tech - matches PDF p.27
- Legendary Engineer (page 26) - requirement: Advanced Engineer - correct
- Advanced Hacking (page 32) - requirement: Hacking - matches PDF p.33
- Legendary Hacker (page 32) - requirement: Advanced Hacking - correct
- Advanced Hauler (page 38) - requirement: Trading - matches PDF p.39
- Legendary Hauler (page 38) - requirement: Advanced Hauler - correct
- Advanced Scout (page 46) - requirement: Recon - matches PDF p.47
- Legendary Scout (page 46) - requirement: Advanced Scout - correct

### Equipment (pages 2-50, ability-granted only)
- Auto-Turret (page 30) - stats verified: SP 9, EP 2, HC 4, Sys 9, Mod 1, Cargo 0 - note: PDF shows "Cargo Cap: -" which matches 0
- Survey Drone (page 48) - stats verified: SP 2, EP 4, HC 2, Sys 3, Mod 1, Cargo 1, SV 2 - matches PDF
- Custom Sniper Rifle equipment entry (page 85) - outside page range but checked: matches
- Holo Companion equipment entry (page 35) - content matches PDF

### Roll Tables (pages 2-50)
- Core Mechanic (page 2) - referenced on cheat sheet pages, content matches

### Guides (pages 2-50)
- Safety Protocols (page 12) - content matches PDF
- Create a Pilot (page 18) - steps and content match PDF

### Keywords (pages 2-50)
- Spot-checked keywords with pages in range 2-50: mech (p.2 area - not directly verifiable as keyword definition page), action scene (p.7 area), corpo (p.9), pilot (p.3) - general alignment confirmed
