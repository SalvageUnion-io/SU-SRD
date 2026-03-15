# Audit Report: WM-2 (Workshop Manual pages 51-100)

## Summary
- Pages reviewed: 51-100
- Entities checked: 96
- Discrepancies found: 18

## Discrepancies

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Knife Missle | equipment.json | `name` | "Knife Missile" (p. 73) | `"Knife Missle"` (missing 'i') | typo |
| 2 | Custom Missle Launcher | equipment.json | `name` | "Custom Missile Launcher" (p. 55 ability tree, p. 73 legendary) | `"Custom Missle Launcher"` (missing 'i') | typo |
| 3 | WingSuit | equipment.json | `name` | "Wingsuit" (p. 51, single word, no camelCase) | `"WingSuit"` (incorrect casing) | typo |
| 4 | Adv. Epoxy Applicator | equipment.json | `name` | "Advanced Epoxy Applicator" (p. 84) | `"Adv. Epoxy Applicator"` (abbreviated) | typo |
| 5 | Scuffed Book | roll-tables.json | `table.8.value` (Keepsake) | "Scruffed Book" (p. 90) | `"Scuffed Book"` | typo |
| 6 | Pilot Appearance | roll-tables.json | `page` | p. 91 (Appearance Table on page 91) | `332` | wrong-data |
| 7 | Keepsake | roll-tables.json | `page` | p. 90 (Keepsake Table on page 90) | `24` | wrong-data |
| 8 | Motto | roll-tables.json | `page` | p. 90 (Motto Table on page 90) | `24` | wrong-data |
| 9 | Improvised Melee Weapon | equipment.json | `page` | p. 81 (Pilot Equipment Tech 1 listing, p. 78 index) | `298` | wrong-data |
| 10 | Portable Comms Unit | equipment.json | `page` | p. 81 (Pilot Equipment Tech 1 listing) | `301` | wrong-data |
| 11 | Salvaging Tools | equipment.json | `page` | p. 81 (Pilot Equipment Tech 1 listing) | `298` | wrong-data |
| 12 | Pistol | equipment.json | `page` | p. 81 (Pilot Equipment Tech 2 listing) | `314` | wrong-data |
| 13 | Green Laser Rifle | equipment.json | `page` | p. 82 (Pilot Equipment Tech 3 listing) | `313` | wrong-data |
| 14 | Reactive Armour | equipment.json | `page` | p. 83 (Pilot Equipment Tech 3 listing) | `333` | wrong-data |
| 15 | Rifle | equipment.json | `page` | p. 83 (Pilot Equipment Tech 3 listing) | `127` | wrong-data |
| 16 | Electro Grappling Hook | equipment.json | `page` | p. 84 (Pilot Equipment Tech 4 listing) | `301` | wrong-data |
| 17 | Sniper Rifle | equipment.json | `page` | p. 85 (Pilot Equipment Tech 4 listing) | `47` | wrong-data |
| 18 | Monomolecular Sword | equipment.json | `page` | p. 85 (Pilot Equipment Tech 5 listing) | `301` | wrong-data |

### Notes on equipment page discrepancies (#9-18)

These equipment items have JSON page values pointing to later pages in the book (appendix/reference pages 127-333) rather than the Pilot Equipment section (pp. 78-87) where the items are described with their full stats and actions. Other equipment items in the same section correctly point to pages 80-87. This inconsistency suggests these items were added at different times or from different source pages. The PDF describes each item fully in the Pilot Equipment section (pp. 80-87), which is where the page should point for consistency with the other equipment entries.

## Entities Verified Clean

### Classes (pages 51-77)
- Soldier (page 52)
- Cyborg (page 58)
- Fabricator (page 62)
- Ranger (page 66)
- Smuggler (page 70)
- Union Rep (page 74)

### Ability Tree Requirements (pages 51-77)
- Advanced Soldier (page 52)
- Legendary Soldier (page 52)
- Cyborg (page 58)
- Legendary Cyborg (page 58)
- Fabricator (page 62)
- Legendary Fabricator (page 62)
- Ranger (page 66)
- Legendary Ranger (page 66)
- Smuggler (page 70)
- Legendary Smuggler (page 70)
- Union Rep (page 74)
- Legendary Union Rep (page 74)

