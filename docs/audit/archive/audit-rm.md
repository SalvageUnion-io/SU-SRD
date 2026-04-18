# Audit Report: RM (Rainmaker pages 60-83)

## Summary
- Pages reviewed: 60-83
- Entities checked: 27
- Discrepancies found: 11

## Discrepancies

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Wader | chassis.json | structurePoints | 23 | 7 | wrong-data |
| 2 | Wader | chassis.json | energyPoints | 8 | 10 | wrong-data |
| 3 | Wader | chassis.json | heatCapacity | 14 | 6 | wrong-data |
| 4 | Wader | chassis.json | systemSlots | 14 | 8 | wrong-data |
| 5 | Wader | chassis.json | techLevel | 2 | 1 | wrong-data |
| 6 | Wader | chassis.json | salvageValue | 8 | 4 | wrong-data |
| 7 | Wader (Weaver Pattern) | chassis.json | patterns[0].systems[1].name | Personnel Transport Pod (Woven Home) | Personnel Transport Pod | wrong-data |
| 8 | Ravager | chassis.json + actions.json | chassisAbilities[0] / action name | Integrated Advanced Deployable Locomotion System | Integrated Advanced Stabilising Locomotion System | wrong-data |
| 9 | Agares (Pattern A) | chassis.json | patterns[0].systems[1].name | Automated 120mm Cannon | 120mm Cannon | wrong-data |
| 10 | Crush (Apophis) | actions.json | content text | "The 2x damage of the Vulnerable Trait is factored into this damage." | "THe\u2082x damage of the Vulnerable Trait is factored into this damage." | typo |
| 11 | Constricting Coils (Apophis) | actions.json | content text | PDF has typo "Aphosis" | JSON corrected to "Apophis" | typo |

## Detailed Notes

### Wader (chassis.json, page 60-61)
The Wader has **6 stat discrepancies** (#1-#6). The PDF stat block on page 61 clearly shows:
- STRUCTURE: 23 (JSON: 7)
- ENERGY: 8 (JSON: 10)
- HEAT CAP: 14 (JSON: 6)
- SYSTEM SLOTS: 14 (JSON: 8)
- MODULE SLOTS: 3 (matches)
- CARGO CAP: 6 (matches)
- TECH LEVEL: 2 (JSON: 1)
- SALVAGE VALUE: 8 (JSON: 4)

The Wader description/history text matches. The Weaver Pattern description matches. However, the PDF names the Personnel Transport Pod as "Personnel Transport Pod (Woven Home)" (#7), which JSON does not include.

### Ravager (chassis.json + actions.json, page 64-65)
Stats all match (SP 23, EP 8, HC 14, SS 14, MS 3, CC 6, TL 2, SV 8). The chassis ability name is **"Integrated Advanced Deployable Locomotion System"** in the PDF but **"Integrated Advanced Stabilising Locomotion System"** in both chassis.json and actions.json (#8). The PDF describes it as a "deployable Locomotion System" that "boosts the damage dealt and damage reduced by 1 SP. Whilst deployed all attacks the Ravager makes whilst deployed deal an additional 3SP damage and whenever the Ravager receives damage it is reduced by 3 SP to a minimum of 1." The JSON action text says it "functions as a Stabilising Locomotion System" with matching mechanics but different framing. The name mismatch is the key issue.

### Agares (chassis.json, page 66-67)
Stats match (SP 26, EP 12, HC 17, SS 18, MS 4, CC 6, TL 3, SV 8). Pattern A systems: PDF says "Automated 120mm Cannon" but JSON has "120mm Cannon" (#9). "Automated 120mm Cannon" does not appear to be a distinct system in the core book -- this may be the PDF's way of describing the 120mm Cannon on an Automech. However, the PDF clearly uses that specific name.

### Crush (Apophis) action (actions.json, page 81)
The parenthetical at the end reads "THe\u2082x" in JSON instead of "The 2x" (#10). The "TH" is oddly capitalized and the subscript 2 character was incorrectly inserted.

### Constricting Coils (Apophis) action (actions.json, page 81)
The PDF itself has a typo "Aphosis" instead of "Apophis". The JSON corrected this to "Apophis" (#11). This is a correct fix of a PDF typo -- flagging for awareness only.

## Entities Verified Clean
- Stolas (page 62) - all stats, abilities, pattern B content match
- Black Dragon (page 68) - all stats, Excoriate ability, Cerys pattern match
- Paladin (page 70) - all stats, Energy Smite ability, Lot pattern match
- Cerberus (page 72) - chassis stats, Automech/Cerberus Control System abilities, TAC-OS pattern match
- Napalm Shotgun system (page 76) - stats and content match
- Genetic Lock module (page 76) - stats and content match
- Deployable .50 Cal Machine Gun (page 77) - all fields match
- Machine Pistols (page 77) - all fields match
- Epoxy Gun (page 77) - all fields match
- Rebar Lance + Lance Charge (page 77) - all fields match
- Servo Lasso (page 77) - all fields match
- Fell Rifle (page 77) - all fields match
- Gully Crusher Squad (page 79) - HP, actions, content match
- Flint Children Squad (page 79) - HP, actions, content match
- Cuspers Squad (page 79) - HP, actions, content match
- Fell Stalkers Squad (page 79) - HP, actions, content match
- Free Hill Coalition Squad (page 79) - HP, actions, content match
- Basement Frogs (page 80) - HP, actions, content match
- Ghost (page 80-81) - HP, actions, content match
- Ghost Haunt (page 80) - HP, actions, content match
- Hill Worm Pattern Typhon (page 80) - SP, actions, content match
- Apophis (page 81) - SP, actions match (minor typos noted in #10, #11)
- Genbu (page 82) - SP, all 7 actions, content match
- Physalis (page 83) - SP, all 6 actions, content match
- Rainmaker source entry - content match
