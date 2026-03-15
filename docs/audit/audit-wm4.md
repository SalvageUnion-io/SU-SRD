# Audit Report: WM-4 (Workshop Manual pages 151-200)

## Summary
- Pages reviewed: 151-200
- Entities checked: 173 (4 chassis, 96 systems, 38 modules, 19 roll-tables, 3 keywords, 12 traits, 1 ability)
- Discrepancies found: 10

## Discrepancies

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Mechapult (roll table entry 13) | roll-tables.json | table.13.value | "equal to the 2x the Tech Level of the Scrap" | "equal to tHe₂× the Tech Level of the Scrap" | typo |
| 2 | Mechapult (roll table entry 18) | roll-tables.json | table.18.value | "equal to the 2× Tech Level of the Scrap" | "equal to tHe₂× Tech Level of the Scrap" | typo |
| 3 | Mechapult (roll table entry 9) | roll-tables.json | table.9.value | has Explosive (X) and Burn (X) Trait | `[[[Explosive] (X)]]` and `[[[Burn] (X)]]` — triple brackets | typo |
| 4 | Survey Scanner (roll table) | roll-tables.json | page | Listed at p. 192 in PDF (Self-Destruct section and Survey Scanner share page 192) | page: 194 | wrong-data |
| 5 | Survey Scanner (module) | modules.json | page | Survey Scanner entry starts on p. 192 in PDF | page: 194 | wrong-data |
| 6 | Neura-Phage (Breacher Pattern) | chassis.json | patterns[1].systems | PDF shows "120mm Heavy Autocannon" | JSON has `{"name": "120mm Heavy Autocannon"}` — correct name but PDF page 153 shows system list for Breacher as: "120mm Heavy Autocannon / Locomotion System / Electro-Magnetic Shield Projector" (3 systems total) which matches JSON | verified-ok |
| 7 | Leviathan | chassis.json | chassisAbilities | PDF (p.156) lists "Juggernaut", "Eradication Protocols", "Heavily Armoured Chassis" | JSON has same 3 abilities | verified-ok |
| 8 | He₂ Coolant Flush (module) | modules.json | page | PDF index (p.189) shows "He₂ Coolant Flush - p. 205" but it also appears referenced in Reactor Safety Protocols area on p. 197 | page: 197 (should be 205 per index) | wrong-data |
| 9 | Experimental Teleportation Hold (roll table) | roll-tables.json | table (2-19 range) | PDF shows "2 - 19: Teleport Successful!" as single entry | JSON splits into 3 entries (2-5, 6-10, 11-19) all "Teleport Successful!" | typo |
| 10 | Neura-Phage | chassis.json | content | PDF says "...captured and killed by enemy forces." | JSON matches | verified-ok |

### Revised Discrepancy Table (removing verified-ok entries)

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Mechapult (roll table entry 13) | roll-tables.json | table.13.value | "equal to the 2× the Tech Level" | "equal to tHe₂× the Tech Level" | typo |
| 2 | Mechapult (roll table entry 18) | roll-tables.json | table.18.value | "equal to the 2× Tech Level" | "equal to tHe₂× Tech Level" | typo |
| 3 | Mechapult (roll table entry 9) | roll-tables.json | table.9.value | "Explosive (X) and Burn (X) Trait" | `[[[Explosive] (X)]]` and `[[[Burn] (X)]]` (triple brackets instead of double) | typo |
| 4 | Survey Scanner | modules.json | page | p. 192 (module entry begins on this page) | 194 | wrong-data |
| 5 | He₂ Coolant Flush | modules.json | page | p. 205 (per tech 5 module index on p. 189) | 197 | wrong-data |
| 6 | Experimental Teleportation Hold (roll table) | roll-tables.json | table key structure | PDF: single "2-19" band | JSON: split into "2-5", "6-10", "11-19" (all same text) | typo |

## Entities Verified Clean

### Chassis (4)
- Neura-Phage (page 152) - stats, content, patterns, chassis abilities all match
- Iron Wyrm (page 154) - stats, content, patterns, chassis ability all match
- Leviathan (page 156) - stats, content, patterns, chassis abilities all match
- Shaitan (page 158) - stats, content, patterns, chassis abilities all match

