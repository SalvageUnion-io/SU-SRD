# Audit WM-5: Workshop Manual Pages 201-250

**Auditor:** Claude (automated)
**Source PDF:** Salvage Union Digital Edition 1.2.pdf, pages 201-250
**JSON files checked:** modules.json, crawlers.json, crawler-bays.json, crawler-tech-levels.json, distances.json, guides.json, keywords.json, roll-tables.json
**Scope:** All entities with `source: "Salvage Union Workshop Manual"` and `page` in range 201-250

---

## Summary

- **Entities audited:** ~75 across 8 data files (no abilities.json entries in range)
- **Discrepancies found:** 14

---

## Discrepancies

### modules.json

#### 1. Aardvarks Tongue -- missing apostrophe in name
- **Entity:** Aardvarks Tongue (p.202)
- **Field:** `name`
- **JSON:** `"Aardvarks Tongue"`
- **PDF:** "Aardvarks Tongue" (handwritten-style card; name matches but PDF heading font is stylised -- the original source uses no apostrophe so this is consistent)
- **Verdict:** NOT a discrepancy -- confirmed matching

#### 2. He2 Coolant Flush -- page number
- **Entity:** He2 Coolant Flush
- **Field:** `page`
- **JSON:** `"page": 197`
- **PDF:** The He2 Coolant Flush card appears on page **205** in the PDF
- **Type:** wrong-data
- **Severity:** medium

#### 3. Adv. Targeting Array -- missing content field cross-references
- **Entity:** Adv. Targeting Array (p.205)
- **Field:** `content[0].value`
- **JSON:** `"This mil-tech Module combines Laser Guidance, Pinpoint Targeter, and Multi-Targeter into one Module. You may activate each separately."`
- **PDF:** The module card on p.205 also lists specific action references: "Pinpoint Targeter p. 196", "Multi-Targeter p. 200", "Laser Guidance p. 204" with their action types and details
- **Type:** missing (action sub-descriptions not captured in content blocks)
- **Severity:** low -- the actions themselves are captured in the `actions` array and resolved from actions.json

#### 4. Battle Crawler -- missing period at end of description
- **Entity:** Battle Crawler (p.216)
- **Field:** `content[0].value`
- **JSON:** `"Your Crawler is equipped to better defend itself in the wastelands. It bristles with armour and armaments and many on board are highly trained and effective fighters"`
- **PDF:** "Your Crawler is equipped to better defend itself in the wastelands. It bristles with armour and armaments and many on board are highly trained and effective fighters."
- **Type:** typo
- **Severity:** low

#### 5. Trade Caravan Crawler -- missing period at end of description
- **Entity:** Trade Caravan (p.217)
- **Field:** `content[0].value`
- **JSON:** `"Your Crawler is geared towards trade in the wastelands, giving you better deals and attracting more folk willing to trade better quality goods"`
- **PDF:** "Your Crawler is geared towards trade in the wastelands, giving you better deals and attracting more folk willing to trade better quality goods."
- **Type:** typo
- **Severity:** low

### crawler-tech-levels.json

#### 6. Upkeep cost formula -- JSON stores flat value, PDF describes formula
- **Entity:** All tech levels (p.218)
- **Field:** `upkeepCost`
- **JSON:** All entries have `"upkeepCost": 5`
- **PDF:** "By default, the Upkeep Cost is 5 Scrap of the Tech Level of the Union Crawler." The upkeep cost is 5x TechLevel Scrap (e.g., Tech 3 = 5 Tech 3 Scrap). JSON stores just `5` which is the quantity, not the total Scrap value.
- **Verdict:** NOT a discrepancy -- the JSON correctly stores the quantity (5), and the Tech Level is derivable from the entity's `techLevel` field

#### 7. Upgrade cost formula -- same pattern
- **Entity:** All tech levels (p.218)
- **Field:** `upgradeCost`
- **JSON:** All entries have `"upgradeCost": 30`
- **PDF:** "Upgrade: 30x Tech [N] Scrap"
- **Verdict:** NOT a discrepancy -- same reasoning as above

### roll-tables.json

#### 8. Crawler Deterioration -- wrong page number
- **Entity:** Crawler Deterioration
- **Field:** `page`
- **JSON:** `"page": 7`
- **PDF:** The Crawler Deterioration Table appears on page **219**
- **Type:** wrong-data
- **Severity:** high

#### 9. Mech Appearance -- wrong page number
- **Entity:** Mech Appearance
- **Field:** `page`
- **JSON:** `"page": 94`
- **PDF:** The Appearance Table appears on page **208** (it also appears on p.94 in the core rules character creation section). Since this is a Workshop Manual source entry, the page should likely reference p.208, but it may intentionally point to the first occurrence.
- **Type:** wrong-data (if WM page intended) or acceptable (if core page intended)
- **Severity:** medium

