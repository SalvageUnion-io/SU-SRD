# Review: Rainmaker (Pages 60-83)

Independent blind review comparing JSON data against Rainmaker Digital Edition 1.1 PDF.

## Chassis

### Wader (p.60-61)

| Field | PDF | JSON | Match? |
|-------|-----|------|--------|
| SP | 23 | 7 | MISMATCH |
| EP | 8 | 10 | MISMATCH |
| Heat Cap | 14 | 6 | MISMATCH |
| System Slots | 14 | 8 | MISMATCH |
| Module Slots | 3 | 3 | OK |
| Cargo Cap | 6 | 6 | OK |
| Tech Level | 2 | 1 | MISMATCH |
| Salvage Value | 8 | 4 | MISMATCH |

- **6 stat mismatches** on the Wader chassis. Every stat except Module Slots and Cargo Cap differs from the PDF.
- **Weaver Pattern system name**: PDF says "Personnel Transport Pod (Woven Home)" -- JSON has "Personnel Transport Pod" (missing the "(Woven Home)" qualifier).

### Stolas (p.62-63)

All stats match (SP 20, EP 10, Heat Cap 15, System Slots 16, Module Slots 3, Cargo 6, Tech Level 2, Salvage Value 6).

- **Pattern B module name**: PDF says "Weapon Link Module (.50 Cal Machine Gun x 5)" -- JSON has just "Weapon Link". The PDF name is more specific, indicating the linked weapon. This may be an intentional simplification but differs from the PDF.

### Ravager (p.64-65)

All stats match (SP 23, EP 8, Heat Cap 14, System Slots 14, Module Slots 3, Cargo 6, Tech Level 2, Salvage Value 8).

- **Chassis ability name**: PDF says "Integrated Advanced Deployable Locomotion System" -- JSON has "Integrated Advanced Stabilising Locomotion System". The PDF ability description says it "functions as a deployable Locomotion System" while JSON description references "Stabilising Locomotion System". This is a name and mechanics mismatch.
- **Chassis ability text**: PDF says "This system functions as a deployable Locomotion System but boosts the damage dealt and damage reduced by 1 SP. Whilst deployed all of the attacks the Ravager makes whilst deployed deal an additional 3SP damage and whenever the Ravager receives damage it is reduced by 3 SP to a minimum of 1." -- JSON says "This Chassis Ability functions as a Stabilising Locomotion System. (p.181 SU Core Book) It has the following improvements: The Ravager reduces all damage dealt to it by 3 SP whilst stabilised, to a minimum of 1. The first attack the Ravager makes on its turn whilst stabilised deals an additional 3 SP damage." The base system type differs (deployable vs stabilising) and the text structure is quite different.
- **Pattern system name**: PDF says "Missile Pods" (plural) -- JSON has "Missile Pod" (singular).

### Agares (p.66-67)

All stats match (SP 26, EP 12, Heat Cap 17, System Slots 18, Module Slots 4, Cargo 6, Tech Level 3, Salvage Value 8).

- **Pattern system name**: PDF says "Automated 120mm Cannon" -- JSON has "120mm Cannon" (missing "Automated" prefix).
- **Pattern system name**: PDF says "Missile Pods" (plural) -- JSON has "Missile Pod" (singular).
- Note: PDF p.67 chassis abilities section says "The Stolas Mech can produce clouds..." for Hell Fumes -- this appears to be a copy-paste error in the PDF itself (should say Agares). JSON uses the generic `[(CHASSIS)]` placeholder so is unaffected.

### Black Dragon (p.68-69)

All stats match (SP 28, EP 10, Heat Cap 17, System Slots 19, Module Slots 4, Cargo 6, Tech Level 4, Salvage Value 7).

- No discrepancies found. Pattern systems and modules match. Chassis ability text matches.

### Paladin (p.70-71)

All stats match (SP 32, EP 15, Heat Cap 12, System Slots 20, Module Slots 5, Cargo 6, Tech Level 4, Salvage Value 10).

- **Pattern system name**: PDF says "Articulated" as a standalone entry -- JSON has "Articulated Rigging Arm". The PDF likely abbreviates "Articulated Rigging Arm" to just "Articulated".
- No other discrepancies.

### Cerberus (p.72-75)

The Cerberus has separate stat blocks for each of its three heads and the chassis body.

**JSON only stores the chassis-level stats** (SP 40, EP 18, Heat Cap 30, System Slots 5, Module Slots 2, Cargo 6, Tech Level 5, Salvage Value 18) -- these match the PDF chassis stats.

**Head stats from PDF not individually represented in JSON**:

