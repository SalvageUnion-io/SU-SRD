# Audit Report: WM-3 (Workshop Manual pages 101-150)

## Summary
- Pages reviewed: 101-150
- Entities checked: 38
- Discrepancies found: 10

## Discrepancies

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | Thresher (Butcher Pattern) | chassis.json | systems | Escape Hatch (p109) | Loudspeakers | wrong-data |
| 2 | Thresher (Butcher Pattern) | chassis.json | modules | Comms Module, Adv. Weapon Link (p109) | Adv. Weapon Link only | missing |
| 3 | Forge (Osiris Pattern) | chassis.json | content | Full description text from p111 (see above) | Abbreviated text | wrong-data |
| 4 | Gopher (Legion Pattern) | chassis.json | content | Full description text from p113 (see above) | Abbreviated/reworded text | wrong-data |
| 5 | Gopher (Longsaddle Pattern) | chassis.json | content | Full description text from p113 (see above) | Truncated text | wrong-data |
| 6 | Gopher (Opus Pattern) | chassis.json | content | "original designation of quickly ferrying" (p113) | "original purpose of quickly moving" | wrong-data |
| 7 | Little Sestra | chassis.json | content | "HC-15" (Latin H) (p128) | "НC-15" (Cyrillic Н) | typo |
| 8 | Scrapper (Sakura Pattern) | chassis.json | content | Includes riot control sentence (p105) | Missing riot control sentence | missing |
| 9 | Carrier | chassis.json | techLevel | 6 (p148) | 5 | wrong-data |
| 10 | Carrier | chassis.json | cargoCapacity | 5 (p148) | 6 | wrong-data |

## Entities Verified Clean
- Mazona (page 102) -- stats, content, patterns, chassis ability all match
- Scrapper (page 104) -- stats and content match (Sakura pattern content truncated, see #8)
- Spectrum (page 106) -- stats, content, patterns, chassis ability all match
- Thresher (page 108) -- stats and content match (Butcher pattern issues, see #1-2; Shepherd, H&V patterns match)
- Forge (page 110) -- stats and content match (Osiris pattern content abbreviated, see #3; Beam, Steamroller patterns match)
- Gopher (page 112) -- stats match (pattern descriptions abbreviated, see #4-6)
- Hussar (page 114) -- stats, content, patterns, chassis ability all match
- Jackhammer (page 116) -- stats, content, patterns, chassis ability all match
- Kraken (page 118) -- stats, content, patterns, chassis ability all match
- Magpie (page 120) -- stats, content, patterns, chassis ability all match
- Mirrorball (page 122) -- stats, content, patterns, chassis ability all match
- Atlas (page 124) -- stats, content, patterns, chassis ability all match
- Brawler (page 126) -- stats, content, patterns, chassis ability all match
- Little Sestra (page 128) -- stats, patterns match (Cyrillic char issue, see #7)
- Mantis (page 130) -- stats, content, patterns, chassis ability all match
- Photon (page 132) -- stats, content, patterns, chassis ability all match
- Solo (page 134) -- stats, content, patterns, chassis ability all match
- Terra (page 136) -- stats, content, patterns, chassis ability all match
- Aegis (page 138) -- stats, content, patterns, chassis ability all match
- Colossus (page 140) -- stats, content, patterns, chassis abilities all match
- Consul (page 142) -- stats, content, patterns, chassis abilities all match
- Drop Bear (page 144) -- stats, content, patterns, chassis ability all match
- Vorpal (page 146) -- stats, content, patterns, chassis ability all match
- Carrier (page 148) -- content and patterns match (techLevel and cargoCapacity discrepancies, see #9-10)
- Eidolon (page 150) -- stats, content, chassis abilities match
- Sestra Drone (page 128) -- stats match (SP=7, EP=8, HC=6, Sys=7, Mod=2, Cargo=3, TL=3, SV=2)
- Rifle (equipment, page 127) -- action data matches (Medium range, 5 HP damage, Ballistic trait)
- drone (keyword, page 102) -- content matches
- people (keyword, page 139) -- content matches
- amphibious (trait, page 118) -- content matches
- escape (trait, page 129) -- content matches
- fast (trait, page 114) -- content matches
- flashy (trait, page 142) -- content matches
- hover (trait, page 102) -- content matches
- overheat (trait, page 103) -- content matches
- rigging (trait, page 145) -- content matches
- scanner (trait, page 106) -- content matches
- Reinforced Chassis (roll-table, page 116) -- table values match
