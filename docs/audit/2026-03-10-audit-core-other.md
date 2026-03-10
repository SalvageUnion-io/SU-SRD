# Audit: Core Other Entities (Non-Combat)

**Date:** 2026-03-10
**Scope:** All non-combat core book data files from "Salvage Union Workshop Manual" source
**Method:** Cross-referenced JSON data against PDF rulebook (Salvage Union Digital Edition 1.2) page-by-page, plus back-of-book index (pp.327-332)
**Excludes:** Entries sourced from "We Were Here First!", "Rainmaker", or "False Flag" (audited separately)

---

## Summary

- **20 data files** audited
- **~30 wrong page numbers** found (detailed below)
- **0 content accuracy errors** found in verified entries
- **0 dead/purposeless keys** found
- **Field completeness** is good across all files

---

## Wrong Page Numbers

### Critical — High-Impact Tables

These are core mechanic tables referenced frequently during play:

| File | Entry | Current Page | Correct Page | Evidence |
|------|-------|-------------|-------------|----------|
| roll-tables.json | Core Mechanic | 2 | 232 | p.2 is back cover; index says "Cascade Failure, 232", "Core Rules, 232-242" |
| roll-tables.json | Group Initiative | 330 | 236 | Verified on p.236; index says "Group Initiative Table, 236" |
| roll-tables.json | Critical Injury | 323 | 241 | Verified on p.241; index says "Critical Injury Table, 241" |
| roll-tables.json | Critical Damage | 338 | 240 | Verified on p.239-240; index says "Critical Damable Table, 240" |
| roll-tables.json | NPC Action | 336 | 267 | Verified on p.267; index says "NPC Actions, 267" |
| roll-tables.json | Reactor Overload | 235 | 235 | ✅ Correct |

### Moderate — Combat/Encounter Tables

| File | Entry | Current Page | Correct Page | Evidence |
|------|-------|-------------|-------------|----------|
| roll-tables.json | Morale | 167 | 268 | p.167 is Mini Mortar/Rigging Arm; verified Morale on p.268; index says "Morale, 268" |
| roll-tables.json | Retreat | 42 | 268 | p.42 is Advanced Hauler abilities; verified Retreat on p.268-269 |
| roll-tables.json | Mech Salvage | 2 | 248 | p.2 is back cover; verified Mech Salvage on p.248; index says "Mech Salvage Ability, 248" |
| roll-tables.json | Crawler Deterioration | 7 | 219 | p.7 is TOC; verified on p.219; index says "Crawler Deterioration Table, 219" |

### Moderate — Character Creation Tables

| File | Entry | Current Page | Correct Page | Evidence |
|------|-------|-------------|-------------|----------|
| roll-tables.json | Keepsake | 24 | 90 | p.24 is Pilot Sheet; index says "Keepsake Table, 90" |
| roll-tables.json | Motto | 24 | 90 | p.24 is Pilot Sheet; index says "Motto Table, 90" |
| roll-tables.json | Pilot Appearance | 332 | 91 | p.332 is book index; index says "Pilot Appearance Table, 91" |
| roll-tables.json | Mech Appearance | 94 | 208 | p.94 is Mech Workshop guide; index says "Mech Appearance Table, 208" |

### Moderate — Entity Page Numbers

| File | Entry | Current Page | Correct Page | Evidence |
|------|-------|-------------|-------------|----------|
| creatures.json | Artl | 266 | 296 | p.266 is Denizens of the Wasteland overview; verified Artl on p.296 |
| creatures.json | Chimeripede | 272 | 296 | p.272 is encounter tables; verified Chimeripede on p.296 |
| creatures.json | Molebear | 266 | 297 | p.266 is overview text; verified Molebear on p.297 |
| creatures.json | Carrion Bird | 266 | 297 | p.266 is overview text; verified Carrion Bird on p.297 |
| meld.json | Meld Splitter | 270 | 289 | p.270 is encounter tables; verified Meld Splitter on p.289 |
| squads.json | Machine Gun Squad | 274 | 300 | Verified on p.300; index says "Machine Gun Squad, 300" |
| squads.json | Wasteland Herd | 270 | 301 | Verified on p.301 |
| npcs.json | Trooper | 274 | 298 | Verified all People on p.298; index says "People, 266, 298" |

### Low — Tech Levels

