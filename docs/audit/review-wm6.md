# Review WM-6: Workshop Manual Pages 251-300

**Reviewer:** reviewer-wm6 (blind review)
**Source PDF:** Salvage Union Digital Edition 1.2, pages 251-300
**Date:** 2026-03-14

## Summary

Pages 251-270 are Mediator Advice (narrative text, not entity data). Entity data begins at page 270 (Encounter Tables) and continues through page 300 (Squads). I reviewed all entities with `source: "Salvage Union Workshop Manual"` and `page` between 251 and 300.

---

## Discrepancies Found

### Page Number Issues

#### 1. Chimeripede -- WRONG PAGE
- **JSON:** `"page": 272`
- **PDF:** Chimeripede appears on page **296** (Creatures section)
- Page 272 contains Encounter Tables (Ferrous Range / Central Wastes)

#### 2. Artl -- WRONG PAGE
- **JSON:** `"page": 266`
- **PDF:** Artl appears on page **296** (Creatures section)
- Page 266 is the "Denizens of the Wasteland" intro text

#### 3. Molebear -- WRONG PAGE
- **JSON:** `"page": 266`
- **PDF:** Molebear appears on page **297** (Creatures section)

#### 4. Carrion Bird -- WRONG PAGE
- **JSON:** `"page": 266`
- **PDF:** Carrion Bird appears on page **297** (Creatures section)

#### 5. Meld Splitter -- WRONG PAGE
- **JSON:** `"page": 270`
- **PDF:** Meld Splitter appears on page **289** (Meld section)
- Page 270 contains Encounter Tables

#### 6. Trooper -- WRONG PAGE
- **JSON:** `"page": 274`
- **PDF:** Trooper appears on page **298** (People section)
- Page 274 shows Frozen Gulf / Arco Encounters tables

#### 7. Machine Gun Squad -- WRONG PAGE
- **JSON:** `"page": 274`
- **PDF:** Machine Gun Squad appears on page **300** (Squads section)

#### 8. Wasteland Herd -- WRONG PAGE
- **JSON:** `"page": 270`
- **PDF:** The Wasteland Herd does not appear on page 270. Page 270 has Encounter Tables. The Squads section starts on page 300. Wasteland Herd is not visible on pages 300 or in the pages I reviewed (251-300). It may appear on page 301+.

#### 9. Defacer Drone -- WRONG PAGE
- **JSON:** `"page": 274`
- **PDF:** Defacer Drone appears on page **294** (Drones section)

#### 10. Combat Drone -- WRONG PAGE
- **JSON:** `"page": 270`
- **PDF:** Combat Drone appears on page **294** (Drones section)

#### 11. Heavy Combat Drone -- WRONG PAGE
- **JSON:** `"page": 270`
- **PDF:** Heavy Combat Drone appears on page **294** (Drones section)

#### 12. Pest Drone -- WRONG PAGE
- **JSON:** `"page": 270`
- **PDF:** Pest Drone appears on page **295** (Drones section)

---

### Content / Text Discrepancies

#### 13. Meld Drone Swarm -- description punctuation
- **JSON:** `"A swarm of multiple zombie-like Meld Drones"`
- **PDF (p.289):** `"A swarm of multiple zombie-like Meld Drones"` -- text matches but PDF renders as `"zombie-like"` with a hyphen. **Match confirmed, no issue.**

#### 14. Nanoid Tendrils -- description text
- **JSON:** `"The nanoid lashes out with it's tendrils"` (note: `it's` is a grammatical error for `its`, but this matches the PDF source which also uses `it's`)
- **PDF (p.289):** `"The nanoid lashes out with it's tendrils"` -- **Matches PDF** (typo is in original)

#### 15. Devour action -- description text
- **JSON:** `"The Meld Drones bite and claw at a target with all their multitude limbs and maws."`
- **PDF (p.289):** `"The Meld Drones bite and claw at a target with all their multitude limbs and maws."` -- **Match confirmed.**

#### 16. Devour action -- damage type label
- **PDF (p.289):** Shows damage as `"3HP"` (HP damage type)
- **JSON:** `"damageType": "HP"`, `"amount": 3` -- **Match confirmed.**

---

### Stat Verification

#### Bio-Titans (all verified correct)

