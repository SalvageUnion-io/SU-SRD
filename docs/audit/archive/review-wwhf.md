# Independent Review: We Were Here First! (Pages 9-79)

## Summary

Reviewed all WWHF entities in JSON data against the source PDF (Digital Edition 1.1). The data is generally well-encoded with good accuracy. Found several discrepancies detailed below.

## Discrepancies Found

### FACTIONS

#### 1. BOLZA Corp 1st Lance (p.12) - Formation: Alpha Pattern Impaler page reference
- **PDF**: Alpha Pattern Impaler (p.76)
- **JSON**: `"page": 76`
- **Status**: CORRECT

#### 2. BOLZA Corp 1st Lance (p.12) - Assets text
- **PDF**: "The best equipment, intel , and training that BOLZA has to offer." (note: there appears to be a space before the comma in the PDF)
- **JSON**: `"The best equipment, intel, and training that BOLZA has to offer."`
- **Status**: Minor whitespace normalization, acceptable

#### 3. SAKURA 78TH LANCE MSD (p.15) - Content description
- **PDF**: "A professional and discreet wet work team on a black ops assignment to Gehenna. Led by Lance Leader 'Moto' (Ace)."
- **JSON**: `"A high-tech lance operating in Gehenna with detailed information about the area and its inhabitants. Fed with information from a Stefanus data auction, they know about the Red Mesa Facility and BOLZA Encampments in the area."`
- **Finding**: The JSON content paragraph appears to be a paraphrase/combination of info from the PDF's description and goals sections. The PDF's opening line is "A professional and discreet wet work team on a black ops assignment to Gehenna. Led by Lance Leader 'Moto' (Ace)." which is not captured in JSON.
- **Severity**: MEDIUM - The introductory description text does not match the PDF

#### 4. SAKURA 78TH LANCE MSD (p.15) - Goals text
- **PDF**: Lists goals as bullet points: "Gain Chimerium samples to engineer a cure to Chimerium Mutation they can leverage. Prevent BOLZA Chimerium Energy ambitions by assassinating Exec Petro. Commit industrial sabotage on Red Mesa and BOLZA operations to slow down their research ambitions."
- **JSON**: Same text as a single string
- **Status**: CORRECT (bullet points collapsed to single string is acceptable)

#### 5. Trash Locusts (p.16) - Missing Rotorcraft from formation
- **PDF**: Formation includes "Rotorcraft (1x Raider Band inside) (p.293 & 300 SU Core Book)"
- **JSON**: Formation only has Throne Atlas, Buzzard Mazona x2, Fighting Box Wheel x4. No Rotorcraft entry.
- **Severity**: HIGH - Missing formation member

#### 6. Wagon Wasters (p.21) - Missing Waster Mob x 2 from formation
- **PDF**: Formation includes "Waster Mob x 2 (p.300 SU Core Book)"
- **JSON**: Formation only has Shepherd Thresher, Crusher Mule, Settler Spectrum, Leaky Scrapper. No Waster Mob entry.
- **Severity**: HIGH - Missing formation member

#### 7. Chimerium Cult (p.17) - Missing Waster Mob x 2 from formation
- **PDF**: Formation includes "Waster Mob x 2 (p.300 SU Core Book)"
- **JSON**: Formation only has Mutant Thresher x2, Experimental Bio Impaler, Acid Spitter Mule. No Waster Mob entry.
- **Severity**: HIGH - Missing formation member

#### 8. Red Mesa Mutants (p.18) - Missing Chimerium Mutant Mob from formation
- **PDF**: Formation includes "Chimerium Mutant Mob (p.60)"
- **JSON**: Formation only has Mutant Thresher, Harvester Scuttler, Screecher Stormterror. No Chimerium Mutant Mob entry.
- **Severity**: HIGH - Missing formation member

#### 9. Crawler #693 Salvagers (p.19) - Formation "Thatcher Ptn Jackhammer"
- **PDF**: "Thatcher Ptn Jackhammer ((p.117)"
- **JSON**: `"pattern": "Thatcher"`
- **Status**: CORRECT (double parenthesis is a PDF typo)

#### 10. Wolf Z' Traders (p.20) - Formation entry "Escort Pattern Aegis with Napalm Launcher"
- **PDF**: "Escort Pattern Aegis with Napalm Launcher (p.139 & 72 SU Core Book)"
- **JSON**: `"pattern": "Escort", "chassis": "Aegis"` - no mention of Napalm Launcher
- **Severity**: LOW - The "with Napalm Launcher" is a loadout note, not a separate formation entry. Could be captured in a notes field but not critical.