| File | Entry | Current Page | Correct Page | Evidence |
|------|-------|-------------|-------------|----------|
| tech-levels.json | Tech 1 | 1 | 162 | p.1 is cover page; p.162 has "TECH 1" header in systems index |
| tech-levels.json | Tech 2 | 1 | 162 | Same as above; "TECH 2" header on p.162 |
| tech-levels.json | Tech 3 | 1 | 162 | Same; "TECH 3" on p.162 |
| tech-levels.json | Tech 4 | 1 | 163 | "TECH 4" header on p.163 |
| tech-levels.json | Tech 5 | 1 | 163 | "TECH 5" header on p.163 |
| tech-levels.json | Tech 6 | 1 | 163 | "TECH 6" header on p.163 |

> **Note:** The per-level prose descriptions in tech-levels.json (e.g., "Basic industrial equipment, simple mechanisms...") do not appear verbatim on pp.162-163 or anywhere else I could find in the PDF. They may have been authored for the data file. The closest relevant pages are p.96 ("Mech Stats Explained" mentions 6 Tech Levels) and pp.162-163 (systems index headers). Recommend using p.162 as the canonical page reference since that's where the tech level categories are presented.

### Unverified — Suspicious Pages

These entries have page numbers in the 8-11 range (intro/credits area) that could not be verified:

| File | Entry | Current Page | Notes |
|------|-------|-------------|-------|
| roll-tables.json | Meteor Encounter | 9 | pp.8-11 are typically intro material |
| roll-tables.json | Harvesting Chimerium | 9 | Same concern |
| roll-tables.json | Chimerium Exposure | 10 | Same concern |
| roll-tables.json | Chimerium Mutation | 11 | Same concern |
| roll-tables.json | Rumour | 8 | Same concern |
| roll-tables.json | Meld Encounter | 9 | Same concern |
| roll-tables.json | Anomalous Zone | 10 | Same concern |
| roll-tables.json | Faction Encounter Table | 22 | p.22 is Pilot Classes diagram |
| roll-tables.json | Salvage Cache Table | 23 | p.23 is Gaining Abilities |

> These may be from a specific adventure/supplement section within the Workshop Manual, or the page numbers may be wrong. Recommend manual verification.

---

## Confirmed Correct Pages

### distances.json (4 entries)
All entries page 237 ✅ — Verified distances (Close/Medium/Long/Far) match PDF exactly.

### crawler-tech-levels.json (6 entries)
All entries page 218 ✅ — SP values (20-50), upkeep (5×TL), upgrade costs (30×TL), and population ranges all match PDF.

### crawlers.json (5 core entries)
Pages 216-217 ✅ — Augmented, Battle, Engineering, Exploratory, Trade Caravan all present with correct abilities and NPCs.

### crawler-bays.json (10 entries)
Pages 221-225 ✅ — Command Bay (221), Mech Bay (221), Storage Bay (222), Crafting Bay (222), Armament Bay (222), Trading Bay (222-223), Med Bay (223), Pilot Bay (223), Armoury (225), Cantina (225). NPC positions and damaged effects verified.

### bio-titans.json (6 core entries)
All pages correct ✅:
- Scylla p.276 (39 SP), Typhon p.278 (67 SP), Chrysalis p.280 (80 SP)
- Phantom p.282 (54 SP), Electrophorus p.284 (96 SP), Tyrant p.286 (215 SP)
- All action lists, SP values, and content descriptions match PDF exactly.

### creatures.json (6 core entries — 4 wrong pages noted above)
- Irradiated Scorpion p.296 ✅ (4 HP, Stinger action)
- Wasteland Bear p.297 ✅ (5 HP, Bear Carnage action)
- Artl, Chimeripede, Molebear, Carrion Bird — content correct but pages wrong (see above)

### meld.json (5 core entries — 1 wrong page noted above)
- Meld Drone p.289 ✅ (3 HP, salvageValue 1)
- Meld Drone Swarm p.289 ✅ (6 HP, salvageValue 3)
- Meld Nanoid p.289 ✅ (5 SP, salvageValue 5, Fast trait)
- Meld Behemoth p.290 ✅ (60 SP, Behemoth Tendrils + Assimilation + Titanic Actions)
- Meld Splitter — content correct but page wrong (see above)

