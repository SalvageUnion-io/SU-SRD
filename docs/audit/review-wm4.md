# Review WM-4: Workshop Manual Pages 151-200

**Reviewer:** reviewer-wm4
**Source PDF:** Salvage Union Digital Edition 1.2, pages 151-200
**Data directory:** `packages/salvageunion-reference/data/`
**Scope:** 4 chassis, 96 systems, 38 modules, 1 ability, 3 keywords, 12 traits, 19 roll tables

---

## Discrepancies Found

### CRITICAL: Missing Action Fields

#### 1. Eggs Mayhem action missing all stat fields
- **File:** `actions.json`, action "Eggs Mayhem"
- **PDF (p190):** 2EP, Turn Action, Range: Medium, Hacking trait
- **JSON:** No `activationCost`, no `actionType`, no `range`, no `traits`
- **Impact:** Action is missing cost (2), type (Turn), range (Medium), and Hacking trait

#### 2. Needle Missile Pod action missing Uses(30) trait
- **File:** `actions.json`, action "Needle Missile Pod"
- **PDF (p180):** Range: Long, Damage: 1 SP, Guided, Targeter, Uses (30)
- **JSON:** Has Guided, Targeter but missing `{"type": "uses", "amount": 30}`

#### 3. Missile Pod action missing Uses(6) trait
- **File:** `actions.json`, action "Missile Pod"
- **PDF (p175):** Range: Long, Damage: 8 SP, Explosive (2), Hot (1), Missile, Uses (6)
- **JSON traits:** Explosive(2), Hot(1), Missile -- missing `{"type": "uses", "amount": 6}`

#### 4. Refractive Shield Projector action missing activationCost
- **File:** `actions.json`, action "Refractive Shield Projector"
- **PDF (p171):** 2EP, Reaction, Range: Close, Shield
- **JSON:** No `activationCost` field; should be `2`

#### 5. Electro-Magnetic Shield Projector action missing activationCost
- **File:** `actions.json`, action "Electro-Magnetic Shield Projector"
- **PDF (p174):** 2EP, Reaction, Range: Close, Shield
- **JSON:** No `activationCost` field; should be `2`

#### 6. Shield Dome action missing activationCost
- **File:** `actions.json`, action "Shield Dome"
- **PDF (p180):** XEP, Turn Action, Range: Close, Shield
- **JSON:** No `activationCost` field; should be `"X"` or equivalent

#### 7. Laser Anti-Missile System action missing activationCost
- **File:** `actions.json`, action "Laser Anti-Missile System"
- **PDF (p179):** 1EP, Reaction
- **JSON:** No `activationCost` field; should be `1`

#### 8. Multi-Targeter action missing activationCost
- **File:** `actions.json`, action "Multi-Targeter"
- **PDF (p200):** XEP, Turn Action, Targeter
- **JSON:** No `activationCost` field; should be `"X"` or equivalent

### MEDIUM: Wrong Action Names

#### 9. Metal Detector second action named "Coolant Flush" instead of "Active Scan"
- **File:** `actions.json` and `modules.json`
- **PDF (p195):** Metal Detector has two sub-actions: "Auto-Scan" (Passive) and "Active Scan" (2EP, Short Action, Range: Medium, Scanner)
- **JSON module actions:** `["Auto-Scan", "Coolant Flush", "Metal Detector"]`
- **JSON action "Coolant Flush":** Has correct stats (activationCost=2, Short, Medium, Scanner) but wrong name
- **Fix:** Rename the action from "Coolant Flush" to "Active Scan" and update the reference in modules.json

### MEDIUM: Missing Traits

#### 10. Evasion Protocols action missing Hot(2) trait
- **File:** `actions.json`, action "Evasion Protocols"
- **PDF (p194):** Reaction // Heat Spike // Hot (2)
- **JSON traits:** `[{"type": "heat spike"}]` -- missing `{"type": "hot", "amount": 2}`

#### 11. Offensive Protocols action missing Hot(2) trait
- **File:** `actions.json`, action "Offensive Protocols"
- **PDF (p200):** Free Action // Heat Spike // Hot (2)
- **JSON traits:** `[{"type": "heat spike"}]` -- missing `{"type": "hot", "amount": 2}`

