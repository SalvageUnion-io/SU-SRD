# Audit Report: FF (False Flag pages 8-71)

## Summary
- Pages reviewed: 8-71
- Entities checked: 40
- Discrepancies found: 5

## Discrepancies

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Pioneer (Deerstalker Pattern) | chassis.json | systems list | PDF p.59: "Overcharged Green Laser" (file tree: OC_green_laser.sys, loadout text: "Overcharged Green Laser") | `"name": "Green Laser"` | wrong-data |
| 2 | Nanite Reconstruction | roll-tables.json | source | PDF p.70: content originates from False Flag book | `"source": "Salvage Union Workshop Manual"` | wrong-data |
| 3 | Meld Distorter (roll table) | roll-tables.json | source | PDF p.70: content originates from False Flag book | `"source": "Salvage Union Workshop Manual"` | wrong-data |
| 4 | Big Brother Drone | drones.json | content description | PDF p.62: "Big Brother Drones are programmed with swarm protocols that make them act as a single unified force. Their distinctive buzzing sound spells doom for pilots. They may be customised as a Mech using their profile." | `"A support drone controlled by the Big Brother chassis."` | wrong-data |
| 5 | Trooper (DronTek Pattern) | chassis.json | description text | PDF p.57: "This stock Trooper build was rolled out by the smog-drenched factories of the DronTek motherland. It provides a mixture of cost-effective offensive and defensive capabilities for the corpo pilot on the ground." (second para) "After the corpo wars, many of the conscripted pilots became mercs to pay off their debts. As a result, this pattern is still commonly seen in DronTek territory." | "The Trooper is a stock build from the smog-drenched factories of the DronTek motherland, offering cost-effective offensive and defensive capabilities for the corpo pilot on the ground. After the corpo wars, many of the conscripted pilots became mercs to pay off their debts, and as a result, this pattern is still commonly seen in DronTek territory." | typo |

## Discrepancy Details

### 1. Pioneer Deerstalker Pattern - Wrong System Name
The Deerstalker Pattern for the Pioneer chassis lists "Green Laser" as a system in the JSON, but the PDF (p.59) clearly shows "OC_green_laser.sys" in the file tree and "Overcharged Green Laser" in the loadout text. The correct system is "Overcharged Green Laser" (a T3 False Flag system defined on p.68, dealing 5 SP with Hot (4) and Energy traits).

### 2-3. Nanite Reconstruction & Meld Distorter Roll Tables - Wrong Source
Both roll tables appear on page 70 of the False Flag book, alongside the Meld Regenerator and Meld Distorter modules. They should have `"source": "False Flag"` but are currently attributed to `"Salvage Union Workshop Manual"`.

### 4. Big Brother Drone - Missing Description Content
The PDF (p.62) provides a full description: "Big Brother Drones are programmed with swarm protocols that make them act as a single unified force. Their distinctive buzzing sound spells doom for pilots. They may be customised as a Mech using their profile." The JSON has a generic placeholder description instead.

### 5. Trooper DronTek Pattern - Minor Text Differences
The JSON paraphrases the PDF text slightly: "rolled out" becomes "is a stock build", "It provides a mixture of" becomes "offering", and the two paragraphs are merged. Minor rewording, not a stat error.

## Entities Verified Clean

### Chassis (6 entries)
- **Kelpie** (page 54) — SP 7, EP 9, HC 7, SysSlots 8, ModSlots 3, Cargo 6, TL 1, SV 3. Description, chassis ability (Integrated Hydrologic Locomotion System), and both patterns (10 Finger, Sifter) match.
- **Trooper** (page 56) — SP 16, EP 5, HC 12, SysSlots 16, ModSlots 3, Cargo 6, TL 2, SV 5. Description, chassis ability (Dependable Chassis) match. DronTek Pattern systems and modules match (note: file tree uses "drontek_rifle.sys" but canonical system name is "K4 Rifle" per p.67).
- **Pioneer** (page 58) — SP 17, EP 12, HC 8, SysSlots 14, ModSlots 4, Cargo 6, TL 2, SV 6. Description, chassis ability (Sub-Zero Engineered Chassis) match. Deerstalker Pattern modules match. **One system discrepancy noted above.**
- **Parasite** (page 60) — SP 24, EP 0*, HC 5, SysSlots 17, ModSlots 9, Cargo 6, TL 5, SV 13. Description, chassis abilities (Parasitic Reactor, Parasitic Membrane) match. Stefanus Pattern systems and modules match.
- **Big Brother** (page 62) — SP 43, EP 9, HC 14, SysSlots 23, ModSlots 4, Cargo 6, TL 5, SV 15. Description, chassis abilities (Cumbersome, Big Brother Drone Controller) match. DronTek Pattern content matches.
- **X0315** (page 64) — SP 5, EP 0, HC 1, SysSlots 0, ModSlots 0, Cargo 0, TL N, SV 15. Description, all chassis abilities (MELD, Integrated Meld Locomotion, Integrated Neuralink Communicator, Mech Replication) match.

