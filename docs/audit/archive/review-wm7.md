# Review WM-7: Workshop Manual Pages 301-338

**Reviewer**: reviewer-wm7 (blind review)
**PDF**: Salvage Union Digital Edition 1.2, pages 301-338
**Date**: 2026-03-14

## Scope

Entities in JSON data with `page` between 301 and 338 AND `source` = "Salvage Union Workshop Manual":

- **abilities.json**: 3 entries (Can't Stop Won't Stop p328, Camo Suit p328, Knife Missile p331)
- **equipment.json**: 6 entries (Portable Comms Unit p301, Electro Grappling Hook p301, Monomolecular Sword p301, Pistol p314, Green Laser Rifle p313, Reactive Armour p333)
- **keywords.json**: 11 entries (ability points p327, advanced tree p321, anti-organic p318, hit points p323, immobile p319, setback p320, severe environmental effects p325, shutdown p324, mount / dismount p324, move p324, vulnerable p326) plus intact p338, turrets p335, downtime action p329
- **roll-tables.json**: 6 entries (Critical Injury p323, Group Initiative p330, NPC Action p336, Pilot Appearance p332, Knife Missile p331, Critical Damage p338)
- **squads.json**: 3 entries (Elite Blade Squad p301, Elite Beam Squad p301, Drone Squadron p301)
- **traits.json**: 3 entries (anti-organic p318, immobile p319, ballistic p84 -- note: ballistic not in range but anti-organic and immobile are trait entries with pages in range)

---

## Findings

### SQUADS

#### 1. Wasteland Herd -- page discrepancy (INFORMATIONAL)
- **JSON page**: 270
- **PDF**: The Wasteland Herd stat block visually appears on page 301 alongside Elite Blade Squad, Elite Beam Squad, and Drone Squadron.
- **Note**: This may be intentional if the primary entry is elsewhere (page 270 in the Wasteland Creatures section). Not necessarily a bug, but worth flagging.

#### 2. Elite Blade Squad -- `asset_url` references "elite beam squad"
- **File**: `squads.json`, Elite Blade Squad entry
- **Field**: `asset_url`
- **JSON**: `"asset_url": "https://opxrguskxuogghzcnppk.supabase.co/storage/v1/object/public/LP-Assets/squads/elite%20beam%20squad.jpg"`
- **Issue**: The Elite Blade Squad's `asset_url` filename says "elite beam squad.jpg". This is likely the wrong image -- it should reference the blade squad image, not the beam squad image.
- **Severity**: Medium

#### 3. Elite Beam Squad -- content text
- **JSON**: `"value": "Apex troops in heavy armour armed with a big ol' gun."`
- **PDF**: "Apex troops in heavy armour armed with a big ol' gun."
- **Status**: MATCH

#### 4. Elite Blade Squad -- content text
- **JSON**: `"value": "Heavy assault troops armed with energised blades."`
- **PDF**: "Heavy assault troops armed with energised blades."
- **Status**: MATCH

#### 5. Drone Squadron -- content text
- **JSON**: `"value": "A swarm of Combat Drones flying in sync."`
- **PDF**: "A swarm of Combat Drones flying in sync."
- **Status**: MATCH

#### 6. Squad action verification
- **Elite Blade Squad actions**: Monomolecular Sword (Close, 6 SP, Melee/Deadly/Multi-Attack(2)), Portable Comms Unit, Electro Grappling Hook -- all match PDF
- **Elite Beam Squad actions**: Beta Fission Gun (Long, 9 SP, Burn(2)/Energy/Explosive(1)/Multi-Attack(2)), Portable Comms Unit, Night Vision Optics -- all match PDF
- **Drone Squadron actions**: Red Laser (Medium, 4 SP, Energy/Hot(1)/Multi-Attack(2)), Hover Locomotion System -- all match PDF

---

### EQUIPMENT (pages 301-338)

#### 7. Portable Comms Unit -- page number
- **JSON page**: 301
- **PDF index**: "Portable Communications Unit, 81" -- the actual equipment entry is on page 81
- **PDF page 301**: The name "Portable Comms Unit" appears as part of squad stat blocks, not as a standalone equipment entry
- **Issue**: Page 301 is where squads reference this equipment, not where the equipment itself is defined. The page should likely be 81.
- **Severity**: Medium (page number mismatch)