#### 12. Weapon Link action missing Hot(X) trait
- **File:** `actions.json`, action "Weapon Link"
- **PDF (p193):** Turn Action // Hot (X) // Heat Spike
- **JSON traits:** `[{"type": "heat spike"}]` -- missing `{"type": "hot", "amount": "X"}`

#### 13. Adv. Weapon Link action missing Hot(X) trait
- **File:** `actions.json`, action "Adv. Weapon Link"
- **PDF (p198):** Turn Action // Heat Spike // Hot (X)
- **JSON traits:** `[{"type": "heat spike"}]` -- missing `{"type": "hot", "amount": "X"}`

### LOW: Page Number Discrepancies

#### 14. Survey Scanner module wrong page number
- **File:** `modules.json`, "Survey Scanner"
- **PDF index (p188):** Survey Scanner - p. 192; content appears on p192
- **JSON:** `"page": 194`
- **Fix:** Should be `192`

#### 15. He2 Coolant Flush module wrong page number
- **File:** `modules.json`, "He2 Coolant Flush"
- **PDF index (p189):** He2 Coolant Flush - p. 205 (listed under Tech 5)
- **JSON:** `"page": 197`
- **Fix:** Should be `205`. This module should not be in the 151-200 page range at all.

---

## Verified Correct

### Chassis (4 entries)
All chassis stats verified correct against PDF:

| Chassis | SP | EP | Heat | Sys | Mod | Cargo | TL | SV | Page |
|---------|----|----|------|-----|-----|-------|----|----|------|
| Neura-Phage | 29 | 11 | 13 | 18 | 6 | 6 | 5 | 9 | 152 |
| Iron Wyrm | 46 | 15 | 19 | 24 | 5 | 6 | 6 | 17 | 154 |
| Leviathan | 76 | 14 | 18 | 36 | 6 | 6 | 6 | 20 | 156 |
| Shaitan | 21 | 20 | 14 | 15 | 10 | 6 | 6 | 6 | 158 |

Chassis abilities verified: Cybernetic Neuralink, Burrower, Juggernaut, Eradication Protocols, Heavily Armoured Chassis, Integrated VTU System, Flashy, Fast, Polycarbonate Stealth Chassis.

Pattern loadouts (systems and modules) verified correct with proper quantities (e.g., Destroyer Pattern: .50 Cal x6, Red Laser x3, 30mm Autocannon x2; Sapper Pattern: 30mm Autocannon x2; Evantis Pattern: 120mm Heavy Autocannon x2).

### Systems (96 entries)
All system tech levels, slots required, salvage values, and page numbers verified correct against PDF stat blocks and index pages (p162-163). System action traits (range, damage, trait lists) verified correct for all entries not listed in discrepancies above.

Notable verified items:
- Sandblaster: TL1, 3 slots, SV 2, page 167 (matches index)
- All repair arms (Riveting Gun, Welding Laser, Fabrication Arm, Adv. Fabrication Arm, Nanite Repair Arm): correct repair values per tech level
- Tesla Coils: 3 sub-actions (Tesla Arc, Tesla Charge, Tesla Shield) all correct
- Matter Phase Shield: Disintegrate and Shield sub-actions correct
- Experimental Particle Beam Cannon: damage 2d20, traits correct

### Modules (38 entries - excluding He2 Coolant Flush page issue)
All module tech levels, slots required, salvage values verified correct. Action types and costs verified for all modules not listed in discrepancies.

### Keywords (3 entries)
- "free action" (p165), "morale" (p167), "weapons system" (p184) -- all verified correct

### Traits (12 entries)
All trait definitions verified correct against PDF content.

### Abilities (1 entry)
- Ascension (p153, Legendary Cyborg, Level L) -- verified correct

### Roll Tables (19 entries)
Roll table entries spot-checked against PDF. Table structures match PDF content.

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 8 | Missing activationCost on 6 actions; missing Uses traits on 2 weapons |
| Medium | 4 | Wrong action name (Metal Detector); missing Hot traits on 3 actions |
| Low | 2 | Wrong page numbers on 2 modules |
| **Total** | **14** | |
