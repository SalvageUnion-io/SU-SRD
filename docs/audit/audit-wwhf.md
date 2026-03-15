# Audit Report: WWHF (We Were Here First! pages 9-79)

## Summary
- Pages reviewed: 9-79
- Entities checked: 48
- Discrepancies found: 7

## Discrepancies

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Impaler (Alpha Pattern) | chassis.json | `patterns[Alpha].systems[3].name` | "Energy Shield" (p. 76) | `"Refractive Shield Projector"` | wrong-data |
| 2 | Impaler (Alpha Pattern) | chassis.json | `patterns[Alpha].modules[2].name` | "Laser Guidance Module" (p. 76) | `"Laser Guidance"` | minor |
| 3 | Stormterror (Screecher Pattern) | chassis.json | `patterns[Screecher].modules[2].name` | "Weapon Link Module (Bio-Talon x 3)" (p. 77) | `"Weapon Link"` (no quantity note) | minor |
| 4 | Cranium Bio-Mech (Probe Pattern) | chassis.json | `patterns[Probe Pattern].modules[2].name` | "Neuralink Module" (p. 77) | `"Neuralink Communicator"` | wrong-data |
| 5 | Cranium Bio-Mech (Probe Pattern) | chassis.json | `patterns[Probe Pattern].modules[3].name` | "Panda Sneeze Module" (p. 77) | `"Panda Sneeze"` | minor |
| 6 | Scuttler (Harvester Pattern) | chassis.json | `patterns[Harvester].modules[0].name` | "Neuralink Module" (p. 77) | `"Neuralink Communicator"` | wrong-data |
| 7 | Scuttler (Harvester Pattern) | chassis.json | `patterns[Harvester].modules[1].name` | "Olfactory Gland" (p. 77, singular) | `"Olfactory Glands"` (plural) | minor |

## Notes

### Pattern Name Matching
Several pattern entries in chassis.json use the full module/system name from the reference data package (e.g., "Neuralink Communicator", "Refractive Shield Projector") rather than the shorter names printed in the PDF (e.g., "Neuralink Module", "Energy Shield"). This is likely intentional so that pattern system/module names match the canonical names used in systems.json and modules.json. However, discrepancy #1 is notable because "Energy Shield" and "Refractive Shield Projector" are different items in the Workshop Manual (different stats and behaviors), so this could be a genuine data error rather than a name normalization issue.

### "Bio-Salvage Value" vs "Salvage Value"
The PDF consistently uses "Bio-Salvage Value" as the label for bio-chassis salvage stats. The JSON uses `salvageValue` as the field name. This is a cosmetic labeling difference and is not flagged as a discrepancy since the field name is a schema convention, not a data error.

### Faction Formations
All 10 faction formations were verified against pages 12-21 and 76-77. The JSON formation arrays match the PDF's listed chassis, patterns, sources, and page numbers. No discrepancies found.

### Chimerium Mutation Table (p. 11)
Entry 13 in the JSON has a split `label`/`value` structure where the label contains the start of the description ("Your jaw distends...Range") and value contains the rest ("Close // Damage: 3 HP..."). This is a formatting quirk but the full text is present and correct.

## Entities Verified Clean

### Chassis (pages 64-73)
- Impaler (page 64) — stats: SP 26, EP 7, HC 15, SysSlots 15, ModSlots 3, Cargo 6, TL 3, SV 6. Chassis ability: Rugged Chassis. Content matches.
- Fleshripper (page 67) — stats: SP 50, EP 10, HC 16, SysSlots 26, ModSlots 4, Cargo 6, TL B, SV 50. Chassis abilities: Bio-Chassis, Heavily Armoured Carapace. Maw Pattern verified.
- Stormterror (page 68) — stats: SP 30, EP 12, HC 14, SysSlots 20, ModSlots 4, Cargo 6, TL B, SV 30. Chassis abilities: Bio-Chassis, Integrated Monstrous Bio-Wings.
- Cranium Bio-Mech (page 70) — stats: SP 18, EP 16, HC 10, SysSlots 14, ModSlots 5, Cargo 6, TL B, SV 18. Chassis abilities: Bio-Chassis, Probing Proboscis. Content and Probing Proboscis ability text verified.
- Scuttler (page 72-73) — stats: SP 14, EP 10, HC 13, SysSlots 16, ModSlots 3, Cargo 6, TL B, SV 14. Chassis abilities: Bio-Chassis, Integrated Scuttling Locomotion System.