#### 8. Electro Grappling Hook -- page number
- **JSON page**: 301
- **PDF index**: "Electro Grappling Hook, 84" -- the actual equipment entry is on page 84
- **PDF page 301**: Appears only as part of Elite Blade Squad stat block
- **Issue**: Page should likely be 84, not 301.
- **Severity**: Medium (page number mismatch)

#### 9. Monomolecular Sword -- page number
- **JSON page**: 301
- **PDF index**: "Monomolecular Sword, 85" -- the actual equipment entry is on page 85
- **PDF page 301**: Appears only as part of Elite Blade Squad stat block
- **Issue**: Page should likely be 85, not 301.
- **Severity**: Medium (page number mismatch)

#### 10. Pistol -- page number
- **JSON page**: 314
- **PDF index**: "Pistol, 81" -- the actual equipment entry with stats is on page 81
- **PDF page 314**: The word "Pistol" may appear in the NPC stat blocks (Tex has "Six Shooter Pistol", Artemis has "Red Laser Pistol") but the generic Pistol equipment is on page 81.
- **Issue**: Page should likely be 81, not 314.
- **Severity**: Medium (page number mismatch)

#### 11. Green Laser Rifle -- page number
- **JSON page**: 313
- **PDF index**: "Green Laser Rifle, 82" -- the equipment entry is defined on page 82 in the Pilot Equipment section
- **PDF page 313**: Baines NPC is described with "Green Laser Rifle" on page 313, but this is the NPC stat block, not the equipment definition.
- **Issue**: Page should likely be 82, not 313.
- **Severity**: Medium (page number mismatch)

#### 12. Reactive Armour -- page number
- **JSON page**: 333
- **PDF index**: "Reactive Armour, 83" -- the equipment entry is on page 83
- **PDF page 333**: Page 333 is index content only.
- **Issue**: Page should likely be 83, not 333.
- **Severity**: Medium (page number mismatch)

---

### ABILITIES (pages 301-338)

#### 13. Can't Stop, Won't Stop -- page number
- **JSON page**: 328
- **PDF index**: "Can't Stop, Won't Stop, 42" -- the ability entry is on page 42 (Advanced Hauler tree)
- **PDF page 328**: Page 328 is index content only.
- **Issue**: Page should likely be 42, not 328.
- **Severity**: Medium (page number mismatch)

#### 14. Camo Suit (ability) -- page number
- **JSON page**: 328
- **PDF index**: "Camo Suit, 51" -- the ability entry is on page 51 (Advanced Scout tree)
- **PDF page 328**: Page 328 is index content only.
- **Issue**: Page should likely be 51, not 328. Note: the Camo Suit ability already has a sibling entry at page 51 in abilities.json (line 566-572 shows `"page": 328`). Wait -- looking again, the ability entry for Camo Suit has `"page": 328` in the JSON. The PDF index says "Camo Suit, 51". The ability definition is on page 51.
- **Severity**: Medium (page number mismatch)

#### 15. Knife Missile (ability) -- page number
- **JSON page**: 331
- **PDF index**: "Knife Missile, 73" -- the ability entry is on page 73 (Legendary Smuggler tree)
- **PDF page 331**: Page 331 is index content only.
- **Issue**: Page should likely be 73, not 331.
- **Severity**: Medium (page number mismatch)

---

### KEYWORDS (pages 301-338)

All keywords in this page range were compared word-for-word against the PDF "Keywords and Traits" section (pages 321-326) and the Traits section (pages 318-321).

#### 16. Keyword "ability points" -- page number
- **JSON page**: 327
- **PDF**: "Ability Points" keyword appears on page 321 in the Keywords section
- **PDF page 327**: Page 327 is index content only
- **Issue**: Page should likely be 321, not 327.
- **Severity**: Medium (page number mismatch)

#### 17. Keyword "advanced tree" -- page and content
- **JSON page**: 321
- **PDF**: "Advanced Tree" appears on page 321 in the Keywords section
- **JSON content**: Matches PDF content. Both describe advancing into the Advanced Tree after taking 6 Core Abilities including all 3 linked to the Advanced Tree.
- **Status**: Page MATCH, content MATCH