| Head | SP | EP | Heat | Sys Slots | Mod Slots | Cargo | Tech | Salvage |
|------|----|----|------|-----------|-----------|-------|------|---------|
| Kyrios (Head 1) | 25 | 0 | 0 | 15 | 2 | 0 | 5 | 10 |
| Phren (Head 2) | 15 | 0 | 0 | 9 | 4 | 0 | 5 | 10 |
| Morphos (Head 3) | 20 | 0 | 0 | 12 | 3 | 0 | 5 | 10 |

This is likely a data modeling limitation rather than an error -- the Cerberus is unique in having sub-entities with their own stat blocks. The pattern content paragraphs in JSON do describe the head loadouts.

- **Pattern name**: PDF says "TAC-OS PATTERN CERBERUS" -- JSON pattern name is "TAC-OS PATTERN CERBERUS" -- match.
- PDF p.74 text: "Cerberus restores all of its statistics and repairs any damage in a Tech 5 Mechbay or higher, during Downtime as normal." -- JSON content says "Tech 5 Mechbay or higher during Downtime" -- match.

## Systems

### Napalm Shotgun (p.76)

All fields match: 3 slots, Tech Level 4, Salvage Value 3, Range Close, 2 SP, Anti-Organic, Overheat, Burn(2).

- No discrepancies.

## Modules

### Genetic Lock (p.76)

Stats match: 4 slots, Tech Level 2.

- **Salvage Value**: PDF does not clearly show a salvage value in the stat boxes (the icons show 4 slots, T2, and what appears to be salvage 1). JSON has salvageValue 1. Cannot fully confirm from PDF image.
- **Action text**: Both PDF and JSON contain "designed to alert though with a high pitched alarm" -- this appears to be a typo in the source material ("though" should likely be "those"), but JSON faithfully reproduces it.

## Pilot Equipment (p.77)

### Deployable .50 Cal Machine Gun
All fields match: T2, Close, 2 SP, Ballistic/Pinning/Heavy/Deployable. Text matches.

### Machine Pistols
All fields match: T3, Close, 4 HP, Ballistic, Multi-Attack(2). Text matches.

### Epoxy Gun
All fields match: T1, Close, 1 SP. No traits listed in PDF or JSON.

### Rebar Lance
All fields match: T2, Close, 2SP, Melee. Text matches.

### Lance Charge
All fields match: Range Medium, Turn Action. Text matches.

### Servo Lasso
All fields match: T2, Range Medium. Text matches.

- **Minor text difference**: PDF says "On a succesful hit" (typo in PDF) -- JSON says "On a successful hit" (corrected spelling).

### Fell Rifle
All fields match: T3, Long, 3 SP, Ballistic. Text matches.

## NPCs / Squads (p.79)

### Gully Crusher Squad
HP 8 matches. Machine-Pistols (Close, 4 HP, Ballistic, Multi-Attack(4)) matches. Outrider Hunters text matches.

### Flint Children Squad
HP 8 matches. IED (Close, 4 SP, Explosive(1), Multi-Attack(2)) matches. Demolition Experts and Minefield text match.

### Cuspers Squad
HP 6 matches. Epoxy Guns (Close, 1 SP, Multi-Attack(2)) matches. Hit & Run text matches.

### Fell Stalkers Squad
HP 8 matches. Fell Rifles (Long, 3 SP, Ballistic, Multi-Attack(2)) matches.

- **Action name**: PDF says "Thermal Optics" -- JSON action is named "Thermal Goggles" with description "T3 Pilot Equipment, acts as Thermal Optics." The PDF uses "Thermal Optics" as the ability name for the squad; JSON renamed it to "Thermal Goggles".
- Born in the Saddle text matches.

### Free Hill Coalition Squad
HP 10 matches. Rebar Lances and Servo-Lasso references match.

## Creatures (p.81)

### Basement Frogs
HP 2 matches. All actions (Pseudo-teeth, Tongue Lash, Ambush) match.

### Ghost
HP 4 matches. Metal Bars and Ripping Hands (Close, 1 SP) matches.

- **Phased action text**: PDF says "Ghost Haunts are permanently phased" -- JSON says "Ghosts are permanently phased". The PDF text under the Ghost heading starts with "Ghost Haunts" which seems like a PDF error (the Ghost Haunt entry says "Phased: See Ghost" implying the Phased text lives under Ghost). JSON text is more internally consistent.

### Ghost Haunt
HP 12 matches. Metal Bars and Ripping Hands (Close, 2 SP, Multiattack(2)) matches. "Phased: See Ghost" / "Organic: See Ghost" references match.

## Bio-Titans

### Apophis (p.81)
SP 60 matches. All actions present and match.