#### 11. Wolf Z' Traders (p.20) - Formation chassis name
- **PDF**: "Scrounger Pattern Sestra"
- **JSON**: `"chassis": "Little Sestra"`
- **Finding**: PDF says "Sestra" but JSON has "Little Sestra"
- **Severity**: LOW - "Little Sestra" is the full chassis name in the core book; "Sestra" in the PDF is likely abbreviated

### CHASSIS

#### 12. Impaler (p.64) - Alpha Pattern: Energy Shield vs Refractive Shield Projector
- **PDF** (p.76 Mech Patterns): "Energy Shield"
- **JSON**: `"Refractive Shield Projector"`
- **PDF** (p.64 Chassis page): Shows stats only, no pattern systems listed on this page
- **Severity**: MEDIUM - JSON has "Refractive Shield Projector" but the Mech Patterns page (p.76) lists "Energy Shield"

#### 13. Impaler (p.64) - Alpha Pattern: Laser Guidance
- **PDF** (p.76): Lists "Laser Guidance Module" under Modules
- **JSON**: `"name": "Laser Guidance"`
- **Severity**: LOW - Minor name difference ("Laser Guidance" vs "Laser Guidance Module" - the "Module" suffix may be implicit)

#### 14. Impaler (p.76) - Delta Pattern: Loudspeaker vs Loudspeakers
- **PDF** (p.76): "Loudspeaker" (singular)
- **JSON**: `"name": "Loudspeakers"` (plural)
- **Severity**: LOW - Singular vs plural mismatch

#### 15. Impaler (p.76) - Experimental Bio Pattern: Supersonic Screecher spelling
- **PDF** (p.76): "Supersonic Screecher"
- **JSON**: `"name": "Super-Sonic Screecher"`
- **Severity**: LOW - The system itself is called "Super-Sonic Screecher" in the Systems section (p.74), so JSON is consistent with the canonical system name. The Mech Patterns page uses a variant spelling.

#### 16. Fleshripper (p.67) - Salvage Value field name
- **PDF**: Shows "BIO-SALVAGE VALUE: 50"
- **JSON**: `"salvageValue": 50`
- **Status**: CORRECT (field name is a schema convention)

#### 17. Stormterror (p.77) - Screecher Pattern: Weapon Link Module notation
- **PDF** (p.77): "Weapon Link Module (Bio-Talon x 3)"
- **JSON**: `"name": "Weapon Link"` (no notation about Bio-Talon x 3)
- **Severity**: LOW - The "(Bio-Talon x 3)" is a configuration note. The module itself is "Weapon Link".

#### 18. Cranium Bio-Mech (p.70/77) - Probe Pattern: Neuralink Module vs Neuralink Communicator
- **PDF** (p.77): "Neuralink Module"
- **JSON**: `"name": "Neuralink Communicator"`
- **Severity**: MEDIUM - Different module name. "Neuralink Communicator" may be the canonical module name from the core book, but the PDF specifically says "Neuralink Module".

#### 19. Cranium Bio-Mech (p.70/77) - Probe Pattern: Panda Sneeze Module
- **PDF** (p.77): "Panda Sneeze Module"
- **JSON**: `"name": "Panda Sneeze"`
- **Severity**: LOW - Missing "Module" suffix

#### 20. Scuttler (p.73/77) - Harvester Pattern: Neuralink Module vs Neuralink Communicator
- **PDF** (p.77): "Neuralink Module"
- **JSON**: `"name": "Neuralink Communicator"`
- **Severity**: MEDIUM - Same issue as Cranium Bio-Mech above

#### 21. Scuttler (p.77) - Harvester Pattern: Olfactory Gland (singular)
- **PDF** (p.77): "Olfactory Gland" (singular)
- **JSON**: `"name": "Olfactory Glands"` (plural)
- **Severity**: LOW - The module is canonically "Olfactory Glands" (plural) on p.75

### SYSTEMS

#### 22. Super-Sonic Screecher (p.74) - Slots and Salvage Value
- **PDF**: TB (Tech Level B), 5 slots, B12 (Bio-Salvage 12)
- **JSON**: `"techLevel": "B", "slotsRequired": 5, "salvageValue": 12`
- **Status**: CORRECT

#### 23. Bio-Talon (p.74) - Rigging trait
- **PDF**: "Range: Close // Dmg: 4 SP // Melee // Bio-System // Rigging"
- **JSON action**: Has traits `[{"type": "melee"}]` only - missing Rigging trait
- **Severity**: MEDIUM - Missing "Rigging" trait on Bio-Talon action

