# Review Report: WM-2 (Workshop Manual pages 51-100)

## Summary
- Pages reviewed: 51-100
- Entities checked: ~120 (39 abilities, 6 classes, 12 ability-tree-requirements, 36 equipment, 2 systems, 2 modules, 11 traits, 13 keywords, 12 roll tables, 1 guide, 1 chassis)
- Discrepancies found: 5

## Discrepancies

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Recruit (ability) | abilities.json | page | 76 | 219 | wrong-data |
| 2 | Ascension (ability) | abilities.json | page | 61 | 153 | wrong-data |
| 3 | Knife Missle (equipment) | equipment.json | name | "Knife Missile" (PDF p.73) | "Knife Missle" | typo |
| 4 | Custom Missle Launcher (equipment) | equipment.json | name | "Custom Missile Launcher" (PDF p.55) | "Custom Missle Launcher" | typo |
| 5 | Critical Strike (action) | actions.json | content | Missing "In addition, increase your Pilot's HP Max by 2." paragraph | Only has 2 paragraphs, missing the HP Max line | missing |

## Notes on Discrepancies

### #1 - Recruit ability page
The Recruit ability is described in full on PDF page 76 under the Union Rep Tree. The tree diagram on p.75 also references "p. 76". The JSON has `page: 219`, which does not match the PDF content page where Recruit is detailed.

### #2 - Ascension ability page
The Ascension ability appears on PDF page 61 under the Legendary Cyborg Tree. The tree diagram on p.59 references "p. 61". The JSON has `page: 153`, which does not match.

### #3, #4 - "Missle" misspellings
Both "Knife Missle" and "Custom Missle Launcher" in equipment.json use the misspelling "Missle" instead of "Missile" as shown in the PDF. Note: these were also flagged in the WM-1 review.

### #5 - Critical Strike missing HP Max paragraph
The PDF on p.56 has three parts to the Critical Strike ability text:
1. "You can identify points on an enemy that strike for the utmost amount of carnage."
2. "When rolling attacks as a Pilot or in your Mech, you score a 'Nailed it' result on a result of 19 - 20."
3. "In addition, increase your Pilot's HP Max by 2."

The JSON action for Critical Strike only contains paragraphs 1 and 2. The third paragraph about increasing Pilot HP Max by 2 is missing. Note: this same "In addition, increase your Pilot's HP Max by 2." line also appears in the Defy Death ability text on p.56 where it IS correctly included in the JSON. Both abilities have this line in the PDF, but only Defy Death has it in the JSON.

## Verified Correct

The following entities were checked and match the PDF:

### Classes (pages 52-74)
- **Soldier** (p.52): Description, coreTrees (Survivalist, Gladitorial Combat, Tactical Warfare), advancedTree (Advanced Soldier), legendaryTree (Legendary Soldier), page all correct
- **Cyborg** (p.58): Description, advancedTree, legendaryTree, page all correct
- **Fabricator** (p.62): Description, advancedTree (Fabricator), legendaryTree (Legendary Fabricator), page correct
- **Ranger** (p.66): Description, advancedTree, legendaryTree, page correct
- **Smuggler** (p.70): Description, advancedTree, legendaryTree, page correct
- **Union Rep** (p.74): Description, advancedTree, legendaryTree, page correct

### Ability Tree Requirements (pages 52-74)
- All 12 entries verified: Advanced Soldier (req: Tactical Warfare), Legendary Soldier, Cyborg (req: Augmentation + Gladitorial Combat), Legendary Cyborg, Fabricator (req: Forging + Electronics), Legendary Fabricator, Ranger (req: Survivalist + Sniper), Legendary Ranger, Smuggler (req: Sleuth + Salvaging), Legendary Smuggler, Union Rep (req: Leadership + Mechanical Knowledge), Legendary Union Rep - all requirements and pages match PDF