### Systems (96) - Tech 1
- .50 Cal Machine Gun (page 164) - TL1, slots 2, SV 2
- Armour Plating (page 164) - TL1, slots 2, SV 1
- Cargo Pod (page 164) - TL1, slots 1, SV 1
- Escape Hatch (page 164) - TL1, slots 1, SV 1, recommended
- Chainsaw Arm (page 164) - TL1, slots 3, SV 3
- Floodlights (page 165) - TL1, slots 1, SV 1
- FM-3 Flamethrower (page 165) - TL1, slots 3, SV 3
- High Pressure Hose (page 165) - TL1, slots 2, SV 2
- Hydraulic Crusher (page 165) - TL1, slots 4, SV 4
- Locomotion System (page 165) - TL1, slots 2, SV 2, recommended
- Loudspeakers (page 165) - TL1, slots 1, SV 1
- Mechapult (page 166) - TL1, slots 5, SV 3
- Mini Mortar (page 167) - TL1, slots 5, SV 5
- Mining Rig (page 167) - TL1, slots 5, SV 5
- Red Laser (page 167) - TL1, slots 3, SV 3
- Rigging Arm (page 167) - TL1, slots 2, SV 2
- Transport Hold (page 168) - TL1, slots 2, SV 2
- Sandblaster (page 167) - TL1, slots 3, SV 2
- Riveting Gun (page 168) - TL1, slots 3, SV 4

### Systems - Tech 2
- Armoured Shield (page 168) - TL2, slots 2, SV 2
- 30mm Autocannon (page 168) - TL2, slots 5, SV 3
- Blue Mining Laser (page 169) - TL2, slots 7, SV 5
- Cargo Bay (page 169) - TL2, slots 4, SV 2
- Chaff Launcher (page 169) - TL2, slots 1, SV 1
- Dozer Blades (page 169) - TL2, slots 3, SV 2
- Grappling Harpoon (page 169) - TL2, slots 3, SV 2
- Green Laser (page 170) - TL2, slots 4, SV 2
- Heat Sink (page 170) - TL2, slots 2, SV 1
- High Gain Antenna (page 170) - TL2, slots 1, SV 1
- Industrial Body Kit (page 170) - TL2, slots 3, SV 3
- M2-X Mauler (page 170) - TL2, slots 3, SV 2
- Nanofibre Net Launcher (page 170) - TL2, slots 3, SV 2
- Module Switch (page 170) - TL2, slots 4, SV 1
- Personnel Transport Pod (page 171) - TL2, slots 3, SV 2
- Shotgun Pit (page 171) - TL2, slots 2, SV 2
- Smoke Machine (page 171) - TL2, slots 2, SV 2
- Refractive Shield Projector (page 171) - TL2, slots 2, SV 2
- Torpedo Tubes (page 172) - TL2, slots 6, SV 5
- Tracking Node (page 172) - TL2, slots 2, SV 2
- Welding Laser (page 172) - TL2, slots 3, SV 3

### Systems - Tech 3
- 120mm Cannon (page 172) - TL3, slots 7, SV 4
- Articulated Rigging Arm (page 173) - TL3, slots 3, SV 3
- Capacitance Bank (page 173) - TL3, slots 4, SV 2
- Composite Armour (page 173) - TL3, slots 3, SV 1
- Ejection System (page 173) - TL3, slots 2, SV 2
- AFF Coolant Foam (page 173) - TL3, slots 2, SV 2
- Electro-Magnetic Shield Projector (page 174) - TL3, slots 2, SV 2
- Fabrication Arm (page 174) - TL3, slots 3, SV 3
- Heavy Duty Mining Rig (page 174) - TL3, slots 7, SV 4
- Long Barrelled Green Laser (page 175) - TL3, slots 5, SV 2
- Mech Melee Armament (page 175) - TL3, slots 2, SV 2
- Missile Pod (page 175) - TL3, slots 7, SV 5
- Prawn Sifter (page 175) - TL3, slots 5, SV 3
- Rotary Minigun (page 176) - TL3, slots 7, SV 4
- Radiation Sealing (page 176) - TL3, slots 3, SV 3
- Rail Rifle (page 176) - TL3, slots 7, SV 4
- Red Pulse Laser (page 176) - TL3, slots 5, SV 3
- Smuggling Hold (page 176) - TL3, slots 5, SV 2
- Spider Locomotion System (page 177) - TL3, slots 4, SV 4
- Target Painter (page 177) - TL3, slots 2, SV 3
- Vectored Thrust Unit (page 177) - TL3, slots 4, SV 5

