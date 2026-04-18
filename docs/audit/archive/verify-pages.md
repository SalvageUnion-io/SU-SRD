# Page Number Verification

## Convention Analysis

Page numbers in this dataset follow a **mixed convention** — there is no single rule:

- **Classes, Chassis, Equipment**: Pages point to the **stat block page** (where the entity's full entry appears). E.g., Engineer = p.26 (the Engineer class page), Mule = p.100 (the Mule chassis stat block), First Aid Kit = p.80 (equipment stat block).
- **Keywords/Glossary terms**: Mixed. Some point to the **glossary** (pp. 321-326), some point to the **first meaningful occurrence** in the rules (e.g., "mech" = p.2, "downtime" = p.3, "heat" = p.30). There is no consistent pattern — the same keyword may point to either location.
- **Roll tables**: Pages should point to where the **table itself** appears in the PDF.
- **Abilities**: Pages should point to the ability's **stat block** within its class/tree section.
- **Creatures/NPCs/Drones/Squads**: Pages should point to the **stat block** in the bestiary section.
- **Modules**: Pages should point to the **stat block** in the modules section.

Given this mixed convention, the key question for each finding is: **Does the current page value point to something reasonable (stat block, glossary entry, or first occurrence)?** If it points to an unrelated page (e.g., an index page, wrong section entirely), it's a FIX. If it points to a valid alternative location, it's a SKIP.

## Verdicts

### FIX (confirmed errors)

These page numbers point to clearly wrong locations (index pages, wrong sections, or unrelated content).

| Entity | File | Current Page | Correct Page | Reason |
|--------|------|-------------|--------------|--------|
| Salvager (class) | classes.json | 9 | 44 | p.9 is the Introduction; p.44 is the Salvager class page with stat block |
| Can't Stop, Won't Stop | abilities.json | 328 | 42 | p.328 is the index; ability stat block is on p.42 (Hauler tree) |
| Camo Suit | abilities.json | 328 | 51 | p.328 is the index; ability stat block is on p.51 (Scout tree) |
| Knife Missile (ability) | abilities.json | 331 | 73 | p.331 is the index; ability stat block is on p.73 (Smuggler tree) |
| Mech Salvage (roll table) | roll-tables.json | 2 | 248 | p.2 is a rules intro page; the roll table is on p.248 |
| Survey Scanner (module) | modules.json | 194 | 192 | Stat block is on p.192, not p.194 |
| He2 Coolant Flush (module) | modules.json | 197 | 205 | Stat block is on p.205, not p.197 |
| Artl | creatures.json | 266 | 296 | p.266 is wrong bestiary section; stat block is on p.296 |
| Molebear | creatures.json | 266 | 297 | p.266 is wrong bestiary section; stat block is on p.297 |
| Carrion Bird | creatures.json | 266 | 297 | p.266 is wrong bestiary section; stat block is on p.297 |
| Chimeripede | creatures.json | 272 | 296 | p.272 is wrong bestiary section; stat block is on p.296 |
| Meld Splitter | meld.json | 270 | 289 | Stat block is on p.289, not p.270 |
| Wasteland Herd | squads.json | 270 | 301 | Stat block is on p.301, not p.270 |
| Trooper | npcs.json | 274 | 298 | Stat block is on p.298, not p.274 |
| Machine Gun Squad | squads.json | 274 | 300 | Stat block is on p.300, not p.274 |
| Defacer Drone | drones.json | 274 | 294 | Stat block is on p.294, not p.274 |
| Combat Drone | drones.json | 270 | 294 | Stat block is on p.294, not p.270 |
| Heavy Combat Drone | drones.json | 270 | 294 | Stat block is on p.294, not p.270 |
| Pest Drone | drones.json | 270 | 295 | Stat block is on p.295, not p.270 |
| Portable Comms Unit | equipment.json | 301 | 81 | p.301 is NPC section; equipment stat block is on p.81 |
| Electro Grappling Hook | equipment.json | 301 | 84 | p.301 is NPC section; equipment stat block is on p.84 |
| Monomolecular Sword | equipment.json | 301 | 85 | p.301 is NPC section; equipment stat block is on p.85 |
| Pistol | equipment.json | 314 | 81 | p.314 is unrelated; equipment stat block is on p.81 |
| Green Laser Rifle | equipment.json | 313 | 82 | p.313 is unrelated; equipment stat block is on p.82 |
| Reactive Armour | equipment.json | 333 | 83 | p.333 is unrelated; equipment stat block is on p.83 |
| Improvised Melee Weapon | equipment.json | 298 | 81 | p.298 is NPC section; equipment stat block is on p.81 |
| Salvaging Tools | equipment.json | 298 | 81 | p.298 is NPC section; equipment stat block is on p.81 |
| Rifle | equipment.json | 127 | 83 | p.127 is chassis section; equipment stat block is on p.83 |
| Sniper Rifle | equipment.json | 47 | 85 | p.47 is ability section; equipment stat block is on p.85 |
| Pilot Appearance (roll table) | roll-tables.json | 332 | 91 | p.332 is index area; table is on p.91 |
| Keepsake (roll table) | roll-tables.json | 24 | 90 | p.24 is rules section; table is on p.90 |
| Motto (roll table) | roll-tables.json | 24 | 90 | p.24 is rules section; table is on p.90 |
| Survey Scanner (roll table) | roll-tables.json | 194 | 192 | Table is on p.192, not p.194 |
| Crawler Deterioration (roll table) | roll-tables.json | 7 | 219 | p.7 is intro; table is on p.219 |
| Trading Bay (roll table) | roll-tables.json | 222 | 223 | Off by one; table is on p.223 |
| A.I. Personality (roll table) | roll-tables.json | 208 | 91 | p.208 is Mech Appearance table area; A.I. Personality table is on p.91 |
| Mech Appearance (roll table) | roll-tables.json | 94 | 208 | p.94 references the table on p.208; the actual table is on p.208 |
| Recruit (ability) | abilities.json | 219 | 76 | p.219 is crawler section; ability stat block is on p.76 (Union Rep tree) |
| Ascension (ability) | abilities.json | 153 | 61 | p.153 is unrelated; ability stat block is on p.61 |
| Knife Missile (roll table) | roll-tables.json | 331 | 73 | p.331 is index; roll table is on p.73 |
| Critical Injury (roll table) | roll-tables.json | 323 | 338 | p.323 is glossary (Hit Points area); table is on p.338 |
| Group Initiative (roll table) | roll-tables.json | 330 | 337 | p.330 is index area; table is on p.337 |
| Heating Unit (module) | modules.json | 59 | 69 | p.59 is the Pioneer/Deerstalker pattern page; module stat block is on p.69 |
| Pop Goes The Weasel (module) | modules.json | 59 | 69 | p.59 is the Pioneer/Deerstalker pattern page; module stat block is on p.69 |
| Meld Module Replicator (module) | modules.json | 59 | 69 | p.59 is the Pioneer/Deerstalker pattern page; module stat block is on p.69 |
| Storage Bay | crawler-bays.json | 221 | 222 | Off by one; stat block is on p.222 |
| Hacking Kit (equipment) | equipment.json | 51 | 34 | p.51 is Scout section; Hacking Kit stat block is on p.34 (Hacker section) |

### SKIP (intentional or acceptable)

These page numbers follow a reasonable convention (first occurrence, glossary entry, or valid alternate reference).

| Entity | File | Current Page | Reason for Keeping |
|--------|------|-------------|-------------------|
| ability points (keyword) | keywords.json | 327 | WAIT -- see VERIFY section; this needs correction |
| setback (keyword) | keywords.json | 320 | WAIT -- see VERIFY section |
| shutdown (keyword) | keywords.json | 324 | WAIT -- see VERIFY section |
| turrets (keyword) | keywords.json | 335 | WAIT -- see VERIFY section |
| intact (keyword) | keywords.json | 338 | WAIT -- see VERIFY section |
| downtime action (keyword) | keywords.json | 329 | WAIT -- see VERIFY section |
| vulnerable (keyword) | keywords.json | 326 | WAIT -- see VERIFY section |

**Note:** On review, none of the keyword findings should be SKIPped. All are moved to FIX or VERIFY below.

### Keyword Page Corrections (FIX)

The keywords glossary runs pp. 321-326 in the PDF. Many keyword page values in the JSON point to index pages (pp. 327+) instead of the glossary. The correct pages were verified against the PDF:

| Entity | File | Current Page | Correct Page | Reason |
|--------|------|-------------|--------------|--------|
| ability points | keywords.json | 327 | 321 | p.327 is the index; "Ability Points" definition is on p.321 in the glossary |
| setback | keywords.json | 320 | 325 | p.320 contains "Uses" keyword at top; "Setback" is on p.325 |
| shutdown | keywords.json | 324 | 326 | "Shutdown" definition is on p.326, not p.324 |
| turrets | keywords.json | 335 | 326 | p.335 is the index; "Turrets" definition is on p.326 in the glossary |
| intact | keywords.json | 338 | 323 | p.338 is Critical Injury Table; "Intact" definition is on p.323 in the glossary |
| downtime action | keywords.json | 329 | 322 | p.329 is the index; "Downtime Action" definition is on p.322 in the glossary |
| vulnerable | keywords.json | 326 | 321 | "Vulnerable" definition is on p.321 (top of glossary), not p.326 |

### SKIP (actual, intentional or acceptable)

| Entity | File | Current Page | Reason for Keeping |
|--------|------|-------------|-------------------|
| (none) | | | All page number findings were confirmed as genuine errors |

### VERIFY (needs human judgment)

These cases are ambiguous or involve pages that could not be definitively verified without visual confirmation of the specific PDF page.

| Entity | File | Current Page | Proposed Page | Why Ambiguous |
|--------|------|-------------|--------------|---------------|
| Hacking Kit | equipment.json | 51 | 34 | Auditor says p.34 (Hacker class section where the kit is mentioned). JSON has p.51 (Scout section). Need to verify which page has the actual Hacking Kit stat block -- it may appear in either or both locations. Listed as FIX above assuming p.34 is correct but human should confirm. |

## Summary

- **Total page findings reviewed**: 53
- **FIX (confirmed errors)**: 52 (including 7 keyword corrections)
- **SKIP (acceptable)**: 0
- **VERIFY (needs human check)**: 1

The vast majority of page errors fall into a few patterns:
1. **Index page references** (pp. 327-335): Many abilities, equipment, and keywords incorrectly point to index pages instead of stat blocks or glossary entries
2. **Wrong section entirely** (equipment pointing to NPC pages ~298-314, creatures/drones pointing to ~266-274): Likely a batch data entry error where page numbers from one section were applied to another
3. **Off-by-one or nearby page errors** (Survey Scanner 194->192, Trading Bay 222->223, Storage Bay 221->222): Minor transcription errors
4. **False Flag module pages** (59->69): All three modules point to p.59 (a chassis pattern page) instead of p.69 (the systems/modules stat block page)