### Abilities - Soldier Trees (pages 54-56)
- **Charge** (Gladitorial Combat L1, p.54): 1AP, Free Action, Range Medium, action text matches
- **Overpower** (Gladitorial Combat L2, p.54): 2AP, Turn Action, Range Close, action text matches
- **Duel** (Gladitorial Combat L3, p.54): 3AP, Turn Action, Range Close, action text matches
- **Wastelander Rapport** (Survivalist L1, p.54): 1AP, Turn Action, action text matches
- **Resourceful** (Survivalist L2, p.54): 1AP, Short Action, action text matches
- **Custom Missile Launcher** (Survivalist L3, p.55): Pilot Equipment, action text and modifications match
- **Provoke** (Tactical Warfare L1, p.55): 1AP, Turn Action, Range Close, action text matches
- **Tactical Retreat** (Tactical Warfare L2, p.55): 2AP, Turn Action, action text matches
- **Counterattack** (Tactical Warfare L3, p.55): 3AP, Reaction, action text matches
- **Defy Death** (Advanced Soldier L2, p.56): 3AP, Reaction, action text matches including HP Max line
- **Whirlwind Strike** (Advanced Soldier L3, p.56): 3AP, Turn Action, action text and roll table match
- **Omega Strike** (Legendary Soldier, p.56): XAP, Turn Action, action text matches
- **Steel Pact** (Legendary Soldier, p.56): Passive, action text matches

### Abilities - Cyborg Trees (pages 60-61)
- **Glanded Stims** (Cyborg L1, p.60): 3AP, Free Action, action text and roll table correct
- **Modular Face Implant** (Cyborg L2, p.60): Passive, action text matches
- **Bionic Endoskeleton** (Cyborg L3, p.60): Passive, action text matches
- **Meld Form** (Legendary Cyborg, p.60): Passive, actions include Meld Tendril Attack - matches

### Abilities - Fabricator Trees (pages 64-65)
- **Field Fabrication** (Fabricator L1, p.64): action text matches (System and Module Fabrication + Chassis Fabrication sub-actions)
- **Miniaturised EMP** (Fabricator L2, p.64): 4AP, Turn Action, Range Close, Pilot Equipment, action text matches
- **Chassis Modder** (Fabricator L3, p.64): Downtime Action, action text matches
- **System Miniaturisation** (Legendary Fabricator, p.64): Downtime Action, action text matches
- **Droned Mech Conversion** (Legendary Fabricator, p.65): Downtime Action, action text matches

### Abilities - Ranger Trees (pages 68-69)
- **Mecha Companion** (Ranger L1, p.68): Pilot Equipment, stats table (SP:12, EP:5, HC:8, SS:12, MS:2, CC:3, TL:3, SV:2, bonus per TL: +4/+1/+2/+3/+1/+1/+1/-) all match PDF
- **Snipe** (Ranger L2, p.68): 3AP, Free Action, action text matches
- **Infiltration** (Ranger L3, p.68): 3AP, Long Action, action text matches
- **Mecha Packmaster** (Legendary Ranger, p.69): Pilot Equipment, action text matches
- **One with the Wastelands** (Legendary Ranger, p.69): Passive, action text matches

### Abilities - Smuggler Trees (pages 71-73)
- **Black Market** (Smuggler L1, p.71): Passive, action text matches, black market items listed correctly
- **Pray I don't alter the deal further...** (Smuggler L2, p.72): 2AP, Turn Action, action text matches
- **Hidden Stash** (Smuggler L3, p.73): 3AP, Reaction, action text matches
- **Knife Missile** (Legendary Smuggler, p.73): 3AP, Turn Action, Range Far, Pilot Equipment - action text matches (note: equipment entry name misspelled as "Knife Missle")
- **Stealth Field Generator** (Legendary Smuggler, p.73): 4AP, Turn Action, Range Close, Pilot Equipment - action text matches