#### 18. Keyword "hit points" -- page number
- **JSON page**: 323
- **PDF**: "Hit Points" appears on page 323 in the Keywords section
- **Status**: Page MATCH
- **JSON content**: "How resilient your Pilot, a creature, or a person is. When your Pilot is reduced to 0 HP they must roll on the Critical Injury Table. NPCs typically die at 0 HP. Any attack that deals SP damage deals 2x that amount to anything that has a Hit Point value."
- **PDF content**: "How resilient your Pilot, a creature, or a person is. When your Pilot is reduced to 0 HP they must roll on the Critical Injury Table. NPCs typically die at 0 HP. Any attack that deals SP damage deals 2x that amount to anything that has a Hit Point value."
- **Status**: Content MATCH

#### 19. Keyword "immobile" -- page number
- **JSON page**: 319
- **PDF**: "Immobile" trait appears on page 319
- **Status**: Page MATCH, content MATCH

#### 20. Keyword "setback" -- page number
- **JSON page**: 320
- **PDF**: "Setback" does not appear on page 320 (which is the bottom of the Traits section with Uses, Unwieldy, Vulnerable, Wield). "Setback" appears on page 325 in the Keywords section.
- **Issue**: Page should likely be 325, not 320.
- **Severity**: Medium (page number mismatch)

#### 21. Keyword "severe environmental effects" -- page and content
- **JSON page**: 325
- **PDF**: Appears on page 325 in Keywords section
- **Status**: Page MATCH
- **JSON content**: "Severe environmental effects include extreme heat and cold, solar storms, firestorms, hailstorms, tsunamis, acid rain, hurricanes and tornadoes."
- **PDF content**: "Severe environmental effects include extreme heat and cold, solar storms, firestorms, hailstorms, tsunamis, acid rain, hurricanes and tornadoes."
- **Status**: Content MATCH

#### 22. Keyword "shutdown"
- **JSON page**: 324
- **PDF**: "Shutdown" does not appear on page 324. Page 324 has Module/Module Slots/Morale/Mount-Dismount/Move/Operable/Passive/People/Pilot/Pilot Equipment/Prone. "Shutdown" appears on page 326.
- **Issue**: Page should likely be 326, not 324.
- **Severity**: Medium (page number mismatch)

#### 23. Keyword "mount / dismount"
- **JSON page**: 324
- **PDF**: "Mount / Dismount" appears on page 324
- **Status**: Page MATCH, content MATCH

#### 24. Keyword "move"
- **JSON page**: 324
- **PDF**: "Move" appears on page 324
- **Status**: Page MATCH, content MATCH

#### 25. Keyword "vulnerable"
- **JSON page**: 326
- **PDF**: "Vulnerable" appears on page 321 in the Traits section (page 321, top of the page before Keywords begin)
- **Issue**: The trait "Vulnerable" is on page 321. The JSON has page 326.
- **Severity**: Medium (page number mismatch)

#### 26. Keyword "intact"
- **JSON page**: 338
- **PDF**: "Intact" appears on page 323 in the Keywords section
- **PDF page 338**: Page 338 contains the Critical Damage Table and Critical Injury Table
- **Issue**: Page should likely be 323, not 338.
- **Severity**: Medium (page number mismatch)

#### 27. Keyword "turrets"
- **JSON page**: 335
- **PDF**: "Turrets" appears on page 326 in the Keywords section
- **PDF page 335**: Page 335 is index content only
- **Issue**: Page should likely be 326, not 335.
- **Severity**: Medium (page number mismatch)

#### 28. Keyword "downtime action"
- **JSON page**: 329
- **PDF**: "Downtime Action" appears on page 322 in the Keywords section
- **PDF page 329**: Page 329 is index content only
- **Issue**: Page should likely be 322, not 329.
- **Severity**: Medium (page number mismatch)

---

### ROLL TABLES (pages 301-338)

#### 29. Critical Injury table -- page and content
- **JSON page**: 323
- **PDF**: Critical Injury Table appears on page 338 (the orange reference tables at the back)
- **Issue**: The Critical Injury Table is on page 338, not 323. Page 323 is the Keywords section that mentions "Critical Injury Table" in the Hit Points keyword, but the table itself is on page 338.
- **Severity**: Medium (page number mismatch)