- **Crush action text**: PDF says "(The 2x damage of the Vulnerable Trait is factored into this damage.)" -- JSON says "(THe₂x damage of the Vulnerable Trait is factored into this damage.)" The JSON has a formatting artifact "THe₂x" where it should be "The 2x" (the subscript 2 from He₂ seems to have leaked into the text).
- **Constricting Coils**: PDF has typo "Aphosis" -- JSON correctly has "Apophis". JSON is correct here.
- **Constricting Coils target count**: PDF says "up to 4 Creatures" -- JSON says "up to 4 Creatures" -- match. But PDF also says "Aphosis may only constrict one Mech or 3 Creatures at a time" and JSON says "Apophis may only constrict one Mech or 3 Creatures at a time" -- match (aside from the typo correction).

### Hill Worm Pattern Typhon (p.81)
SP 67 in JSON. PDF says "This uses the stats of Typhon (pg.279 Salvage Union Core Book) with the following additional special rule." The SP is sourced from the Core Book, not directly stated on this page. Cannot verify from Rainmaker PDF alone.

- **Metallic Reconstitution text**: PDF says "It gains an additional Armour Plating when it reduces a Mech or Vehicle to 0 SP." -- JSON says "It gains an additional Armour Plating when it reduces a Mech or Vehicle to 0 SP." -- match.
- **Spiked Carapace text**: JSON says "When Typhon unborrows all targets within Close Range..." -- should be "unburrows" (typo in JSON: "unborrows" instead of "unburrows").

### Genbu (p.82)
SP 47 matches. Armour Plating x6 matches. All actions match.

- **Grasping Tentacles text**: PDF says "A target hit by this attack gains the Vulnerable and Immobile Trait." -- JSON says "A target hit by this attack gains the Vulnerable and Immobile Trait." -- match.

### Physalis (p.83)
SP 34 matches. All actions match.

- **Titanic Actions list item**: PDF says "Physalis uses it's Mech Marionette Ability" -- JSON says "Physalis uses its Mech Marionette Ability" -- JSON corrected the grammatical error ("it's" -> "its"). Minor.
- **Puppeteer Tendrils**: PDF says "Puppeteer tendrils can target any Mech that does not have a Pilot in Range." -- JSON says "Puppeteer tendrils can target any Mech without a Pilot in Range." -- minor rewording, same meaning.
- **Puppet Shield**: PDF says "During a round, Physalis may use this Reaction once per Mech it has under its control." -- JSON matches.

## Patterns on p.78 (Non-Rainmaker chassis patterns)

Page 78 shows "Royce Pattern Scrapper" and "Gruman Pattern Neura-Phage" -- these are patterns for Core Book chassis (Scrapper, Neura-Phage) but sourced from Rainmaker. These do not appear to be in the Rainmaker-filtered JSON data. They may be stored under their respective Core Book chassis entries rather than as separate Rainmaker entities.

## Summary of Discrepancies

### Critical (stat/mechanic errors)
1. **Wader: 6 stat mismatches** -- SP (23 vs 7), EP (8 vs 10), Heat Cap (14 vs 6), System Slots (14 vs 8), Tech Level (2 vs 1), Salvage Value (8 vs 4)
2. **Ravager chassis ability name/type mismatch** -- PDF "Integrated Advanced Deployable Locomotion System" vs JSON "Integrated Advanced Stabilising Locomotion System". Different base system type and different ability description text.
3. **Crush (Apophis) text corruption** -- JSON has "THe₂x" instead of "The 2x"
4. **Spiked Carapace (Typhon) typo** -- JSON has "unborrows" instead of "unburrows"

### Moderate (name mismatches affecting lookups)
5. **Agares pattern system**: PDF "Automated 120mm Cannon" vs JSON "120mm Cannon"
6. **Ravager/Agares pattern system**: PDF "Missile Pods" vs JSON "Missile Pod" (plural vs singular)
7. **Wader pattern system**: PDF "Personnel Transport Pod (Woven Home)" vs JSON "Personnel Transport Pod"
8. **Fell Stalkers action name**: PDF "Thermal Optics" vs JSON "Thermal Goggles"
9. **Stolas Pattern B module**: PDF "Weapon Link Module (.50 Cal Machine Gun x 5)" vs JSON "Weapon Link"

### Minor (text corrections, formatting)
10. **Phased (Ghost)**: PDF "Ghost Haunts" vs JSON "Ghosts" -- JSON is more consistent
11. **Physalis Titanic Actions**: JSON corrected "it's" to "its" (grammar fix)
12. **Puppeteer Tendrils**: Minor rewording ("that does not have" vs "without")
13. **Servo Lasso**: JSON corrected PDF typo "succesful" to "successful"
14. **Cerberus head stats**: Not individually modeled in JSON (data modeling limitation)
15. **Royce Pattern Scrapper / Gruman Pattern Neura-Phage** (p.78): Not found in Rainmaker-filtered data; may be stored under Core Book chassis entries
