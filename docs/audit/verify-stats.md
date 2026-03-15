# Stat & Structural Data Verification

## Data Model Analysis

Pattern system/module references use **canonical names** from `systems.json` and `modules.json`, not PDF-specific names. For example:
- PDF may say "Personnel Transport Pod (Woven Home)" but the canonical system is "Personnel Transport Pod"
- PDF may say "Missile Pods" (plural) but canonical is "Missile Pod"
- PDF may say "Laser Guidance Module" but canonical is "Laser Guidance"
- PDF may say "Olfactory Gland" (singular) but canonical is "Olfactory Glands"

When a PDF uses a variant name (e.g., "Automated 120mm Cannon" vs "120mm Cannon"), this creates ambiguity: is it the same canonical system or a distinct item?

Key finding: Some PDF names like "Energy Shield" and "Aeon Shield Dome" do NOT exist in `systems.json` at all, while the JSON uses existing canonical systems ("Refractive Shield Projector" and "Shield Dome"). These are genuine mismatches where the pattern references a system that doesn't match the PDF.

---

## Verdicts

### FIX

| Entity | File | Field | Current Value | Correct Value | Reason |
|--------|------|-------|--------------|---------------|--------|
| Wader | chassis.json | structurePoints | 7 | 23 | PDF p.61 clearly shows 23 |
| Wader | chassis.json | energyPoints | 10 | 8 | PDF p.61 clearly shows 8 |
| Wader | chassis.json | heatCapacity | 6 | 14 | PDF p.61 clearly shows 14 |
| Wader | chassis.json | systemSlots | 8 | 14 | PDF p.61 clearly shows 14 |
| Wader | chassis.json | techLevel | 1 | 2 | PDF p.61 clearly shows 2 |
| Wader | chassis.json | salvageValue | 4 | 8 | PDF p.61 clearly shows 8 |
| Wader Weaver Pattern | chassis.json | systems[].name | "Personnel Transport Pod" | "Personnel Transport Pod (Woven Home)" | PDF p.60 uses full name with suffix; this is a distinct variant, not a generic PTP |
| Ravager | chassis.json | chassisAbilities[0] | "Integrated Advanced Stabilising Locomotion System" | "Integrated Advanced Deployable Locomotion System" | PDF p.65 heading says "Deployable"; the ability description talks about deploying statically. Also update the matching action name in actions.json |
| Thresher Butcher Pattern | chassis.json | systems | Has "Loudspeakers" | Should have "Escape Hatch" | PDF p.109 Butcher Pattern lists Escape Hatch, not Loudspeakers |
| Thresher Butcher Pattern | chassis.json | modules | Only has "Adv. Weapon Link" | Should also have "Comms Module" | PDF p.109 Butcher Pattern lists both Comms Module and Adv. Weapon Link |
| Pioneer Deerstalker Pattern | chassis.json | systems[].name | "Green Laser" | "Overcharged Green Laser" | PDF p.59 lists "Overcharged Green Laser" and file is `OC_green_laser.sys`; "Overcharged Green Laser" exists in systems.json as a distinct system |
| Kelpie | chassis.json | systemSlots | 8 | 6 | PDF p.54 clearly shows 6 |
| Consul | chassis.json | cargoCapacity | 6 | 5 | PDF p.142 clearly shows 5 |
| Mantis | chassis.json | chassisAbilities[0] | "Integrated Frog Prince" | "Integrated Frog Prince Module" | PDF p.130 heading says "Integrated Frog Prince Module" |
| Vorpal Zap Pattern | chassis.json | systems[].name | "Shield Dome" | "Aeon Shield Dome" | PDF p.147 lists "Aeon Shield Dome"; this is a distinct item from regular Shield Dome. Will need a new system entry or alias in systems.json |
| Impaler Alpha Pattern | chassis.json | systems[].name | "Refractive Shield Projector" | "Energy Shield" | PDF p.76 lists "Energy Shield"; these are different items. Will need a new system entry or alias in systems.json |

### SKIP