**Content comparison**:
- **20 (Miraculous Survival)**: JSON "You survive against the odds. You have 1 HP, remain conscious and can act normally." PDF: "Miraculous Survival: You survive against the odds. You have 1 HP, remain conscious and can act normally." -- MATCH
- **11-19 (Unconscious)**: JSON: "You are stable at 0 HP, but unconscious and cannot move or take actions until you gain at least 1 HP. You will regain consciousness naturally in 1 hour and get back up with 1 HP." PDF: "Unconscious: You are stable at 0 HP, but unconscious and cannot move or take actions until you gain at least 1 HP. You will regain consciousness naturally in 1 hour and get back up with 1 HP." -- MATCH
- **6-10 (Minor Injury)**: JSON: "You suffer a Minor Injury such as a sprain, burns, or minor concussion. Your Max HP is reduced by 1 until healed in a Tech 3-4 Med Bay. In addition, you are Unconscious. Apply the result of 11-19." PDF: "Minor Injury: You suffer a Minor Injury such as a sprain, burns, or minor concussion. Your Max HP is reduced by 1 until healed in a Tech 3 - 4 Med Bay. In addition, you are Unconscious. Apply the result of 11 - 19." -- MATCH (whitespace difference around dashes only)
- **2-5 (Major Injury)**: JSON: "You suffer a Major Injury such as permanent scarring, broken ribs, or internal injuries. Your Max HP is reduced by 2 until healed in a Tech 5-6 Med Bay. In addition, you are Unconscious. Apply the result of 11-19." PDF: "Major Injury: You suffer a Major Injury such as permanent scarring, broken ribs, or internal injuries. Your Max HP is reduced by 2 until healed in a Tech 5 - 6 Med Bay. In addition, you are Unconscious. Apply the result of 11-19." -- MATCH
- **1 (Fatal Injury)**: JSON: "Your Pilot suffers a fatal injury and dies." PDF: "Fatal Injury: Your Pilot suffers a fatal injury and dies." -- MATCH

#### 30. Group Initiative table -- page and content
- **JSON page**: 330
- **PDF**: Group Initiative Table appears on page 337 (the orange reference tables)
- **PDF index**: "Group Initiative, 235-236" -- it first appears on page 235-236, and the reference table is on page 337
- **Issue**: Page 330 is index content. The table is on page 337 (reference) or pages 235-236 (first appearance).
- **Severity**: Medium (page number mismatch)

**Content comparison** (against PDF page 337):
- **20 (You Shot First)**: JSON: "Two Pilots chosen by the players act first. Play then passes to the NPC group and one NPC chosen by the Mediator acts next." PDF: "You Shot First: Two Pilots chosen by the players act first. Play then passes to the NPC group and one NPC chosen by the Mediator acts next." -- MATCH
- **11-19 (Quickdraw)**: JSON: "One Pilot chosen by the players acts first. Play then passes to the NPC group and one NPC chosen by the Mediator acts." PDF: "Quickdraw: One Pilot chosen by the players acts first. Play then passes to the NPC group and one NPC chosen by the Mediator acts." -- MATCH
- **6-10 (Wait and See)**: JSON: "One NPC chosen by the players acts first. Play then passes to the player group and one Pilot chosen by the players acts." PDF: "Wait and See: One NPC chosen by the Mediator acts first. Play then passes to the player group and one Pilot chosen by the players acts."
- **DISCREPANCY**: JSON says "One NPC chosen by the **players** acts first" but PDF says "One NPC chosen by the **Mediator** acts first."
- **Severity**: High (gameplay-affecting text error)

- **2-5 (Fumble)**: JSON: "One NPC chosen by the Mediator acts first. Play then passes to the player group and one Pilot chosen by the players acts." PDF: "Fumble: One NPC chosen by the Mediator acts first. Play then passes to the player group and one Pilot chosen by the players acts." -- MATCH
- **1 (Ambush)**: JSON: "Two NPCs chosen by the Mediator act first. Play then passes to the player group and one Pilot is chosen by the players to act next." PDF: "Ambush: Two NPCs chosen by the Mediator act first. Play then passes to the player group and one Pilot is chosen by the players to act next." -- MATCH

