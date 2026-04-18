# Audit: "We Were Here First!" Entries

**Date:** 2026-03-10
**Source PDF:** `rules/We Were Here First Digital Edition 1.1.pdf`
**Scope:** All entries across all data files where `source === "We Were Here First!"`

## Summary

| Data File | Entries | Issues |
|-----------|---------|--------|
| sources.json | 1 | 0 |
| keywords.json | 3 | 0 |
| equipment.json | 4 | 0 |
| systems.json | 8 | 0 |
| modules.json | 4 | 0 |
| bio-titans.json | 1 | 0 |
| npcs.json | 3 | 1 |
| roll-tables.json | 9 | 2 |
| chassis.json | 6 chassis + 3 WWFH patterns on core chassis | 5 |
| factions.json | 10 | 5 |
| **Total** | **49+** | **13** |

**Verdict:** 13 issues found — 3 critical (content mismatch), 4 medium (missing formation members), 6 low (attribution gaps, dead keys, minor formatting).

---

## Issues

### Critical — Content Mismatch

#### C1. Alpha Pattern Impaler — wrong system name
- **File:** `chassis.json:4457`
- **PDF p.76:** Systems list includes "Energy Shield"
- **Data:** `"name": "Refractive Shield Projector"`
- **Note:** No "Energy Shield" system exists in systems.json. The system "Refractive Shield Projector" (core book, p.167) does exist. Either the PDF uses a simplified/alternate name or this is a data error. Needs manual ruling.
- **Action:** Verify with SU Workshop Manual whether "Energy Shield" and "Refractive Shield Projector" are the same system. If so, leave data as-is (uses canonical name). If not, the pattern data needs correction.

#### C2. SAKURA 78TH LANCE MSD — description/goals swap
- **File:** `factions.json:51`
- **PDF p.15 description:** "A professional and discreet wet work team on a black ops assignment to Gehenna. Led by Lance Leader 'Moto' (Ace)."
- **PDF p.15 goals preamble:** "Fed with information from a Stefanus data auction, they know about the Red Mesa Facility and BOLZA Encampments in the area. Their objectives are: ..."
- **Data content:** `"A high-tech lance operating in Gehenna with detailed information about the area and its inhabitants. Fed with information from a Stefanus data auction, they know about the Red Mesa Facility and BOLZA Encampments in the area."` — this is the goals preamble, not the description.
- **Data goals:** Missing the preamble about the Stefanus data auction.
- **Fix:** Set content to the PDF description text. Prepend goals with the Stefanus data auction preamble.

#### C3. Salvage Cache Table entry 5 — missing chassis name
- **File:** `roll-tables.json:1298`
- **PDF p.23:** "An Acid Spitter Mule (p.76)"
- **Data:** `"An Acid Spitter"` — missing "Mule"
- **Fix:** Change to `"An Acid Spitter Mule"`

### Medium — Missing Formation Members

#### M1. Trash Locusts formation — missing Rotorcraft
- **File:** `factions.json:221-242`
- **PDF p.16 formation includes:** "Rotorcraft (1x Raider Band inside) (p.293 & 300 SU Core Book)"
- **Data:** Formation has 3 entries (Throne Atlas, Buzzard Mazona x2, Fighting Box Wheel x4). Missing the Rotorcraft with Raider Band.
- **Fix:** Add formation entry for Rotorcraft with Raider Band. This may require a `schema: "vehicles"` reference and a note about the contained Raider Band.

#### M2. Chimerium Cult formation — missing Waster Mob
- **File:** `factions.json:258-278`
- **PDF p.17 formation includes:** "Waster Mob x 2 (p.300 SU Core Book)"
- **Data:** Formation has 3 entries. Missing Waster Mob x 2.
- **Fix:** Add formation entry for Waster Mob (quantity: 2, schema: "npcs", source: "Salvage Union Workshop Manual", page: 300).

#### M3. Red Mesa Mutants formation — missing Chimerium Mutant Mob
- **File:** `factions.json:294-313`
- **PDF p.18 formation includes:** "Chimerium Mutant Mob (p.60)"
- **Data:** Formation has 3 entries. Missing Chimerium Mutant Mob.
- **Fix:** Add formation entry for Chimerium Mutant Mob (source: "We Were Here First!", page: 60).

#### M4. Wagon Wasters formation — missing Waster Mob
- **File:** `factions.json:98-123`
- **PDF p.21 formation includes:** "Waster Mob x 2 (p.300 SU Core Book)"
- **Data:** Formation has 4 entries. Missing Waster Mob x 2.
- **Fix:** Add formation entry for Waster Mob (quantity: 2, schema: "npcs", source: "Salvage Union Workshop Manual", page: 300).

### Low — Attribution / Dead Keys / Formatting