### Chassis Patterns (pages 76-77)
- Alpha Pattern Impaler (page 76) — SP 26, systems and modules verified (see discrepancy #1, #2)
- Delta Pattern Impaler (page 76) — SP 26, all systems/modules match
- Experimental Bio Pattern Impaler (page 76) — SP 26, all systems/modules match
- Maw Pattern Fleshripper (page 77) — SP 50, all systems/modules match
- Screecher Pattern Stormterror (page 77) — SP 30, systems/modules verified (see discrepancy #3)
- Probe Pattern Cranium (page 77) — SP 18, systems/modules verified (see discrepancies #4, #5)
- Harvester Pattern Scuttler (page 77) — SP 14, systems/modules verified (see discrepancies #6, #7)
- Chimerium Harvester Pattern Thresher (page 76) — SP 15, all systems/modules match
- Mutant Pattern Thresher (page 76) — SP 15, all systems/modules match
- Acid Spitter Mule (page 76) — SP 12, all systems/modules match
- Throne Pattern Atlas (page 47, in chassis.json) — all systems/modules match

### Bio-Titans (page 56)
- Cortex Bio-Titan — SP 10, page 56, 5 actions verified. Content matches.

### Systems (page 74)
- Super-Sonic Screecher — TL B, slots 5, SV 12, page 74
- EDG Alpha — TL B, slots 5, SV 16, page 74
- Bio-Talon — TL B, slots 4, SV 6, page 74
- Acid Cannon — TL B, slots 7, SV 20, page 74
- Bio-Wings — TL B, slots 6, SV 25, page 74
- Bio-Maw — TL B, slots 6, SV 24, page 74. Actions: Bite, Consume. Verified.
- Chimerium Harvester — TL 3, slots 3, SV 2, page 74
- Mutated Locomotion System — TL B, slots 3, SV 4, page 75

### Modules (page 75)
- Adrenal Glands — TL B, slots 1, SV 7, page 75. Actions: Burst, Power. Verified.
- Chimerium Cell — TL 2, slots 1, SV 1, page 75
- Regeneration Glands — TL B, slots 1, SV 9, page 75. Actions: Regeneration Glands, Regrowth. Verified.
- Olfactory Glands — TL B, slots 1, SV 6, page 75. Actions: Olfactory Glands, Olfactory Scan. Verified.

### Equipment (page 63)
- Chimerium Salvaging Tools — TL 1, page 63
- Bio-Scanner — TL 1, page 63
- Bio-Rifle — TL 3, page 63
- Chimerium Beast Companion — TL 4, page 63

### NPCs (page 54)
- Chimerium Mutant — HP 5, Bio-Salvage Value 1, page 54. Actions verified.
- Chimerium Chosen — HP 8, Bio-Salvage Value 2, page 54. Actions verified.
- Chimerium Mutant Squad — HP 10, Bio-Salvage Value 2, page 54. Actions verified.

### Keywords (page 60)
- bio-system (page 60)
- bio-module (page 60)
- bio-chassis (page 60)

### Sources
- We Were Here First! — source entry verified

### Factions (pages 12-21)
- BOLZA Corp 1st Lance (page 12) — content, goals, assets, weaknesses, formation verified
- BOLZA Corp 2nd Lance (page 13) — content, goals, assets, weaknesses, formation verified
- BOLZA Logistics Corps (page 14) — content, goals, assets, weaknesses, formation verified
- SAKURA 78TH LANCE MSD (page 15) — content, goals, assets, weaknesses, formation verified
- Trash Locusts (page 16) — content, goals, assets, weaknesses, formation verified
- Chimerium Cult (page 17) — content, goals, assets, weaknesses, formation verified
- Red Mesa Mutants (page 18) — content, goals, assets, weaknesses, formation verified
- Crawler #693 Salvagers (page 19) — content, goals, assets, weaknesses, formation verified
- Wolf Z' Traders (page 20) — content, goals, assets, weaknesses, formation verified
- Wagon Wasters (page 21) — content, goals, assets, weaknesses, formation verified

### Roll Tables (pages 9-11, 22-23, 59, 78-79)
- Meteor Encounter (page 9) — 5 entries verified, content matches
- Harvesting Chimerium (page 9) — 5 entries + 5 content paragraphs verified
- Chimerium Exposure (page 10) — 5 entries + 4 content paragraphs verified
- Chimerium Mutation (page 11) — 20 entries verified (flat table, entries 1-20)
- Faction Encounter Table (page 22) — 10 duos entries verified
- Salvage Cache Table (page 23) — 20 entries verified (flat table)
- Chimerium Mutant Ability Table (page 59) — 10 duos entries verified, content matches
- Bio-Chassis Damage Table (page 78) — 6 entries verified (bio-chassis type table)
- Bio-Chassis Overload Table (page 79) — 6 entries verified (bio-chassis type table)