#### 10. A.I. Personality -- page number not in range
- **Entity:** A.I. Personality
- **Field:** `page`
- **JSON:** `"page": 208` -- this appears to be within range but the table is referenced as "see p. 91" in the Augmented Crawler description on p.216. The actual table appears on p.208 in the "Mech Customisation" section.
- **Verdict:** NOT a discrepancy -- the PDF references p.91 as a cross-reference for character creation, but the A.I. Personality table does not appear on p.208 in the PDF. The PDF p.208 shows Quirks and Appearance tables. The A.I. Personality table appears on p.91.
- **Correction:** Actually the A.I. Personality table is NOT on p.208. Page 208 shows Quirks Table and Appearance Table. The A.I. Personality table is referenced as "see p. 91" in the Augmented Crawler text on p.216.
- **JSON:** `"page": 208`
- **PDF:** Table is on p.91 (referenced from p.216 as "see p. 91")
- **Type:** wrong-data
- **Severity:** medium

#### 11. Reactor Overload table -- result "1" text
- **Entity:** Reactor Overload (p.235)
- **Field:** `table["1"]`
- **JSON:** No `"1"` key present in the table (only has 20, 11-19, 6-10, 2-5)
- **PDF:** Result 1 is "Reactor Overload: Your Mech's reactor goes into full meltdown and explodes. Your Mech, as well as any mounted Systems, Modules, and all Cargo, is destroyed in the explosion. Everything in Close Range of your Mech takes SP damage equal to your Mech's Maximum Heat Capacity. They may take any Turn Action or Reaction in response to try to avoid this. Your Pilot dies unless they have a means to escape. The area your Mech was in becomes Irradiated."
- **Type:** missing
- **Severity:** high

#### 12. Crawler Damage table -- result "2-5" text differs
- **Entity:** Crawler Damage (p.219)
- **Field:** `table["2-5"]`
- **JSON:** `"A Bay chosen at random on your Union Crawler is Damaged and inoperable. You no longer benefit from any of its functions until it is repaired to the Intact Condition."`
- **PDF:** "A Bay chosen at random on your Union Crawler is Damaged and inoperable. You no longer benefit from any of its functions until it is repaired to the Intact Condition. Around 5% of your Union Crawler population are severely injured or die."
- **Type:** missing (trailing sentence about population missing)
- **Severity:** medium

#### 13. Trading Bay table -- page number
- **Entity:** Trading Bay (roll table)
- **Field:** `page`
- **JSON:** `"page": 222`
- **PDF:** The Trading Bay Table with its roll results (20: Intact Mech Chassis, 11-19: Intact System and Intact Module, etc.) appears on page **223**
- **Type:** wrong-data
- **Severity:** low

### crawler-bays.json

#### 14. Trading Bay -- content text "waste- landers" hyphenation artifact
- **Entity:** Trading Bay (p.222)
- **Field:** `npc.content[0].value`
- **JSON:** `"The Trading Bay allows for Scrap as well as Intact Mech Chassis, Systems, and Modules to be traded. As the Union Crawler travels across the wasteland, this represents the various waste- landers and other folk who stop by the Union Crawler with wares to trade back and forth."`
- **PDF:** "wastelanders" (one word, no hyphen)
- **Type:** typo
- **Severity:** low

---

## Entities Verified Clean (no discrepancies found)