### Abilities - Union Rep Trees (pages 75-77)
- **Union Representative** (Union Rep L1, p.76): Passive, action text matches
- **Union Call** (Union Rep L2, p.75/76): Downtime Action, action text and roll table match
- **VIP Beacon** (Legendary Union Rep, p.77): Turn Action, Uses 1, action text and options match PDF
- **Inspirational Union Leader** (Legendary Union Rep, p.77): Turn Action, Uses 1, action text matches

### Abilities from previous pages appearing here (page 51)
- **Wingsuit** (Advanced Scout L3, p.51): action text matches
- **Wasteland Celebrity** (Legendary Scout, p.51): action text matches
- **Teleport Beacon** (Legendary Scout, p.51): action text matches

### Black Market Systems (page 72)
- **Napalm Launcher**: TL=3, slots=6, SV=3, Range Medium, Damage 4 SP, Anti-Organic/Burn(2)/Explosive(2)/Overheat - all match PDF
- **Rad Wave Generator**: TL=3, slots=5, SV=4, Range Medium, Overheat - all match PDF

### Black Market Modules (pages 71-72)
- **Goflow Plant Growing System**: TL=4, slots=1, SV=2 - matches PDF (T4 | delta1 | sv2)
- **Corrupted Neuralink Module**: TL=5, slots=1, SV=2 - matches PDF (T5 | delta1 | sv2)

### Equipment - Pilot Equipment (pages 80-87)
All 36 equipment items verified for name, tech level, and action text content:
- Tech 1: First Aid Kit, Handheld Riveting Gun, Heavy Duty Torch, High Tensile Wire, Improvised Explosive Device, Improvised Firearm
- Tech 2: Flare Gun, Holofoil Tent, Disposable Camera, Reinforced Polycarbonate Shield, Portable Arc Welder, Red Laser Pistol, Rigging Jack
- Tech 3: Grenade, Hazard Protection Suit, Healing Bio-Foam, Handheld Epoxy Canister, Hover Sled, Melee Armament, Portable Flamethrower, Shotgun, Tranquiliser Rifle
- Tech 4: Adv. Epoxy Applicator, Night Vision Goggles, Portable Multi-Phase Shield, Remote Mine, Rocket Launcher, Sniper Rifle (listed on tech chart but separate from Custom Sniper Rifle)
- Tech 5: Beta Fission Gun, Polycarbonate Carapace Armour, Miniaturised Repair Arm, Monomolecular Sword (listed on tech chart)
- Tech 6: Anti-Gravity Belt, Executive Corpo Suit, Nanite Repair Injector, Orbital Lance Controller

### Traits (pages 55-87)
All 11 traits verified: missile (p.55), melee (p.59), wield (p.65), explosive (p.78), heavy (p.78), armour (p.79), silent (p.81), ballistic (p.84), climbing (p.84), shield (p.85), energy (p.87)

### Keywords (pages 51-98)
All 13 keywords verified: reaction (p.51), meld (p.61), ranged weapon (p.67), difficult terrain (p.69), blind (p.72), lance (p.79), creature (p.80), environmental effects (p.81), energy points (p.95), module slots (p.95), system slots (p.95), salvage value (p.98), tech level (p.98)

### Roll Tables (pages 56-94)
- Whirlwind Strike (p.56), Glanded Stims (p.60), Callsign Table (p.88), Background (p.89), Mech Appearance (p.94) - all verified
- Union Call (p.75), Portable Multi-Phase Shield (p.85) - verified
- Black Market roll tables (Probing Proboscis p.70, Nanite Reconstruction p.70, Meld Distorter p.70, Blinding Blue Laser Rifle p.71, Bio-Talon p.74) - verified

### Guide (page 94)
- **Create a Mech** (p.94): 8 steps - matches PDF Mech Workshop guide

### Chassis (page 100)
- **Mule** (p.100): SP=12, EP=4, HC=6, SS=16, MS=2, CC=16, TL=1, SV=7, Chassis Ability "Integrated Cargo Bay" (+10 CC to 16) - all match PDF