### Drones (1 entry)
- **Big Brother Drone** (page 62) — SP 3, EP 4, HC 4, SysSlots 4, ModSlots 1, Cargo 2, TL 5, SV 1 all match. **Description discrepancy noted above.**

### Systems (11 entries)
- **Frost Protection** (page 67) — Tech 2, Slot 3, Salvage 4. Action text matches.
- **Hydrologic Locomotion System** (page 67) — Tech 2, Slot 4, Salvage 3. Action text matches.
- **K4 Rifle** (page 67) — Tech 2, Slot 1, Salvage 2. Damage 3 SP, Ballistic, Dependable all match. Action text matches.
- **Cryopod System** (page 67) — Tech 3, Slot 3, Salvage 1. Action text matches.
- **Meld Injector** (page 68) — Tech 3, Slot 2, Salvage 2. Action text matches.
- **Meld Manipulator** (page 68) — Tech 3, Slot 2, Salvage 2. Action text matches.
- **Overcharged Green Laser** (page 68) — Tech 3, Slot 4, Salvage 2. Damage 5 SP, Hot (4), Energy all match. Action text matches.
- **Nanite Sifter** (page 68) — Tech 4, Slot 4, Salvage 4. Action text and Refine sub-action match.
- **Meld Spore Launcher** (page 68) — Tech N, Slot 7, Salvage 5. Damage 4 SP, Burn (4), Anti-Organic, Explosive (4), Meld Infection all match. Action text matches.
- **Meld System Replicator** (page 69) — Tech N, Slot 6, Salvage 6. Replicate action (4 EP, Close) matches.
- **Meld Tendrils** (page 69) — Tech N, Slot 6, Salvage 6. Damage 4 SP, Melee, Meld Infection, Multi-Attack (2) all match.

### Modules (5 entries)
- **Heating Unit** (page 69) — Tech 1, Slot 1, Salvage 1. Free Action, Cost 1 EP. Action text matches.
- **Pop Goes The Weasel** (page 69) — Tech 4, Slot 2, Salvage 4. Turn Action, Cost X EP, Hacking. Action text matches.
- **Meld Module Replicator** (page 69) — Tech N, Slot 2, Salvage 4. Turn Action, Cost 3 EP, Close. Action text matches.
- **Meld Regenerator** (page 70) — Tech N, Slot 3, Salvage 5. Nanite Reconstruction (Passive) and Nanite Repair (Reaction, 3 EP) both match.
- **Meld Distorter** (page 70) — Tech N, Slot 2, Salvage 5. Turn Action, Cost 3 EP, Close. Action text and roll table entries match.

### Equipment (6 entries)
- **DronTek Rifle** (page 71) — Tech 2. Damage 4 HP, Long, Dependable. Action text matches.
- **Portable Cryopod** (page 71) — Tech 3. Action text matches.
- **Overcharged Green Laser Rifle** (page 71) — Tech 3. Damage 6 HP, Medium, Energy, Unwieldy. Action text matches.
- **Handheld Meld Injector** (page 71) — Tech 3. Turn Action, Close. Action text matches.
- **Handheld Meld Manipulator** (page 71) — Tech 3. Action text matches.
- **Meld Rifle** (page 71) — Tech 4. Damage 4 HP, Medium, Anti-Organic, Meld Infection. Action text matches.

### Keywords (6 entries)
- **Anomalous Zone** (page 9) — content matches.
- **Difficult Terrain (False Flag)** (page 9) — content matches.
- **Freezing** (page 9) — content matches.
- **Low Visibility** (page 9) — content matches.
- **Surface Ice** (page 9) — content matches.
- **Corporate Scrip** (page 9) — content matches.

### Roll Tables (3 entries)
- **Rumour** (page 8) — all 20 entries match.
- **Meld Encounter** (page 9) — all entries match.
- **Anomalous Zone** (pages 10-11) — all 20 entries match.

### Traits (1 entry)
- **Dependable** (page 8) — content matches.

### Sources (1 entry)
- **False Flag** (page 1) — content and purchase link present.