#### 31. NPC Action table -- page and content
- **JSON page**: 336
- **PDF**: NPC Action Table appears on page 336
- **Status**: Page MATCH

**Content comparison**:
- **20 (Nailed It)**: JSON: "The NPC succeeds spectacularly at their action. They get an additional bonus of the Mediator's choice. If they are making an attack, they hit, and do double damage or get another bonus of the Mediator's choice." PDF: "Nailed It: The NPC succeeds spectacularly at their action. They get an additional bonus of the Mediator's choice. If they are making an attack, they hit, and do double damage or get another bonus of the Mediator's choice." -- MATCH
- **11-19 (Success)**: JSON: "The NPC achieves their action successfully. An attack hits and deals standard damage." PDF: "Success: The NPC achieves their action successfully. An attack hits and deals standard damage." -- MATCH
- **6-10 (Tough Choice)**: JSON: "The NPC is successful, but faces a Tough Choice. The players give the Mediator a choice between two Setbacks. In combat, a weapon attack hits, but with a choice of Setback chosen by the players." PDF: "Tough Choice: The NPC is successful, but faces a Tough Choice. The players give the Mediator a choice between two Setbacks. In combat, a weapon attack hits, but with a choice of Setback chosen by the players." -- MATCH
- **2-5 (Failure)**: JSON: "The NPC has failed at their action. The players choose an appropriate Setback for failure. In combat, a weapon attack misses." PDF: "Failure: The NPC has failed at their action. The players choose an appropriate Setback for failure. In combat, a weapon attack misses." -- MATCH
- **1 (Cascade Failure)**: JSON: "The NPC has catastrophically failed at their action. They suffer a Severe Setback of the player's choice. A weapon attack misses, with a Severe Setback chosen by the players." PDF: "Cascade Failure: The NPC has catastrophically failed at their action. They suffer a Severe Setback of the player's choice. A weapon attack misses, with a Severe Setback chosen by the players." -- MATCH

#### 32. Pilot Appearance table -- page number
- **JSON page**: 332
- **PDF index**: "Pilot Appearance Table, 91" -- the table is on page 91
- **PDF page 332**: Page 332 is index content only
- **Issue**: Page should likely be 91, not 332.
- **Severity**: Medium (page number mismatch)

#### 33. Knife Missile roll table -- page and content
- **JSON page**: 331
- **PDF index**: "Knife Missile, 73" -- the Knife Missile ability and its table are on page 73
- **PDF page 331**: Page 331 is index content only
- **Issue**: Page should likely be 73, not 331.
- **Severity**: Medium (page number mismatch)

#### 34. Critical Damage table -- page and content
- **JSON page**: 338
- **PDF**: Critical Damage Table appears on page 338
- **Status**: Page MATCH

**Content comparison**:
- **20 (Miraculous Survival)**: JSON: "Your Mech is somehow Intact. It has 1 SP and is still fully operational. Your Pilot is unharmed." PDF: "Miraculous Survival: Your Mech is somehow Intact. It has 1 SP and is still fully operational. Your Pilot is unharmed." -- MATCH
- **11-19 (Core Damage)**: JSON: "Your Mech Chassis is damaged and inoperable until repaired. All mounted Systems and Modules remain Intact. Your Pilot is reduced to 0 HP unless they have some means to escape the Mech." PDF: "Core Damage: Your Mech Chassis is damaged and inoperable until repaired. All mounted Systems and Modules remain Intact. Your Pilot is reduced to 0 HP unless they have some means to escape the Mech." -- MATCH
- **6-10 (Module Destruction)**: JSON: "A Module mounted on your Mech is destroyed. This is chosen by the Mediator or at random. Your Mech Chassis is damaged and inoperable until repaired. Your Pilot is unharmed." PDF: "Module Destruction: A Module mounted on your Mech is destroyed. This is chosen by the Mediator or at random. Your Mech Chassis is damaged and inoperable until repaired. Your Pilot is unharmed." -- MATCH
- **2-5 (System Destruction)**: JSON: "A System mounted on your Mech is destroyed. This is chosen by the Mediator or at random. Your Mech Chassis is damaged and inoperable until repaired. Your Pilot is unharmed." PDF: "System Destruction: A System mounted on your Mech is destroyed. This is chosen by the Mediator or at random. Your Mech Chassis is damaged and inoperable until repaired. Your Pilot is unharmed." -- MATCH
- **1 (Catastrophic Damage)**: JSON: "The Mech, as well as any mounted Systems and Modules as well as all Cargo, is destroyed. Your Pilot dies unless they have a means to escape the Mech." PDF: "Catastrophic Damage: The Mech, as well as any mounted Systems and Modules as well as all Cargo, is destroyed. Your Pilot dies unless they have a means to escape the Mech." -- MATCH