| Entity | File | Field | Current Value | Reason for Keeping |
|--------|------|-------|--------------|-------------------|
| Thresher | chassis.json | systemSlots | 9 | PDF p.108 confirms SS=9. Reviewer claim of 10 was wrong |
| Kraken | chassis.json | cargoCapacity | 6 | PDF p.118 confirms CC=6. Reviewer claim of 3 was wrong |
| Mirrorball | chassis.json | cargoCapacity | 6 | PDF p.122 confirms CC=6. Reviewer claim of 3 was wrong |
| Carrier | chassis.json | cargoCapacity | 6 | PDF p.148 confirms CC=6. Reconciliation agreed with auditor's wrong claim of 5 |
| Carrier | chassis.json | techLevel | 5 | PDF p.148 confirms TL=5. Auditor claim of TL=6 was wrong |
| Agares Pattern A | chassis.json | systems[].name | "120mm Cannon" | PDF says "Automated 120mm Cannon" but "120mm Cannon" is the canonical system name in systems.json. The Agares is an Automech so "Automated" is a flavor prefix, not a distinct system. No "Automated 120mm Cannon" exists in the data |
| Ravager Hunchback | chassis.json | systems[].name | "Missile Pod" | PDF says "Missile Pods" (plural) but "Missile Pod" is the canonical singular name in systems.json. Pattern lists only one entry |
| Impaler Alpha | chassis.json | modules[].name | "Laser Guidance" | PDF says "Laser Guidance Module" but "Laser Guidance" is the canonical module name in modules.json. Suffix "Module" is flavor text |
| Cranium Probe Pattern | chassis.json | modules[].name | "Neuralink Communicator" | PDF says "Neuralink Module" but "Neuralink Communicator" is the canonical module name in modules.json. No "Neuralink Module" exists in the data |
| Scuttler Harvester Pattern | chassis.json | modules[].name | "Neuralink Communicator" | Same as above — canonical name is "Neuralink Communicator" |
| Scuttler Harvester Pattern | chassis.json | modules[].name | "Olfactory Glands" | PDF says "Olfactory Gland" (singular) but "Olfactory Glands" (plural) is the canonical module name in modules.json |
| Stormterror Screecher | chassis.json | modules[].name | "Weapon Link" | PDF says "Weapon Link Module (Bio-Talon x 3)" but "Weapon Link" is the canonical module name. The "(Bio-Talon x 3)" is a pattern-specific note, not part of the module name |
| Stolas Pattern B | chassis.json | modules[].name | "Weapon Link" | PDF says "Weapon Link Module (.50 Cal Machine Gun x 5)" — same pattern: canonical name without flavor suffix |
| Cranium Probe Pattern | chassis.json | modules[].name | "Panda Sneeze" | PDF says "Panda Sneeze Module" but if canonical name is "Panda Sneeze" this is consistent with other module name conventions |
| Ravager/Agares stats | chassis.json | all stats | Match PDF | JSON stats verified correct against PDF p.65 (Ravager) and p.67 (Agares) |

### VERIFY

| Entity | File | Field | Current Value | Proposed Value | Why Ambiguous |
|--------|------|-------|--------------|---------------|---------------|
| Pioneer Deerstalker | chassis.json | pattern structure | "Tracking Node" listed under systems | PDF p.59 shows tracking_node.mdl in MODULES folder and LOADOUT lists it under MODULES | PDF clearly categorizes it as a module, but "Tracking Node" exists in systems.json as a system. Moving it to modules in the pattern would misalign with the system definition. May need both a system and module entry, or the PDF categorization may be an error in the supplement |
| Vorpal Zap Pattern | systems.json | (new entry needed?) | "Shield Dome" exists | "Aeon Shield Dome" needed | If fixed, a new system entry "Aeon Shield Dome" must be created in systems.json, or an alias mechanism added. This is a data model change beyond a simple rename |
| Impaler Alpha | systems.json | (new entry needed?) | "Refractive Shield Projector" exists | "Energy Shield" needed | Same issue: "Energy Shield" doesn't exist in systems.json. WWHF may define it separately. Check if WWHF has its own systems/actions for Energy Shield |
| Ravager | actions.json | name | "Integrated Advanced Stabilising Locomotion System" | "Integrated Advanced Deployable Locomotion System" | The action content references "Stabilising Locomotion System (p.181 SU Core Book)" — need to verify whether the core book system is called "Stabilising" or "Deployable" to determine which name is correct throughout |
| Solo Sakura Pattern | chassis.json | content | Has surname "Kureigh" and wording changes | Reviewer flagged differences from PDF | Need to check PDF for exact text — may be an intentional expansion or an error |