#### L1. Mutant Pattern (Thresher) — no WWFH source attribution
- **File:** `chassis.json:702-731` (on Thresher, a core book chassis)
- **Issue:** Pattern has no `source` or `page` fields. This is a WWFH pattern (p.76) on a core book chassis.
- **Fix:** Add `"source": "We Were Here First!", "page": 76` to the pattern object.

#### L2. Acid Spitter Pattern (Mule) — no WWFH source attribution
- **File:** `chassis.json:124-153` (on Mule, a core book chassis)
- **Issue:** Pattern has no `source` or `page` fields. This is a WWFH pattern (p.76) on a core book chassis.
- **Fix:** Add `"source": "We Were Here First!", "page": 76` to the pattern object.

#### L3. Chimerium Harvester Pattern (Thresher) — no WWFH source attribution + empty content
- **File:** `chassis.json:678-701` (on Thresher, a core book chassis)
- **Issue:** Pattern has no `source` or `page` fields. This is a WWFH pattern (p.76) on a core book chassis. Also has `"content": []` (empty array).
- **Fix:** Add `"source": "We Were Here First!", "page": 76`. Remove empty `content` array or leave as-is (schema allows it).

#### L4. Experimental Bio Pattern (Impaler) — empty content array
- **File:** `chassis.json:4540`
- **Issue:** `"content": []` — empty array. PDF p.76 also has no description for this pattern, so no content is correct, but the empty array is a dead key.
- **Fix:** Remove `"content": []` or leave as-is (cosmetic).

#### L5. Chimerium Mutant Squad — empty content array
- **File:** `npcs.json:132`
- **Issue:** `"content": []` — empty array. PDF p.54 has no description text for the squad entry, so no content is correct, but the empty array is a dead key.
- **Fix:** Remove `"content": []` or leave as-is (cosmetic).

#### L6. Chimerium Mutation table entry 13 — malformed label/value split
- **File:** `roll-tables.json:435-436`
- **Issue:** Entry 13 uses `label`/`value` split where all other entries (1-12, 14-20) use `value` only. The label contains flavor text ending with "Range" and the value starts with "Close //".
- **Data:**
  ```json
  "13": {
    "label": "Your jaw distends and stretches out into a maw. Your teeth grow jagged. You can make a Bite attack. Range",
    "value": "Close // Damage: 3 HP // Deadly (Non-Bio-Titan Creatures only) // Melee"
  }
  ```
- **Fix:** Merge into a single `value` field: `"Your jaw distends and stretches out into a maw. Your teeth grow jagged. You can make a Bite attack. Range: Close // Damage: 3 HP // Deadly (Non-Bio-Titan Creatures only) // Melee"`

---

## Informational Notes (No Action Required)

#### I1. Wolf Z' Traders — Aegis annotation
- **PDF p.20:** "Escort Pattern Aegis with Napalm Launcher (p.139 & 72 SU Core Book)"
- **Data:** `"chassis": "Aegis", "pattern": "Escort", "page": 139`
- The "with Napalm Launcher" annotation and secondary page reference (p.72) are flavor context in the PDF but not structured data fields. No fix needed unless a `notes` field is desired on formation entries.

#### I2. Harvesting Chimerium — minor wording normalization
- **PDF p.9:** "Some factions may pay x 2 as much as this or more"
- **Data:** "Some factions may offer double this value or more."
- Semantically equivalent. Likely intentional normalization during data entry.

#### I3. PDF uses "Loudspeaker" (singular) in some places vs "Loudspeakers" (plural) in data
- The system is canonically named "Loudspeakers" in systems.json. PDF sometimes uses singular. Data is correct.

#### I4. Salvage Cache Table page references
- PDF includes parenthetical page references (e.g., "(p.74)") in table values. Data omits these. This is consistent with how other roll tables are encoded — page refs are metadata, not content.

---

## Verified Entries (No Issues)

### sources.json
| Entry | Page | Status |
|-------|------|--------|
| We Were Here First! | 1 | PASS — purchaseLink present, content matches |

### keywords.json
| Entry | Page | Status |
|-------|------|--------|
| bio-system | 60 | PASS |
| bio-module | 60 | PASS |
| bio-chassis | 60 | PASS |

### equipment.json
| Entry | TL | Page | Status |
|-------|-----|------|--------|
| Chimerium Salvaging Tools | 1 | 63 | PASS |
| Bio-Scanner | 1 | 63 | PASS |
| Bio-Rifle | 3 | 63 | PASS |
| Chimerium Beast Companion | 4 | 63 | PASS |