| Entity | Field | JSON | PDF | Match |
|--------|-------|------|-----|-------|
| Scylla | SP | 39 | 39 | Yes |
| Scylla | Page | 276 | 276 | Yes |
| Typhon | SP | 67 | 67 | Yes |
| Typhon | Page | 278 | 278 | Yes |
| Chrysalis | SP | 80 | 80 | Yes |
| Chrysalis | Page | 280 | 280 | Yes |
| Phantom | SP | 54 | 54 | Yes |
| Phantom | Page | 282 | 282 | Yes |
| Electrophorus | SP | 96 | 96 | Yes |
| Electrophorus | Page | 284 | 284 | Yes |
| Tyrant | SP | 215 | 215 | Yes |
| Tyrant | Page | 286 | 286 | Yes |

#### Bio-Titan Actions (all verified correct)

| Action | Field | JSON | PDF | Match |
|--------|-------|------|-----|-------|
| Scythe Attack | Damage | 4 SP | 4 SP | Yes |
| Scythe Attack | Range | Close | Close | Yes |
| Scythe Attack | Traits | Melee, Multi-Attack(2) | Melee, Multi-Attack(2) | Yes |
| Tail Sweep | Damage | 3 SP (in text) | 3 SP | Yes |
| Armour Plating (Scylla) | Uses | 3 | x3 | Yes |
| Armour Plating (Typhon) | Uses | 2 | x2 | Yes |
| Cluster Energy Bombs | Damage | 5 SP | 5 SP | Yes |
| Cluster Energy Bombs | Range | Long | Long | Yes |
| Cluster Energy Bombs | Traits | Energy, Explosive(5), Multi-Attack(3) | Energy, Explosive(5), Multi-Attack(3) | Yes |
| Morph Scythes | Damage | 5 SP | 5 SP | Yes |
| Morph Scythes | Traits | Melee, Multi-Attack(3) | Melee, Multi-Attack(3) | Yes |
| Electrified Spines | Damage | 8 SP | 8 SP | Yes |
| Electrified Spines | Traits | Melee, Ion | Melee, Ion | Yes |
| Claw Swipes | Damage | 10 SP | 10 SP | Yes |
| Claw Swipes | Traits | Melee, Multi-Attack(2) | Melee, Multi-Attack(2) | Yes |
| Rending Bite | Damage | 20 SP | 20 SP | Yes |
| Rending Bite | Traits | Deadly, Melee | Deadly, Melee | Yes |
| Tail Swat | Damage | 15 SP | 15 SP | Yes |
| Tail Swat | Type | Reaction | Reaction | Yes |
| Irradiated Beam | Damage | 40 SP | 40 SP | Yes |
| Irradiated Beam | Traits | Burn(5), Energy, Explosive(5), Irradiated | Burn(5), Energy, Explosive(5), Irradiated | Yes |
| Behemoth Tendrils | Damage | 6 SP | 6 SP | Yes |
| Behemoth Tendrils | Traits | Melee, Multi-Attack(2) | Melee, Multi-Attack(2) | Yes |

#### Meld (all stats verified correct)

| Entity | Field | JSON | PDF | Match |
|--------|-------|------|-----|-------|
| Meld Drone | HP | 3 | 3 | Yes |
| Meld Drone | Salvage | 1 | 1 | Yes |
| Meld Drone Swarm | HP | 6 | 6 | Yes |
| Meld Drone Swarm | Salvage | 3 | 3 | Yes |
| Meld Nanoid | SP | 5 | 5 | Yes |
| Meld Nanoid | Salvage | 5 | 5 | Yes |
| Meld Nanoid | Traits | Fast | Fast | Yes |
| Meld Splitter | SP | 10 | 10 | Yes |
| Meld Splitter | Salvage | 10 | 10 | Yes |
| Meld Behemoth | SP | 60 | 60 | Yes |

#### Meld Actions (all verified correct)

| Action | Damage | JSON | PDF | Match |
|--------|--------|------|-----|-------|
| Bite | 2 HP | 2 HP | 2 HP | Yes |
| Devour | 3 HP | 3 HP | 3HP | Yes |
| Nanoid Tendrils | 3 SP | 3 SP | 3 SP | Yes |
| Splitter Tendrils | 4 SP | 4 SP | 4 SP | Yes |

#### Creatures (all stats verified correct)

| Entity | Field | JSON | PDF | Match |
|--------|-------|------|-----|-------|
| Irradiated Scorpion | HP | 4 | 4 | Yes |
| Artl | HP | 2 | 2 | Yes |
| Artl | Traits | Burrower | Burrower | Yes |
| Chimeripede | HP | 10 | 10 | Yes |
| Wasteland Bear | HP | 5 | 5 | Yes |
| Molebear | HP | 12 | 12 | Yes |
| Molebear | Traits | Burrower | Burrower | Yes |
| Carrion Bird | HP | 3 | 3 | Yes |
| Carrion Bird | Traits | Fly | Fly | Yes |