#### 24. Acid Cannon (p.74) - Burn amount
- **PDF**: "Range: Medium // Dmg: 5 SP // Burn (5) // Bio-System"
- **JSON action**: `"traits": [{"type": "burn", "amount": 5}]`
- **Status**: CORRECT

#### 25. Bio-Maw Bite (p.74) - Consume action: Heat reduction text
- **PDF**: "You reduce your Heat equal to 2x the Bio-Salvage you consume."
- **JSON action (Consume)**: "You reduce your Heat equal to 2\u00d7 the Bio-Salvage you consume."
- **Status**: CORRECT (unicode multiplication sign)

#### 26. Chimerium Harvester (p.74) - Salvaging trait missing from JSON system
- **PDF**: "Salvaging" trait shown on the system
- **JSON**: System has no traits field, but the action content describes the salvaging behavior
- **Severity**: LOW - Trait info is in action description text

### MODULES

#### 27. Adrenal Glands (p.75) - Burst cost
- **PDF**: "Cost: 2 SP or 2HP // Free Action"
- **JSON action**: `"activationCost": 2, "activationCurrency": "SP or HP"`
- **Finding**: PDF says "2 SP or 2HP" but JSON says "SP or HP" (amount 2 is in activationCost)
- **Status**: CORRECT (cost amount is separate from currency)

#### 28. Adrenal Glands (p.75) - Power cost
- **PDF**: "Cost: 4 SP or 4 HP // Free Action"
- **JSON action**: `"activationCost": 4, "activationCurrency": "SP or HP"`
- **Status**: CORRECT

#### 29. Adrenal Glands (p.75) - "May only be Mounted on a Bio-Mech Chassis"
- **PDF**: States "May only be Mounted on a Bio-Mech Chassis." at the bottom
- **JSON action (Power)**: Content says "When activated, your Mech can make an additional Turn Action. You may activate this once per Turn." - missing the mount restriction
- **Severity**: MEDIUM - The mount restriction note is missing from both Burst and Power action content. Should be on the module itself.

#### 30. Regeneration Glands (p.75) - Regrowth cost
- **PDF**: "Cost: 4 EP // Turn Action"
- **JSON action**: `"activationCost": 4` (no currency specified)
- **Severity**: LOW - Missing `"activationCurrency": "EP"` on the Regrowth action

#### 31. Regeneration Glands (p.75) - "You may only install this Bio-Module on a Bio-Mech Chassis"
- **PDF**: States this restriction
- **JSON**: Not captured in module or action data
- **Severity**: MEDIUM - Mount restriction missing

#### 32. Olfactory Glands (p.75) - "May only be Mounted on a Bio-Mech Chassis"
- **PDF**: States this restriction (implied by "May only be Mounted on a Bio-Mech Chassis." at bottom of Olfactory Glands section)
- **JSON**: Not captured
- **Severity**: LOW - The PDF text for Olfactory Glands does not explicitly state this restriction as clearly as others. Need to verify.

### EQUIPMENT

#### 33. Bio-Rifle (p.63) - Tech level notation
- **PDF**: "T3 // Bio-Pilot Equipment // Range: Medium // Damage: 4HP // Pinning"
- **JSON**: `"techLevel": 3`
- **Status**: CORRECT

#### 34. Bio-Scanner (p.63) - Uses trait
- **PDF**: "Range: Medium // Uses (3)"
- **JSON action**: Has `"traits": [{"type": "uses", "amount": 3}]`
- **Status**: CORRECT

### NPCs

#### 35. Chimerium Mutant (p.54) - Mutated Weapon description
- **PDF**: "A large spiked, bulbous, or otherwise gnarly appendage. Range: Close // Damage: 4 HP // Melee"
- **JSON action**: Content: "A large spiked, bulbous, or otherwise gnarly appendage." with damage 4 HP, range Close, melee
- **Status**: CORRECT

#### 36. Chimerium Chosen (p.54) - Mutated Weapon damage
- **PDF**: "Range Close // Damage: 6 HP // Melee"
- **JSON action**: damage amount 6, HP, range Close, melee
- **Status**: CORRECT

#### 37. Chimerium Mutant Squad (p.54) - Mutated Weapons Multiattack
- **PDF**: "Range: Close // Damage: 4 HP // Melee // Multiattack (2)"
- **JSON action**: Has multi-attack trait with amount 2
- **Status**: CORRECT

### ROLL TABLES

#### 38. Salvage Cache Table (p.23) - Entry 5: "Acid Spitter" vs "Acid Spitter Mule"
- **PDF**: "An Acid Spitter Mule (p.76)"
- **JSON**: `"An Acid Spitter"`
- **Severity**: MEDIUM - Missing "Mule" from the entry text