### Systems - Tech 4
- Adv. Fabrication Arm (page 177) - TL4, slots 3, SV 3
- Anti-Mech Mine Layer (page 178) - TL4, slots 5, SV 4
- Automated Weapon Turret (page 178) - TL4, slots 5, SV 2
- Aerosolised Nerve Gas Sprayer (page 178) - TL4, slots 5, SV 4
- CACB Laser (page 179) - TL4, slots 7, SV 5
- Corpo Body Kit (page 179) - TL4, slots 3, SV 3
- Electro-Magnetic Hardening (page 179) - TL4, slots 3, SV 2
- Grav Assisted Cargo Bay (page 179) - TL4, slots 5, SV 4
- Hover Locomotion System (page 179) - TL4, slots 5, SV 4
- Laser Anti-Missile System (page 179) - TL4, slots 2, SV 3
- Needle Missile Pod (page 180) - TL4, slots 3, SV 4
- Railgun (page 180) - TL4, slots 9, SV 8
- Shield Dome (page 180) - TL4, slots 4, SV 4
- Radomes (page 180) - TL4, slots 3, SV 3
- Snub-Nosed Blue Laser (page 181) - TL4, slots 5, SV 2
- Stabilising Locomotion System (page 181) - TL4, slots 5, SV 3
- Tesla Coils (page 181) - TL4, slots 5, SV 3

### Systems - Tech 5
- Fabrication Bay (page 183) - TL5, slots 7, SV 5
- Ion Cannon (page 183) - TL5, slots 5, SV 4
- Plasma Cannon (page 184) - TL5, slots 6, SV 5
- Reflective Shielding (page 184) - TL5, slots 4, SV 3
- Mole Torpedo (page 183) - TL5, slots 6, SV 5
- Monomolecular Blade (page 184) - TL5, slots 3, SV 3
- Multi-Phase Shield (page 184) - TL5, slots 6, SV 5
- Ejector Pod (page 182) - TL5, slots 3, SV 3
- Blue Beam Laser (page 182) - TL5, slots 7, SV 4
- Amphibious Locomotion System (page 182) - TL5, slots 5, SV 3

### Systems - Tech 6
- 120mm Heavy Autocannon (page 185) - TL6, slots 14, SV 7
- Executive Body Kit (page 185) - TL6, slots 3, SV 3
- Experimental Particle Beam Cannon (page 185) - TL6, slots 12, SV 10
- Experimental Teleportation Hold (page 185) - TL6, slots 5, SV 4
- N15 Fat Boy (page 186) - TL6, slots 10, SV 15
- Matter Phase Shield (page 186) - TL6, slots 4, SV 4
- Nanite Repair Arm (page 187) - TL6, slots 3, SV 3
- Teleportation Pod (page 187) - TL6, slots 3, SV 3

### Modules (38) - Tech 1
- Comms Module (page 190) - TL1, slots 1, SV 1, recommended
- Equipment Locker (page 190) - TL1, slots 1, SV 1
- Eggs Mayhem (page 190) - TL1, slots 1, SV 3
- Firewall (page 191) - TL1, slots 1, SV 2
- Personal Recreation Device (page 191) - TL1, slots 1, SV 1
- Reactor Flare (page 191) - TL1, slots 1, SV 1
- Self-Destruct (page 192) - TL1, slots 1, SV 1
- Weapon Link (page 193) - TL1, slots 1, SV 3
- Zoom Optics (page 193) - TL1, slots 1, SV 2