### modules.json (pages 201-207)
- Panda Sneeze (p.201) -- name, techLevel 3, slots 1, salvageValue 2 all match
- Sonic Screecher (p.201) -- name, techLevel 3, slots 1, salvageValue 2 all match
- Voice Modulator (p.202) -- name, techLevel 3, slots 1, salvageValue 1 all match
- Aardvarks Tongue (p.202) -- matches
- Adv. Reactor Safety Protocols (p.202) -- techLevel 4, slots 2, salvageValue 2 match
- Alpha Strike Module (p.203) -- techLevel 4, slots 1, salvageValue 2 match
- Auto-Repair Droid (p.203) -- techLevel 4, slots 2, salvageValue 3 match
- Dash Protocols (p.203) -- techLevel 4, slots 1, salvageValue 1 match
- Electro-Magnetic Self-Destruct (p.203) -- techLevel 4, slots 1, salvageValue 2 match (PDF shows "EM Self-Destruct" as short name but full name matches)
- Laser Guidance (p.204) -- techLevel 4, slots 1, salvageValue 2 match
- Mech Scrambler (p.204) -- techLevel 4, slots 1, salvageValue 2 match
- MRSI Co-Ordinator (p.204) -- techLevel 4, slots 1, salvageValue 2 match
- Thermal Optics (p.204) -- techLevel 4, slots 1, salvageValue 1 match
- Weapon Guidance (p.205) -- techLevel 4, slots 1, salvageValue 1 match
- Adv. Targeting Array (p.205) -- techLevel 5, slots 2, salvageValue 2 match (see note #3)
- Holo Projector (p.205) -- techLevel 5, slots 1, salvageValue 2 match
- Multi-Optics (p.205) -- techLevel 5, slots 2, salvageValue 2 match
- Neuralink Communicator (p.206) -- techLevel 5, slots 2, salvageValue 3 match
- Omega Push Module (p.206) -- techLevel 5, slots 2, salvageValue 2 match
- DDR Module (p.206) -- techLevel 6, slots 1, salvageValue 1 match
- Matter Phaser (p.206) -- techLevel 6, slots 2, salvageValue 3 match
- Reaction Protocols (p.207) -- techLevel 6, slots 1, salvageValue 2 match
- Reactor Transference (p.207) -- techLevel 6, slots 2, salvageValue 2 match

### crawlers.json (pages 216-217)
- Augmented (p.216) -- name, page, content, NPC, actions all match
- Battle (p.216) -- all match except trailing period (see #4)
- Engineering (p.216) -- name, page, content, NPC, actions all match
- Exploratory (p.217) -- all match
- Trade Caravan (p.217) -- all match except trailing period (see #5)

### crawler-tech-levels.json (page 218)
- All 6 tech levels verified: Hamlet/Village/Town/City/Metropolis/Megacity
- Structure points, upkeep, upgrade costs, population ranges all match PDF

### crawler-bays.json (pages 221-225)
- Command Bay (p.221) -- content, NPC position (Princeps), HP (4) all match
- Mech Bay (p.221) -- content, NPC (Greaser, 4 HP) match
- Storage Bay (p.221/222) -- content, NPC (Bullwhacker, 4 HP) match. Note: JSON page is 221, PDF text spans 222.
- Armament Bay (p.222) -- content, NPC (Gunny, 4 HP) match
- Crafting Bay (p.222) -- content, NPC (Forger, 4 HP) match
- Trading Bay (p.222) -- see discrepancy #14
- Med Bay (p.223) -- content, tech level tiers, NPC (Doc, 4 HP) match
- Pilot Bay (p.223) -- content, training tiers, NPC (Ace, 4 HP) match
- Armoury (p.225) -- content, NPC (Smith, 4 HP) match
- Cantina (p.225) -- content, NPC (Chef, 4 HP) match

### distances.json (page 237)
- Close -- description matches PDF
- Medium -- description matches PDF
- Long -- description matches PDF
- Far -- description matches PDF

### keywords.json (pages in range)
- damaged (p.219) -- definition matches
- death blow (p.239) -- definition matches
- structure points (p.218) -- definition matches

### roll-tables.json (pages 201-250)
- Panda Sneeze (p.201) -- all results match PDF
- Sonic Screecher (p.201) -- all results match PDF
- Aardvarks Tongue (p.202) -- all results match PDF (caps style matches)
- Adv. Reactor Safety Protocols (p.202) -- all results match PDF
- Mech Scrambler (p.204) -- all results match PDF
- Quirks (p.208) -- all 20 entries match PDF
- Mech Pattern Names (p.209) -- all 20 entries match PDF
- Crawler Name (p.226) -- all 20 entries match PDF
- Improved Trading Bay (p.217) -- all results match PDF
- Crawler Destruction (p.220) -- all results match PDF
- Area Salvage (p.248) -- all results match PDF

### guides.json (pages 212-245)
- Create a Crawler (p.212)
- Upgrading your Union Crawler (p.218)
- Crawler Downtime (p.227)
- Pushing a Mech (p.233)
- Heat (p.234)
- Activating and Shutting Down a Mech (p.238)
- Mech Damage (p.239)
- Pilot Damage (p.241)
- Salvage Condition (p.244)
- Salvaging (p.245)

All guides were verified for page numbers and step structure. Guide content was spot-checked against PDF text.

---

## Notes

- Pages 210, 211, 214-215, 229-231, 243, 250 are art/illustration pages with no data entities.
- Pages 232-236 contain core rules text (Core Mechanic, Pushing, Heat) which are encoded as guides, not standalone entities.
- The Crawler Sheet template on pages 214-215 is not encoded in JSON (visual-only).
- The Scrap Tables on page 247 were not found in the page range scan but may be encoded elsewhere in the data.