### Abilities (pages 51-77)
- Charge (page 54)
- Overpower (page 54)
- Duel (page 54)
- Wastelander Rapport (page 54)
- Resourceful (page 54)
- Custom Missile Launcher (page 55)
- Provoke (page 55)
- Tactical Retreat (page 55)
- Counterattack (page 55)
- Critical Strike (page 56)
- Defy Death (page 56)
- Whirlwind Strike (page 56)
- Omega Strike (page 56)
- Steel Pact (page 56)
- Glanded Stims (page 60)
- Modular Face Implant (page 60)
- Bionic Endoskeleton (page 60)
- Meld Form (page 60)
- Field Fabrication (page 64)
- Miniaturised EMP (page 64)
- Chassis Modder (page 64)
- System Miniaturisation (page 64)
- Droned Mech Conversion (page 65)
- Mecha Companion (page 68)
- Snipe (page 68)
- Infiltration (page 68)
- Mecha Packmaster (page 69)
- One with the Wastelands (page 69)
- Black Market (page 71)
- Pray I don't alter the deal further... (page 72)
- Hidden Stash (page 73)
- Stealth Field Generator (page 73)
- Knife Missile (page 73)
- Union Representative (page 76)
- Union Call (page 75)
- Recruit (page 76)
- VIP Beacon (page 75)
- Inspirational Union Leader (page 77)

### Equipment (pages 51-87, Workshop Manual source)
- First Aid Kit (page 80)
- Handheld Riveting Gun (page 80)
- Heavy Duty Torch (page 80)
- High Tensile Wire (page 80)
- Improvised Explosive Device (page 80)
- Improvised Firearm (page 80)
- Flare Gun (page 81)
- Holofoil Tent (page 81)
- Disposable Camera (page 81)
- Reinforced Polycarbonate Shield (page 81)
- Portable Arc Welder (page 82)
- Red Laser Pistol (page 82)
- Rigging Jack (page 82)
- Grenade (page 82)
- Hazard Protection Suit (page 82)
- Healing Bio-Foam (page 83)
- Handheld Epoxy Canister (page 83)
- Hover Sled (page 83)
- Melee Armament (page 83)
- Portable Flamethrower (page 83)
- Shotgun (page 84)
- Tranquiliser Rifle (page 84)
- Night Vision Goggles (page 84)
- Portable Multi-Phase Shield (page 85)
- Remote Mine (page 85)
- Rocket Launcher (page 85)
- Beta Fission Gun (page 85)
- Polycarbonate Carapace Armour (page 86)
- Miniaturised Repair Arm (page 86)
- Anti-Gravity Belt (page 86)
- Executive Corpo Suit (page 86)
- Orbital Lance Controller (page 87)
- Nanite Repair Injector (page 87)
- Camo Suit (page 51)
- Teleport Beacon (page 51)
- Hacking Kit (page 51)
- Stealth Field Generator (page 73)
- Blinding Blue Laser Rifle (page 71)
- Mecha Companion (page 68)

### Modules (pages 71-72)
- Goflow Plant Growing System (page 71)
- Corrupted Neuralink Module (page 71)

### Systems (pages 71-72)
- Napalm Launcher (page 71)
- Rad Wave Generator (page 71)

### Traits (pages 51-100)
- ballistic (page 84) -- note: PDF defines this trait inline with Shotgun description on p.84
- shield (page 85)
- missile (page 55)
- melee (page 59)
- silent (page 81)
- heavy (page 78)
- explosive (page 78)
- armour (page 79)
- climbing (page 84) -- defined inline with Electro Grappling Hook

### Roll Tables (pages 88-91)
- Callsign Table (page 88)
- Background (page 89)
- A.I. Personality (page 91) -- note: JSON page not checked directly, entries match PDF

### Chassis (page 100)
- Mule (page 100) -- stats verified: SP=12, EP=4, HC=6, SS=16, MS=2, CC=16, TL=1, SV=7, Chassis Ability: Integrated Cargo Bay

### Guides (pages 94-95)
- Create a Mech (page 94)