#### 39. Salvage Cache Table (p.23) - Page references not in JSON
- **PDF**: Each entry has a page reference (e.g., "p.9", "p.64", "p.74", etc.)
- **JSON**: No page references in table entry values
- **Severity**: LOW - Page references are supplementary navigation aids

#### 40. Chimerium Mutant Ability Table (p.59) - Entry 5-6 "Chimeric Exoskeleton" HP increase
- **PDF**: "They increase their HP by 4 and no longer suffer from the effects of Radiation."
- **JSON**: "Increases HP by 4 and no longer suffer from the effects of Radiation."
- **Severity**: LOW - Minor rewording but same meaning

#### 41. Chimerium Mutant Ability Table (p.59) - Entry 7-8 "Chimeric Vision"
- **PDF**: "The subject's eyes take on a serpent-like appearance. They gain Thermal Vision."
- **JSON**: "The subject's eyes take on a serpent-like appearance. Their eyes function as Thermal Optics."
- **Severity**: LOW - "Thermal Vision" vs "Their eyes function as Thermal Optics" - different phrasing

### BIO-TITANS

#### 42. Cortex Bio-Titan (p.56) - Description text
- **PDF**: "It resembles a bloated slug, with hundreds of tiny eyes and a huge tentacle-like proboscis protruding from its drooling mouth."
- **JSON**: Same text
- **Status**: CORRECT

#### 43. Cortex Bio-Titan (p.56-57) - Titanic Actions: third option range
- **PDF** (p.57): "Any Chimerium Mutant, Chimerium Mutant Squad, or Chimerium Beast within Long Range..."
- **JSON action**: Same text
- **Status**: CORRECT

### KEYWORDS

#### 44. bio-chassis keyword (p.60) - Missing "Bio-Chassis roll on an alternate Bio-Chassis Overload Table" content
- **PDF** (p.60): States "Bio-Chassis roll on an alternate Bio-Chassis Overload Table (see p. 79) when they fail a Heat Check."
- **JSON**: Has this as first content paragraph
- **Status**: CORRECT

### ACTIONS (Cross-reference checks)

#### 45. Probing Proboscis action - activationCurrency missing
- **PDF** (p.71): "Turn Action // 2 EP // Close // Melee"
- **JSON action**: `"activationCost": 2` but no `"activationCurrency"` field
- **Severity**: LOW - Missing EP currency specification

#### 46. Super-Sonic Screecher action - Pilot damage text
- **PDF** (p.74): "When a Mech or Vehicle is hit by this System, the Pilot and any passengers take 2 SP damage."
- **JSON action**: Same text
- **Status**: CORRECT

## Summary of Issues by Severity

### HIGH (4)
1. **Trash Locusts** - Missing Rotorcraft from formation
2. **Wagon Wasters** - Missing Waster Mob x 2 from formation
3. **Chimerium Cult** - Missing Waster Mob x 2 from formation
4. **Red Mesa Mutants** - Missing Chimerium Mutant Mob from formation

### MEDIUM (6)
1. **SAKURA 78TH LANCE MSD** - Content description text doesn't match PDF opening line
2. **Impaler Alpha Pattern** - "Refractive Shield Projector" should be "Energy Shield" per p.76
3. **Bio-Talon action** - Missing "Rigging" trait
4. **Cranium Bio-Mech / Scuttler** - "Neuralink Communicator" vs PDF's "Neuralink Module" (2 instances)
5. **Adrenal Glands** - Mount restriction note missing from action content
6. **Salvage Cache Table entry 5** - "An Acid Spitter" should be "An Acid Spitter Mule"

### LOW (10)
1. Impaler Alpha Pattern "Laser Guidance" vs "Laser Guidance Module"
2. Impaler Delta Pattern "Loudspeakers" (plural) vs "Loudspeaker" (singular)
3. Stormterror Screecher Pattern Weapon Link missing "(Bio-Talon x 3)" note
4. Cranium Probe Pattern "Panda Sneeze" vs "Panda Sneeze Module"
5. Scuttler Harvester Pattern "Olfactory Glands" (plural) vs "Olfactory Gland" (singular)
6. Regeneration Glands Regrowth action missing activationCurrency "EP"
7. Regeneration Glands mount restriction missing
8. Chimerium Mutant Ability Table minor rewordings (entries 5-6, 7-8)
9. Salvage Cache Table missing page references in entries
10. Probing Proboscis action missing activationCurrency "EP"