### Modules - Tech 2
- Barometric Sensor (page 193) - TL2, slots 1, SV 1
- Damage Assessor (page 193) - TL2, slots 1, SV 1
- Energy Cell (page 194) - TL2, slots 1, SV 2
- Deep Survey Scanner (page 194) - TL2, slots 1, SV 2
- Evasion Protocols (page 194) - TL2, slots 1, SV 1
- Hull Magnetiser (page 194) - TL2, slots 1, SV 2
- IR Night Vision Optics (page 195) - TL2, slots 1, SV 2
- Metal Detector (page 195) - TL2, slots 1, SV 2
- M315 Motion Scanner (page 195) - TL2, slots 1, SV 2
- Navigation Module (page 196) - TL2, slots 1, SV 2
- Pinpoint Targeter (page 196) - TL2, slots 1, SV 3
- Reactor Overload (page 196) - TL2, slots 1, SV 3
- Video Projection Array (page 196) - TL2, slots 1, SV 1
- Sleeping Beauty (page 197) - TL2, slots 1, SV 2
- Reactor Safety Protocols (page 197) - TL2, slots 1, SV 2
- Video Recording Array (page 197) - TL2, slots 1, SV 1

### Modules - Tech 3
- Adv. Weapon Link (page 198) - TL3, slots 2, SV 3
- Auto-Doctor (page 198) - TL3, slots 2, SV 4
- Comms Tapper (page 199) - TL3, slots 1, SV 2
- Concealed Locker (page 199) - TL3, slots 2, SV 3
- Coolant Flow Manifold (page 199) - TL3, slots 1, SV 2
- ECM Transmitter (page 199) - TL3, slots 1, SV 3
- Emergency Power Conduit (page 199) - TL3, slots 2, SV 3
- Encrypted Comms (page 200) - TL3, slots 1, SV 2
- Hacking Repeater Node (page 200) - TL3, slots 1, SV 2
- Multi-Targeter (page 200) - TL3, slots 1, SV 3
- Offensive Protocols (page 200) - TL3, slots 1, SV 2

### Modules - Tech 5
- He₂ Coolant Flush (page 197 in JSON, 205 per index) - FLAGGED ABOVE

### Roll Tables (19)
- Morale (page 167)
- Anti-Mech Mine Layer (page 178)
- Armoured Shield (page 168)
- Eggs Mayhem (page 190)
- Ejection System (page 173)
- Ejector Pod (page 182)
- Electro-Magnetic Shield Projector (page 174)
- Escape Hatch (page 164)
- Experimental Teleportation Hold (page 185)
- Firewall (page 191)
- Mechapult (page 166) - FLAGGED ABOVE (entries 9, 13, 18)
- Multi-Phase Shield (page 184)
- Prawn Sifter (page 175)
- Reactor Safety Protocols (page 197)
- Reflective Shielding (page 184)
- Refractive Shield Projector (page 171)
- Shield (page 186)
- Survey Scanner (page 194 in JSON, 192 per PDF) - FLAGGED ABOVE
- Teleportation Pod (page 187)

### Keywords (3)
- free action (page 165)
- morale (page 167)
- weapons system (page 184)

### Traits (12)
- anti-shielding (page 183)
- burn (page 184)
- communicator (page 190)
- deadly (page 181)
- guided (page 180)
- heat spike (page 193)
- ion (page 183)
- jamming (page 164)
- multi-attack (page 176)
- personnel capacity (page 171)
- pinning (page 164)
- targeter (page 180)

### Abilities (1)
- Ascension (page 153)

## Notes
- The Mechapult roll table entry 13 and 18 both contain the string "tHe₂×" which appears to be a character encoding issue. The PDF text reads "the 2×" in both cases. The subscript 2 (₂) suggests an OCR or copy-paste artifact.
- The Mechapult roll table entry 9 uses triple brackets `[[[Explosive] (X)]]` where the standard convention elsewhere in the data is double brackets `[[Explosive]]`.
- The Survey Scanner module page number (194) does not match the PDF — the Survey Scanner entry begins on page 192.
- The He₂ Coolant Flush module is listed at page 197 in JSON but the module index on PDF page 189 lists it at page 205. The actual module content appears to be on page 205 (in the Tech 5 section, which is beyond the scope of this batch but visible in the index).
- The Experimental Teleportation Hold roll table splits "2-19" into three sub-ranges in JSON. This is functionally equivalent but structurally differs from the PDF which shows a single "2-19" range band.
- All 4 chassis (Neura-Phage, Iron Wyrm, Leviathan, Shaitan) had their stats, patterns, pattern loadouts, content text, and chassis abilities verified against the PDF. All matched.
- All system and module tech levels, slot requirements, and salvage values were verified against the stat blocks visible in the PDF. All matched.