---

### TRAITS (pages 318-321)

#### 35. Trait "anti-organic"
- **JSON page**: 318
- **PDF**: "Anti-Organic" appears on page 318
- **JSON content**: "An anti-organic weapon deals 2x damage to People, creatures, and Bio-Titans."
- **PDF content**: "An anti-organic weapon deals 2x damage to People, creatures, and Bio-Titans."
- **Status**: Page MATCH, content MATCH

#### 36. Trait "immobile"
- **JSON page**: 319 (in traits.json)
- **PDF**: "Immobile" trait appears on page 319
- **Status**: Page MATCH, content MATCH

#### 37. Trait "ballistic"
- **JSON page**: 84 (outside page range, not reviewed)

---

## Summary

### High Severity
| # | Entity | File | Issue |
|---|--------|------|-------|
| 30 | Group Initiative (6-10 Wait and See) | roll-tables.json | JSON says "chosen by the **players**" but PDF says "chosen by the **Mediator**" -- gameplay-affecting |

### Medium Severity (Page Number Mismatches)
| # | Entity | File | JSON Page | Likely Correct Page |
|---|--------|------|-----------|-------------------|
| 2 | Elite Blade Squad | squads.json | N/A | asset_url filename says "elite beam squad" instead of "elite blade squad" |
| 7 | Portable Comms Unit | equipment.json | 301 | 81 |
| 8 | Electro Grappling Hook | equipment.json | 301 | 84 |
| 9 | Monomolecular Sword | equipment.json | 301 | 85 |
| 10 | Pistol | equipment.json | 314 | 81 |
| 11 | Green Laser Rifle | equipment.json | 313 | 82 |
| 12 | Reactive Armour | equipment.json | 333 | 83 |
| 13 | Can't Stop, Won't Stop | abilities.json | 328 | 42 |
| 14 | Camo Suit | abilities.json | 328 | 51 |
| 15 | Knife Missile | abilities.json | 331 | 73 |
| 16 | ability points | keywords.json | 327 | 321 |
| 20 | setback | keywords.json | 320 | 325 |
| 22 | shutdown | keywords.json | 324 | 326 |
| 25 | vulnerable | keywords.json | 326 | 321 |
| 26 | intact | keywords.json | 338 | 323 |
| 27 | turrets | keywords.json | 335 | 326 |
| 28 | downtime action | keywords.json | 329 | 322 |
| 29 | Critical Injury | roll-tables.json | 323 | 338 |
| 30 | Group Initiative | roll-tables.json | 330 | 337 |
| 32 | Pilot Appearance | roll-tables.json | 332 | 91 |
| 33 | Knife Missile | roll-tables.json | 331 | 73 |

### Observations

1. **Systematic page number issue**: A large number of entities in this batch have incorrect page numbers. Many point to index pages (327-335) rather than the actual content pages. This suggests these may have been assigned page numbers from the index rather than from the actual content location. Some keywords point to index pages rather than their definitions in the Keywords section (pages 321-326).

2. **Equipment page numbers**: Several equipment items (Portable Comms Unit, Electro Grappling Hook, Monomolecular Sword) have page 301 which is where squads reference them, not where the equipment is actually defined (pages 80-87).

3. **Content accuracy is high**: Where content was compared word-for-word, it was almost entirely accurate. The one significant text discrepancy is the Group Initiative table's 6-10 result.

4. **All squad stat blocks are accurate**: HP values, damage types, action traits, and descriptive text all match the PDF precisely.