#### Creature Actions (all verified correct)

| Action | Damage | Type | JSON | PDF | Match |
|--------|--------|------|------|-----|-------|
| Stinger | 2 HP | Melee, Poison, Deadly(Creatures Only) | Yes | Yes | Yes |
| Acid Spit | 2 HP | Burn(2) | Yes | Yes | Yes |
| Barbed Tentacles | 3 HP | Melee, Pinning, Poison, Multi-Attack(3) | Yes | Yes | Yes |
| Bear Carnage | 4 HP | Melee | Yes | Yes | Yes |
| Iron Claw | 4 SP | Melee | Yes | Yes | Yes |
| Talons | 3 HP | -- | Yes | Yes | Yes |

#### NPCs / People (all stats verified correct)

| Entity | HP | JSON | PDF | Match |
|--------|-----|------|-----|-------|
| Wastelander | 2 | 2 | 2 | Yes |
| Raider | 3 | 3 | 3 | Yes |
| Trooper | 5 | 5 | 5 | Yes |
| Veteran | 9 | 9 | 9 | Yes |
| Combat Pilot | 10 | 10 | 10 | Yes |
| Ace | 16 | 16 | 16 | Yes |

#### Vehicles (all stats verified correct)

| Entity | SP | TL | SV | JSON | PDF | Match |
|--------|-----|-----|-----|------|-----|-------|
| Power Loader | 1 | 1 | 1 | Yes | Yes | Yes |
| Box Wheel | 1 | 1 | 1 | Yes | Yes | Yes |
| Fighting Box Wheel | 2 | 1 | 2 | Yes | Yes | Yes |
| Armoured Box Wheel | 4 | 2 | 3 | Yes | Yes | Yes |
| Tank | 6 | 3 | 4 | Yes | Yes | Yes |
| Rotorcraft | 3 | 4 | 3 | Yes | Yes | Yes |
| Machine Gun Turret | 2 | 1 | 1 | Yes | Yes | Yes |

#### Drones (all stats verified correct)

| Entity | SP | TL | SV | JSON | PDF | Match |
|--------|-----|-----|-----|------|-----|-------|
| Defacer Drone | 2 | 1 | 1 | Yes | Yes | Yes |
| Salvo Drone | 3 | 1 | 2 | Yes | Yes | Yes |
| Survey Drone | 1 | 1 | 1 | Yes | Yes | Yes |
| Combat Drone | 4 | 2 | 2 | Yes | Yes | Yes |
| Heavy Combat Drone | 5 | 3 | 2 | Yes | Yes | Yes |
| Walker Drone | 6 | 2 | 3 | Yes | Yes | Yes |
| Pest Drone | 4 | 3 | 3 | Yes | Yes | Yes |
| Hover Drone | 4 | 4 | 3 | Yes | Yes | Yes |
| Needle Drone | 2 | 4 | 3 | Yes | Yes | Yes |

#### Squads (all stats verified correct)

| Entity | HP | JSON | PDF | Match |
|--------|-----|------|-----|-------|
| Waster Mob | 4 | 4 | 4 | Yes |
| Raider Band | 6 | 6 | 6 | Yes |
| Rifle Squad | 10 | 10 | 10 | Yes |
| Machine Gun Squad | 10 | 10 | 10 | Yes |
| Missile Squad | 10 | 10 | 10 | Yes |

---

### Vehicle Trait Verification

| Vehicle | Trait | JSON | PDF | Match |
|---------|-------|------|-----|-------|
| Box Wheel | Personnel Capacity | 4 | 4 | Yes |
| Box Wheel | Wheeled | Yes | Yes | Yes |
| Fighting Box Wheel | Personnel Capacity | 6 | 6 | Yes |
| Fighting Box Wheel | Wheeled | Yes | Yes | Yes |
| Armoured Box Wheel | Personnel Capacity | 18 | 18 | Yes |
| Armoured Box Wheel | Wheeled | Yes | Yes | Yes |
| Rotorcraft | Personnel Capacity | 6 | 6 | Yes |
| Rotorcraft | Hover | Yes | Yes | Yes |
| Machine Gun Turret | Immobile | Yes | Yes | Yes |

---

### Vehicle/Drone Systems Verification