### roll-tables.json (verified correct entries)
- Reactor Overload p.235 ✅, Area Salvage p.248 ✅
- Crawler Damage p.219 ✅, Crawler Destruction p.220 ✅, Crawler Name p.226 ✅
- Background p.89 ✅, Callsign Table p.88 ✅
- Mechapult p.166 ✅, A.I. Personality p.208 ✅, Quirks p.208 ✅
- Mech Pattern Names p.209 ✅, Reaction Roll p.268 ✅

### guides.json (verified entries)
- Safety Protocols p.12 ✅ — Content matches (Boundaries, Off Camera, Stop Sign sections)
- Create a Pilot p.18 ✅ — Steps match (Stats, Class/Ability, Equipment, Callsign, Background, Motto, Appearance, Keepsake)
- Create a Mech p.94 ✅ — Steps match (Gain Scrap, Craft Chassis, Note Stats, Craft Systems, Craft Modules, Choose Quirk, Describe Appearance, Give Name)

### classes.json
- Engineer p.26 ✅ — Verified class description and ability tree

### npcs.json (6 core entries — 1 wrong page noted above)
- All People on p.298 ✅: Wastelander (2 HP), Raider (3 HP), Trooper (5 HP), Veteran (9 HP), Combat Pilot (10 HP), Ace (16 HP)

### squads.json (9 core entries — 2 wrong pages noted above)
- Most entries p.300-301 ✅

### vehicles.json (7 entries)
All pages 292-293 ✅

### drones.json (10 core entries)
Starting at p.294 ✅

---

## Content Accuracy

All verified entries have **accurate content**:
- Bio-titan Structure Points match exactly (Scylla 39, Typhon 67, Chrysalis 80, Phantom 54, Electrophorus 96, Tyrant 215)
- Creature Hit Points match (Irradiated Scorpion 4, Artl 2, Chimeripede 10, Wasteland Bear 5, Molebear 12, Carrion Bird 3)
- Meld HP/SP and salvageValues match (Drone 3HP/1, Swarm 6HP/3, Nanoid 5SP/5, Splitter 10SP/10, Behemoth 60SP)
- NPC Hit Points match (Wastelander 2, Raider 3, Trooper 5, Veteran 9, Combat Pilot 10, Ace 16)
- Crawler tech level stats match (SP, upkeep, upgrade costs, population ranges)
- Roll table values match PDF exactly for all verified tables
- Action/ability lists match PDF for all verified entities
- Content paragraphs match PDF text closely
- Trait assignments match PDF (Artl: Burrower, Molebear: Burrower, Carrion Bird: Fly, Meld Nanoid: Fast)

---

## Field Completeness

All files have appropriate fields populated:
- **BaseEntity fields** (id, name, source, page): Present on all entities ✅
- **content blocks**: Present where entities have descriptions ✅
- **asset_url**: Present on some entities (not required) ✅
- **Entity-specific fields**: structurePoints (bio-titans, meld SP-types), hitPoints (creatures, meld HP-types, npcs), salvageValue (meld), actions, traits — all present where applicable ✅

No missing required fields detected.

---

## Dead Keys / Purposeless Fields

No dead or purposeless keys found across any audited files.

**Special files (no page field, by design):**
- `catalog-categories.json` — 6 UI meta entries (Chassis, Modules, Systems, Equipment, Bio-Chassis, Drones). App-level categories, not game data.
- `ability-tree-requirements.json` — 20 entries mapping class tree prerequisites. Derived relationship data.

---

## Files Fully Skipped (Other Agent Scope)

- `factions.json` — ALL entries from "We Were Here First!" source
- Non-core entries in: bio-titans.json, creatures.json, squads.json, npcs.json, drones.json, roll-tables.json, keywords.json, traits.json

---

## Recommendations

1. **Fix the ~30 wrong page numbers** listed above — these are the most impactful data quality issues found.
2. **Verify the 9 "suspicious pages"** (pp.8-11, 22, 23) manually — these may be from adventure content or may be incorrect.
3. **Decide on tech-levels.json page** — p.162 (systems index) is the best candidate, but the per-level descriptions may be editorial additions not directly from the PDF.
4. **Consider adding a `pageEnd` field** — some entities span multiple pages (e.g., Retreat p.268-269, encounter tables p.270-273). Currently only the start page is recorded.
