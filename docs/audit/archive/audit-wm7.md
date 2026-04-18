# Audit Report: WM-7 (Workshop Manual pages 301-338)

## Summary
- Pages reviewed: 301-338
- Entities checked: 33
- Discrepancies found: 16

## Discrepancies

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | ability points | keywords.json | page | 321 (keyword definition on p.321) | 327 (index page) | wrong-data |
| 2 | setback | keywords.json | page | 325 | 320 | wrong-data |
| 3 | shutdown | keywords.json | page | 326 | 324 | wrong-data |
| 4 | turrets | keywords.json | page | 326 | 335 (index page) | wrong-data |
| 5 | turrets | keywords.json | content | "...attacks as a Green Laser. (p. 170)" | "...attacks as a Green Laser." (missing page reference) | missing |
| 6 | intact | keywords.json | page | 323 | 338 | wrong-data |
| 7 | downtime action | keywords.json | page | 322 | 329 (index page) | wrong-data |
| 8 | Portable Comms Unit | equipment.json | page | 81 (equipment section) | 301 (squads page) | wrong-data |
| 9 | Electro Grappling Hook | equipment.json | page | 84 (equipment section) | 301 (squads page) | wrong-data |
| 10 | Monomolecular Sword | equipment.json | page | 85 (equipment section) | 301 (squads page) | wrong-data |
| 11 | Pistol | equipment.json | page | 81 (equipment section, per index) | 314 (NPC page in scenario) | wrong-data |
| 12 | Green Laser Rifle | equipment.json | page | 82 (equipment section, per index) | 313 (NPC page in scenario) | wrong-data |
| 13 | Reactive Armour | equipment.json | page | 83 (equipment section, per index) | 333 (index page) | wrong-data |
| 14 | Can't Stop, Won't Stop | abilities.json | page | 42 (per index "Can't Stop, Won't Stop, 42") | 328 (index page) | wrong-data |
| 15 | Camo Suit | abilities.json | page | 51 (per index "Camo Suit, 51") | 328 (index page) | wrong-data |
| 16 | Knife Missile | abilities.json | page | 73 (per index "Knife Missile, 73") | 331 (index page) | wrong-data |

## Entities Verified Clean

### Squads (page 301)
- Elite Blade Squad (page 301) - name, HP (20), damageType (HP), content, and actions all match PDF. Monomolecular Sword action has correct stats: Range Close, Damage 6 SP, Melee, Deadly, Multi-Attack (2). Portable Comms Unit and Electro Grappling Hook listed correctly.
- Elite Beam Squad (page 301) - name, HP (20), damageType (HP), content match. Beta Fission Gun action correct: Range Long, Damage 9 SP, Burn (2), Energy, Explosive (1), Multi-Attack (2). Portable Comms Unit and Night Vision Optics listed correctly.
- Drone Squadron (page 301) - name, HP (8), damageType (SP), content match. Red Laser action correct: Range Medium, Damage 4 SP, Energy, Hot (1), Multi-Attack (2). Hover Locomotion System listed correctly.

### Roll Tables
- Group Initiative (page 330) - all 5 results match PDF exactly (page 337 orange table section)
- Critical Injury (page 323) - all 5 results match PDF exactly (page 338 orange table section)
- Critical Damage (page 338) - all 5 results match PDF exactly (page 338 orange table section)
- NPC Action (page 336) - all 5 results match PDF exactly (page 336 orange table section)
- Pilot Appearance (page 332) - all 20 flat table values match PDF content text on page 332
- Knife Missile roll table (page 331) - all 5 results match the Knife Missile ability roll table

### Keywords (content verified correct, page issues noted in discrepancies)
- advanced tree (page 321) - page and content correct
- hit points (page 323) - page and content correct
- severe environmental effects (page 325) - page and content correct
- mount / dismount (page 324) - page and content correct
- move (page 324) - page and content correct

### Traits (content verified correct)
- anti-organic (page 318) - page and content correct
- immobile (page 319) - page and content correct
- vulnerable (page 326) - page and content correct

## Notes

Most discrepancies in this batch are **wrong page numbers**. Several patterns emerged:

1. **Equipment items pointing to scenario/NPC pages instead of equipment definition pages**: Portable Comms Unit, Electro Grappling Hook, Monomolecular Sword (page 301 = squads page), Pistol (page 314 = NPC Tex page), Green Laser Rifle (page 313 = NPC Baines page). These should point to their equipment definition pages (80-87 range).

2. **Keywords/abilities pointing to index pages instead of definition pages**: ability points (327), downtime action (329), turrets (335), intact (338), Reactive Armour (333), Can't Stop Won't Stop (328), Camo Suit (328), Knife Missile (331). Pages 327-335 are the book's index.

3. **Keywords with slightly wrong page numbers**: setback (JSON: 320, PDF: 325), shutdown (JSON: 324, PDF: 326).