### systems.json
| Entry | TL | Slots | SV | Page | Status |
|-------|-----|-------|-----|------|--------|
| Super-Sonic Screecher | B | 5 | 12 | 74 | PASS |
| EDG Alpha | B | 5 | 16 | 74 | PASS |
| Bio-Talon | B | 4 | 6 | 74 | PASS |
| Acid Cannon | B | 7 | 20 | 74 | PASS |
| Bio-Wings | B | 6 | 25 | 74 | PASS |
| Bio-Maw | B | 6 | 24 | 74 | PASS |
| Chimerium Harvester | 3 | 3 | 2 | 74 | PASS |
| Mutated Locomotion System | B | 3 | 4 | 75 | PASS |

### modules.json
| Entry | TL | Slots | SV | Page | Status |
|-------|-----|-------|-----|------|--------|
| Adrenal Glands | B | 1 | 7 | 75 | PASS |
| Chimerium Cell | 2 | 1 | 1 | 75 | PASS |
| Regeneration Glands | B | 1 | 9 | 75 | PASS |
| Olfactory Glands | B | 1 | 6 | 75 | PASS |

### bio-titans.json
| Entry | SP | Page | Status |
|-------|-----|------|--------|
| Cortex Bio-Titan | 10 | 56 | PASS — 5 actions, content matches |

### npcs.json
| Entry | HP | Bio-SV | Page | Status |
|-------|-----|--------|------|--------|
| Chimerium Mutant | 5 | 1 | 54 | PASS |
| Chimerium Chosen | 8 | 2 | 54 | PASS |
| Chimerium Mutant Squad | 10 | 2 | 54 | L5 (empty content[]) |

### chassis.json
| Entry | SP | EP | HC | SS | MS | CS | TL | SV | Page | Status |
|-------|-----|-----|-----|-----|-----|-----|-----|-----|------|--------|
| Impaler | 26 | 7 | 15 | 15 | 3 | 6 | 3 | 6 | 64 | C1 (Alpha pattern shield) |
| Fleshripper | 50 | 10 | 16 | 26 | 4 | 6 | B | 50 | 67 | PASS |
| Stormterror | 30 | 12 | 14 | 20 | 4 | 6 | B | 30 | 68 | PASS |
| Cranium Bio-Mech | 18 | 16 | 10 | 14 | 5 | 6 | B | 18 | 70 | PASS |
| Scuttler | 14 | 10 | 13 | 16 | 3 | 6 | B | 14 | 72 | PASS |
| Atlas (Throne pattern only) | — | — | — | — | — | — | — | — | 47 | PASS |

### Patterns on WWFH chassis
| Pattern | Chassis | Page | Status |
|---------|---------|------|--------|
| Alpha | Impaler | 76 | C1 — Energy Shield vs Refractive Shield Projector |
| Delta | Impaler | 76 | PASS |
| Experimental Bio | Impaler | 76 | L4 (empty content[]) |
| Maw | Fleshripper | 77 | PASS |
| Screecher | Stormterror | 77 | PASS |
| Probe | Cranium Bio-Mech | 77 | PASS |
| Harvester | Scuttler | 77 | PASS |
| Throne | Atlas | 47 | PASS |

### Patterns on core book chassis (WWFH content)
| Pattern | Chassis | PDF Page | Status |
|---------|---------|----------|--------|
| Mutant | Thresher | 76 | L1 — missing source/page |
| Acid Spitter | Mule | 76 | L2 — missing source/page |
| Chimerium Harvester | Thresher | 76 | L3 — missing source/page + empty content[] |

### roll-tables.json
| Entry | Type | Page | Status |
|-------|------|------|--------|
| Meteor Encounter | standard | 9 | PASS |
| Harvesting Chimerium | standard | 9 | PASS (I2 wording note) |
| Chimerium Exposure | standard | 10 | PASS |
| Chimerium Mutation | flat | 11 | L6 (entry 13 label/value split) |
| Faction Encounter Table | duos | 22 | PASS |
| Salvage Cache Table | flat | 23 | C3 (entry 5 missing "Mule") |
| Chimerium Mutant Ability Table | duos | 59 | PASS |
| Bio-Chassis Damage Table | bio-chassis | 78 | PASS |
| Bio-Chassis Overload Table | bio-chassis | 79 | PASS |

### factions.json
| Entry | Page | Status |
|-------|------|--------|
| BOLZA Corp 1st Lance | 12 | PASS |
| BOLZA Corp 2nd Lance | 13 | PASS |
| BOLZA Logistics Corps | 14 | PASS |
| SAKURA 78TH LANCE MSD | 15 | C2 (description/goals swap) |
| Trash Locusts | 16 | M1 (missing Rotorcraft) |
| Chimerium Cult | 17 | M2 (missing Waster Mob) |
| Red Mesa Mutants | 18 | M3 (missing Chimerium Mutant Mob) |
| Crawler #693 Salvagers | 19 | PASS |
| Wolf Z' Traders | 20 | PASS (I1 annotation note) |
| Wagon Wasters | 21 | M4 (missing Waster Mob) |