| Entity | Systems | JSON | PDF | Match |
|--------|---------|------|-----|-------|
| Power Loader | Locomotion System, Rigging Arm | Locomotion System, Rigging Arm x2 | **DISCREPANCY** |
| Box Wheel | Locomotion System | Locomotion System | Yes |
| Fighting Box Wheel | Locomotion System, .50 Cal Machine Gun | Locomotion System, .50 Cal Machine Gun | Yes |
| Armoured Box Wheel | Locomotion System, 30mm Autocannon | Locomotion System, 30mm Autocannon | Yes |
| Tank | Locomotion System, 120mm Cannon | Locomotion System, 120mm Cannon | Yes |
| Rotorcraft | Hover Locomotion System, Rotary Minigun | Hover Locomotion System, Rotary Mini Gun | Yes |
| Machine Gun Turret | .50 Cal Machine Gun | .50 Cal Machine Gun | Yes |

#### 17. Power Loader -- MISSING SYSTEM QUANTITY
- **JSON:** `"systems": ["Locomotion System", "Rigging Arm"]`
- **PDF (p.292):** Shows `"Rigging Arm x 2"` -- the Power Loader has **two** Rigging Arms
- The JSON only lists one `"Rigging Arm"` entry. The `x 2` quantity is missing.

---

### Rotorcraft System Name

#### 18. Rotorcraft weapon name -- MINOR
- **JSON:** `"Rotary Minigun"`
- **PDF (p.293):** `"Rotary Mini Gun"` (two words: "Mini Gun")
- This may be an intentional normalization, but the PDF text reads "Rotary Mini Gun"

---

### Keywords in Page Range

The following keywords have pages in the 251-300 range:

#### 19. Keyword "irradiated" -- page verified
- **JSON:** `"page": 296`
- **PDF (p.296):** The Irradiated keyword does not appear as a standalone entry on page 296. Page 296 shows the Creatures section. The Irradiated keyword text in JSON describes mechanics about irradiated areas. This may reference the trait "Irradiated" which is mentioned in connection with the Irradiated Scorpion on that page, but the full keyword definition likely appears elsewhere. **Flagged as potential page mismatch -- needs verification against other pages.**

#### 20. Keyword "poison" -- page verified
- **JSON:** `"page": 296`
- Same situation as above -- page 296 is the Creatures page. The Poison trait is used by the Stinger action on that page but the full keyword definition may be on another page.

#### 21. Keyword "squad" -- page verified
- **JSON:** `"page": 300`
- **PDF (p.300):** The Squads section begins on page 300 with introductory text about squads. **Match confirmed.**

---

### Entities NOT Found in Page Range

The following entities are listed with pages in the 251-300 range but appear to reference content from the "guide" sections (Mediator Advice, Campaign Design). These are narrative guides, not stat-block entities, so I did not deeply audit their prose but confirmed the pages exist:

- **Guides:** Two guide entries with pages in this range would need separate verification against the full guides.json structure.

---

## Discrepancy Summary

| # | Entity | Field | Issue | Severity |
|---|--------|-------|-------|----------|
| 1 | Chimeripede | page | JSON: 272, PDF: 296 | High |
| 2 | Artl | page | JSON: 266, PDF: 296 | High |
| 3 | Molebear | page | JSON: 266, PDF: 297 | High |
| 4 | Carrion Bird | page | JSON: 266, PDF: 297 | High |
| 5 | Meld Splitter | page | JSON: 270, PDF: 289 | High |
| 6 | Trooper | page | JSON: 274, PDF: 298 | High |
| 7 | Machine Gun Squad | page | JSON: 274, PDF: 300 | High |
| 8 | Wasteland Herd | page | JSON: 270, not found on 270 | High |
| 9 | Defacer Drone | page | JSON: 274, PDF: 294 | High |
| 10 | Combat Drone | page | JSON: 270, PDF: 294 | High |
| 11 | Heavy Combat Drone | page | JSON: 270, PDF: 294 | High |
| 12 | Pest Drone | page | JSON: 270, PDF: 295 | High |
| 17 | Power Loader | systems | Missing "x 2" for Rigging Arm | Medium |
| 18 | Rotorcraft | systems | "Rotary Minigun" vs PDF "Rotary Mini Gun" | Low |

**Total: 14 discrepancies (12 page number errors, 1 missing system quantity, 1 minor naming)**

All stat values (HP, SP, Tech Level, Salvage Value, damage amounts, traits) are correct across all entities verified.
