# Core Combat Data Audit

**Date:** 2026-03-10
**Source PDF:** Salvage Union Digital Edition 1.2
**Scope:** chassis.json, actions.json, systems.json, modules.json, equipment.json
**Auditor:** reference-auditor agent

---

## Summary

| File | Core Entries | Verified | Issues Found |
|------|-------------|----------|-------------|
| chassis.json | 30 (core rulebook) | 30/30 stat blocks | 1 pattern-level issue (2 sub-errors) |
| systems.json | 80 (core, pp.164-187) | 79/80 | 1 missing entry |
| modules.json | 57 (core, pp.190-207) | 55/57 | 2 wrong page refs, 1 possible wrong TL |
| equipment.json | 45 (core rulebook) | 45/45 | 0 |
| actions.json | 611 total | spot-checked | not fully audited (see notes) |

**Non-core entries** from Mech Monday, We Were Here First!, Rainmaker, and False Flag were not verified against their respective source PDFs in this audit. They appear structurally sound but page references cannot be confirmed without those books.

---

## Confirmed Issues

### 1. WRONG SYSTEM + MISSING MODULE -- Thresher Butcher Pattern (chassis.json)

**Location:** chassis.json, Thresher entry, Butcher Pattern
**PDF Reference:** Page 109

The Butcher Pattern has two errors:

**a) Wrong system: "Loudspeakers" should be "Escape Hatch"**

```
Current (WRONG):
  systems: ["Chainsaw Arm", "FM-3 Flamethrower", "Loudspeakers", "Locomotion System"]

Correct (per PDF p109):
  systems: ["Chainsaw Arm", "FM-3 Flamethrower", "Escape Hatch", "Locomotion System"]
```

**b) Missing module: "Comms Module"**

```
Current (INCOMPLETE):
  modules: ["Adv. Weapon Link"]

Correct (per PDF p109):
  modules: ["Comms Module", "Adv. Weapon Link"]
```

**Severity:** High -- affects character creation (wrong starting loadout for Butcher Pattern)

---

### 2. MISSING ENTRY -- Multi-Function Repair Arm (systems.json)

**PDF Reference:** Page 183, under TECH 5 heading

The Multi-Function Repair Arm is a Tech 5 system clearly shown on PDF page 183 between Mole Torpedo and Ion Cannon. It is completely absent from systems.json.

```
Expected entry:
  name: "Multi-Function Repair Arm"
  techLevel: 5
  slotsRequired: 3
  salvageValue: 3
  page: 183
  actions: [Patch, System Repair, Chassis Repair, "Multi-Function Repair Arm"]
```

PDF description: Developed by Stefanus to repair the intricate mechanisms within the Neura-Phage Chassis. Can fix up some of the most advanced tech in the wastes.

- Patch: Restore up to 8 SP (Turn Action, Range: Close)
- System Repair: Repair TL 1-5 System or Module (Short Action, Range: Close)
- Chassis Repair: Repair TL 1-5 Chassis or Vehicle (Long Action, Range: Close)

**Severity:** High -- entire system entry missing from the dataset. Actions for this system also likely missing from actions.json.

---

### 3. WRONG PAGE -- Survey Scanner (modules.json)

**Location:** modules.json, Survey Scanner entry
**JSON says:** page: 194
**PDF shows:** page 192 (right column, alongside Self-Destruct on the left)

Page 194 contains Deep Survey Scanner, Evasion Protocols, Hull Magnetiser, and Energy Cell -- not Survey Scanner.

**Severity:** Low -- affects page reference links only

---

### 4. WRONG PAGE -- He2 Coolant Flush (modules.json)

**Location:** modules.json, He2 Coolant Flush entry
**JSON says:** page: 197
**PDF shows:** page 205 (right column, under TECH 5 heading alongside Adv. Targeting Array)

Page 197 contains Reactor Safety Protocols, Sleeping Beauty, and Video Recording Array (all TL2) -- the He2 Coolant Flush is TL5 and not on that page.

**Severity:** Low -- affects page reference links only

---

### 5. POSSIBLE WRONG TECH LEVEL -- Aardvarks Tongue (modules.json)

**Location:** modules.json, Aardvarks Tongue entry
**JSON says:** techLevel: 3
**PDF shows:** placed under TECH 4 heading on page 202

The Aardvarks Tongue is a handwritten-style card on page 202. The Voice Modulator (TL3) appears at the top of the page, then the "TECH 4" header appears, and the Aardvarks Tongue appears below it alongside Advanced Reactor Safety Protocols (TL4). The card's tech level indicator appears to read T4.

**Severity:** Medium -- needs manual verification due to handwritten card style. If confirmed, affects tech level gating for this module.

---

## Verified Correct

### chassis.json (30 core rulebook chassis)

All 30 core chassis stat blocks verified against PDF pages 100-158:

| Chassis | Page | SP | EP | HC | SysSlots | ModSlots | Cargo | TL | SV | Status |
|---------|------|----|----|----|---------|---------|----|----|----|--------|
| Mule | 100 | 20 | 8 | 6 | 15 | 4 | 20 | 1 | 5 | OK |
| Mazona | 102 | 15 | 8 | 12 | 13 | 4 | 6 | 1 | 10 | OK |
| Scrapper | 104 | 10 | 4 | 6 | 7 | 3 | 4 | 1 | 4 | OK |
| Spectrum | 106 | 10 | 8 | 10 | 10 | 3 | 2 | 1 | 8 | OK |
| Thresher | 108 | 15 | 6 | 10 | 9 | 2 | 6 | 1 | 9 | OK (patterns: 1 issue) |
| Forge | 110 | 20 | 10 | 14 | 16 | 4 | 8 | 2 | 12 | OK |
| Gopher | 112 | 15 | 6 | 6 | 12 | 4 | 15 | 2 | 6 | OK |
| Hussar | 114 | 8 | 6 | 10 | 10 | 2 | 2 | 2 | 10 | OK |
| Jackhammer | 116 | 12 | 8 | 8 | 14 | 2 | 4 | 2 | 8 | OK |
| Kraken | 118 | 12 | 6 | 8 | 11 | 4 | 10 | 2 | 8 | OK |
| Magpie | 120 | 12 | 6 | 8 | 6 | 3 | 20 | 2 | 6 | OK |
| Mirrorball | 122 | 6 | 10 | 10 | 8 | 4 | 2 | 2 | 9 | OK |
| Atlas | 124 | 25 | 10 | 10 | 20 | 5 | 12 | 3 | 14 | OK |
| Brawler | 126 | 10 | 4 | 8 | 8 | 2 | 6 | 3 | 8 | OK |
| Little Sestra | 128 | 12 | 8 | 14 | 14 | 4 | 4 | 3 | 14 | OK |
| Mantis | 130 | 12 | 8 | 10 | 14 | 4 | 4 | 3 | 12 | OK |
| Photon | 132 | 8 | 12 | 14 | 10 | 4 | 2 | 3 | 13 | OK |
| Solo | 134 | 4 | 4 | 4 | 4 | 2 | 2 | 3 | 4 | OK |
| Terra | 136 | 12 | 8 | 8 | 12 | 4 | 12 | 3 | 10 | OK |
| Aegis | 138 | 20 | 10 | 12 | 14 | 4 | 4 | 4 | 16 | OK |
| Colossus | 140 | 30 | 12 | 12 | 25 | 6 | 20 | 4 | 18 | OK |
| Consul | 142 | 15 | 12 | 14 | 15 | 5 | 4 | 4 | 16 | OK |
| Drop Bear | 144 | 6 | 10 | 12 | 10 | 3 | 2 | 4 | 12 | OK |
| Vorpal | 146 | 10 | 8 | 12 | 10 | 3 | 2 | 4 | 14 | OK |
| Carrier | 148 | 15 | 8 | 10 | 10 | 4 | 30 | 5 | 15 | OK |
| Eidolon | 150 | 10 | 14 | 16 | 14 | 4 | 2 | 5 | 18 | OK |
| Neura-Phage | 152 | 12 | 12 | 14 | 14 | 4 | 4 | 5 | 20 | OK |
| Iron Wyrm | 154 | 30 | 6 | 8 | 20 | 4 | 20 | 6 | 20 | OK |
| Leviathan | 156 | 40 | 14 | 16 | 30 | 6 | 30 | 6 | 25 | OK |
| Shaitan | 158 | 15 | 14 | 16 | 14 | 5 | 2 | 6 | 22 | OK |

### systems.json (core rulebook, pp.164-187)

All core rulebook systems verified for name, tech level, slots required, salvage value, and page reference. Verified by tech level tier:

- **Tech 1** (pp.164-168): .50 Cal Machine Gun, Armour Plating, Cargo Pod, Escape Hatch, Chainsaw Arm, Floodlights, FM-3 Flamethrower, High Pressure Hose, Hydraulic Crusher, Locomotion System, Loudspeakers, Mechapult, Mini Mortar, Mining Rig, Red Laser, Rigging Arm, Transport Hold, Sandblaster, Riveting Gun -- all OK
- **Tech 2** (pp.168-172): Armoured Shield, 30mm Autocannon, Blue Mining Laser, Cargo Bay, Chaff Launcher, Dozer Blades, Grappling Harpoon, Green Laser, Heat Sink, High Gain Antenna, Industrial Body Kit, M2-X Mauler, Nanofibre Net Launcher, Module Switch, Personnel Transport Pod, Shotgun Pit, Smoke Machine, Refractive Shield Projector, Torpedo Tubes, Tracking Node, Welding Laser -- all OK
- **Tech 3** (pp.172-177): 120mm Cannon, Articulated Rigging Arm, Capacitance Bank, Composite Armour, Ejection System, AFF Coolant Foam, Electro-Magnetic Shield Projector, Fabrication Arm, Heavy Duty Mining Rig, Long Barrelled Green Laser, Mech Melee Armament, Missile Pod, Prawn Sifter, Rotary Minigun, Radiation Sealing, Rail Rifle, Red Pulse Laser, Smuggling Hold, Spider Locomotion System, Target Painter, Vectored Thrust Unit -- all OK
- **Tech 4** (pp.177-181): Adv. Fabrication Arm, Anti-Mech Mine Layer, Automated Weapon Turret, Aerosolised Nerve Gas Sprayer, CACB Laser, Corpo Body Kit, Electro-Magnetic Hardening, Grav Assisted Cargo Bay, Hover Locomotion System, Laser Anti-Missile System, Needle Missile Pod, Railgun, Shield Dome, Radomes, Snub-Nosed Blue Laser, Stabilising Locomotion System, Tesla Coils -- all OK
- **Tech 5** (pp.182-184): Amphibious Locomotion System, Blue Beam Laser, Ejector Pod, Fabrication Bay, Ion Cannon, Mole Torpedo, Plasma Cannon, Reflective Shielding, Monomolecular Blade, Multi-Phase Shield -- all OK. **Multi-Function Repair Arm MISSING** (see Issue #2)
- **Tech 6** (pp.185-187): 120mm Heavy Autocannon, Executive Body Kit, Experimental Particle Beam Cannon, Experimental Teleportation Hold, N15 Fat Boy, Matter Phase Shield, Nanite Repair Arm, Teleportation Pod -- all OK

Black market systems (p.71): Napalm Launcher, Rad Wave Generator -- present and structurally sound (page refs not PDF-verified).

### modules.json (core rulebook, pp.190-207)

All core rulebook modules verified for name, tech level, slots required, salvage value, and page reference:

- **Tech 1** (pp.190-193): Comms Module, Equipment Locker, Eggs Mayhem, Firewall, Personal Recreation Device, Reactor Flare, Self-Destruct, Survey Scanner (WRONG PAGE - see Issue #3), Weapon Link, Zoom Optics -- all OK except Survey Scanner page
- **Tech 2** (pp.193-197): Barometric Sensor, Damage Assessor, Energy Cell, Deep Survey Scanner, Evasion Protocols, Hull Magnetiser, IR Night Vision Optics, Metal Detector, M315 Motion Scanner, Navigation Module, Pinpoint Targeter, Reactor Overload, Video Projection Array, Sleeping Beauty, Reactor Safety Protocols, Video Recording Array -- all OK
- **Tech 3** (pp.198-202): Adv. Weapon Link, Auto-Doctor, Comms Tapper, Concealed Locker, Coolant Flow Manifold, ECM Transmitter, Emergency Power Conduit, Encrypted Comms, Hacking Repeater Node, Multi-Targeter, Offensive Protocols, Panda Sneeze, Sonic Screecher, Voice Modulator, Aardvarks Tongue (POSSIBLE WRONG TL - see Issue #5) -- all OK except possible Aardvarks Tongue TL
- **Tech 4** (pp.202-205): Adv. Reactor Safety Protocols, Alpha Strike Module, Auto-Repair Droid, Dash Protocols, Electro-Magnetic Self-Destruct, Laser Guidance, Mech Scrambler, MRSI Co-Ordinator, Thermal Optics, Weapon Guidance -- all OK
- **Tech 5** (pp.205-206): Adv. Targeting Array, Holo Projector, He2 Coolant Flush (WRONG PAGE - see Issue #4), Multi-Optics, Neuralink Communicator, Omega Push Module -- all OK except He2 page
- **Tech 6** (pp.206-207): DDR Module, Matter Phaser, Reaction Protocols, Reactor Transference -- all OK

Black market modules (p.71): Goflow Plant Growing System, Corrupted Neuralink Module -- present and structurally sound.

### equipment.json (core rulebook)

All 45 core rulebook equipment entries verified for name, tech level, and page reference. Equipment spans many pages (pp.30, 35, 47-48, 51, 68, 71, 73, 80-87, 127, 298, 301, 313-314, 333). All entries structurally sound with correct tech level assignments and action references.

---

## Not Fully Audited

### actions.json (611 entries)

Due to the volume (611 entries, 12,303 lines), actions.json was spot-checked rather than exhaustively audited. Action entries referenced by systems and modules were verified to exist. A full content audit of action text, damage values, activation costs, ranges, and traits against the PDF was not performed in this pass.

**Recommendation:** A dedicated actions audit should verify damage/range/cost/traits for the ~200 core rulebook weapon and ability actions.

### Non-core source entries

Entries from the following sources were checked for structural validity (schema compliance, well-formed JSON) but NOT verified against their respective PDFs:

- **We Were Here First!** -- systems (8), modules (4), equipment (4)
- **False Flag** -- systems (10), modules (5), equipment (6)
- **Rainmaker** -- systems (1), modules (1), equipment (5)
- **Mech Monday** -- various chassis entries

---

## Fix Priority

1. **High:** Add Multi-Function Repair Arm to systems.json (and its actions to actions.json)
2. **High:** Fix Thresher Butcher Pattern -- change "Loudspeakers" to "Escape Hatch" in systems, add "Comms Module" to modules
3. **Medium:** Verify Aardvarks Tongue tech level (TL3 vs TL4) by consulting physical rulebook
4. **Low:** Fix Survey Scanner page reference (194 -> 192)
5. **Low:** Fix He2 Coolant Flush page reference (197 -> 205)
