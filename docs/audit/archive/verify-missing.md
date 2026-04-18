# Missing Data Verification

## Data Model Analysis

Key schema patterns relevant to missing data findings:

- **ActionSchema** fields are mostly optional: `activationCost`, `actionType`, `range`, `traits`, `damage` are all optional. An action with only `name`, `content`, and `actionSource` is valid per schema. However, if the PDF defines these fields, they should be present for completeness.
- **FormationMechSchema** supports `chassis`, optional `pattern`, optional `schema` (to reference vehicles/squads/npcs/drones instead of chassis), optional `quantity`. Squads and vehicles can be formation members via the `schema` field.
- **PatternSchema** has a single optional `drone` object with `systems` and `modules` arrays. The schema only supports ONE drone configuration per pattern - there is no way to represent multiple distinct drone loadouts (e.g., Drones 2-4 with different configs).
- **ModuleSchema** extends `SystemModuleSchema` which has no dedicated "restrictions" or "mount requirements" field. Mount restrictions must be conveyed in `content` or `actions`.
- **DroneSchema** extends `MechanicalEntitySchema` with optional `choices`. It has `content` for descriptions.
- **Roll table entries** are keyed by range strings (e.g., "1", "2-5", "6-10") with `value` and optional `label`.

## Verdicts

### FIX (data genuinely missing and should be added)

| # | Entity | File | What's Missing | How to Fix |
|---|--------|------|---------------|------------|
| 1 | Eggs Mayhem action | actions.json | Missing `activationCost`, `actionType`, `range`, and Hacking `trait` | Add `"activationCost": 2`, `"actionType": "Turn"`, `"range": ["Medium"]`, and `"traits": [{"type": "hacking"}]` per PDF p.190 |
| 2 | Refractive Shield Projector action | actions.json | Missing `activationCost` | Add `"activationCost": 2` - the action has other fields (actionType, range, traits) but is missing activation cost |
| 3 | Electro-Magnetic Shield Projector action | actions.json | Missing `activationCost` | Add `"activationCost": 2` - same situation as Refractive Shield Projector |
| 4 | Shield Dome action | actions.json | Missing `activationCost` | Add `"activationCost": "X"` - the Integrated Advanced Shield Dome version already has `"activationCost": "X"` |
| 5 | Laser Anti-Missile System action | actions.json | Missing `activationCost` | Add `"activationCost": 1` per PDF |
| 6 | Multi-Targeter action | actions.json | Missing `activationCost` | Add `"activationCost": "X"` - the Adv. Targeting Array version already has `"activationCost": "X"` |
| 7 | Bio-Talon action | actions.json | Missing `rigging` trait | Add `{"type": "rigging"}` to the traits array. Currently only has `melee` trait |
| 8 | Critical Strike action | actions.json | Missing HP Max paragraph | Add paragraph: "In addition, increase your Pilot's HP Max by 2." to the content array |
| 9 | Group Initiative (6-10 result) | roll-tables.json | "chosen by the **players**" should be "chosen by the **Mediator**" | Change `"One NPC chosen by the players acts first"` to `"One NPC chosen by the Mediator acts first"` in the 6-10 entry |
| 10 | Trash Locusts faction | factions.json | Missing Rotorcraft from formation | Add `{"chassis": "Rotorcraft", "schema": "vehicles", "source": "Salvage Union Workshop Manual", "page": 293}` to formation array |
| 11 | Wagon Wasters faction | factions.json | Missing Waster Mob x 2 from formation | Add `{"chassis": "Waster Mob", "schema": "squads", "source": "Salvage Union Workshop Manual", "page": 270, "quantity": 2}` to formation array |
| 12 | Chimerium Cult faction | factions.json | Missing Waster Mob x 2 from formation | Add `{"chassis": "Waster Mob", "schema": "squads", "source": "Salvage Union Workshop Manual", "page": 270, "quantity": 2}` to formation array |
| 13 | Big Brother Drone | drones.json | Generic placeholder description instead of full PDF text | Replace content `"A support drone controlled by the Big Brother chassis."` with actual PDF description from p.62 |
| 14 | Adrenal Glands module | modules.json | Missing Bio-Mech mount restriction | Add restriction text to the action content in actions.json (for the "Burst (Adrenal Glands)" / "Power (Adrenal Glands)" actions), or add content to the module entry stating "May only be Mounted on a Bio-Mech Chassis" |
| 15 | Regeneration Glands module | modules.json | Missing Bio-Mech mount restriction | Same approach - add "May only be Mounted on a Bio-Mech Chassis" restriction to module content or action content |
| 16 | Crawler Damage table (2-5) | roll-tables.json | Missing trailing text about population casualties | Current 2-5 value ends without population text. Add trailing sentence about 5% population casualties per PDF |

### SKIP (data not needed or represented differently)

| # | Entity | File | What's "Missing" | Why It's OK |
|---|--------|------|-----------------|------------|
| 1 | Evasion Protocols action | actions.json | Missing Hot(2) trait | Has `heat spike` trait already. `heat spike` is the data model's representation of PDF "Hot" - both indicate heat generation. The content text describes the heat mechanic |
| 2 | Offensive Protocols action | actions.json | Missing Hot(2) trait | Has `heat spike` trait already. Content explicitly states "your Mech gains 2 Heat and must make a Heat Check." Same `heat spike` = `Hot` equivalence |
| 3 | Weapon Link action | actions.json | Missing Hot(X) trait | Has `heat spike` trait already. Content describes variable heat gain per weapon linked |
| 4 | Adv. Weapon Link action | actions.json | Missing Hot(X) trait | Has `heat spike` trait already. Same reasoning as Weapon Link |
| 5 | turrets keyword | keywords.json | Missing page reference "(p. 170)" at end of content | The "(p. 170)" is a cross-reference to another page in the PDF, which is navigation-specific to the physical book. The JSON data model uses entity references `[[...]]` for cross-linking, not page references |
| 6 | Reactor Overload table entry "1" | roll-tables.json | Reportedly missing result "1" entry | The "1" entry DOES exist in the JSON with label "Reactor Overload" and full meltdown text. This finding is incorrect - data is already present |

### VERIFY (needs human judgment)

| # | Entity | File | What's Missing | Why Ambiguous |
|---|--------|------|---------------|---------------|
| 1 | Red Mesa Mutants faction | factions.json | Missing "Chimerium Mutant Mob" from formation | No entity called "Chimerium Mutant Mob" exists in squads.json. There IS a "Chimerium Mutant Squad" in npcs.json (id: 9791494b). Need PDF verification: is this the existing "Chimerium Mutant Squad" NPC, or a distinct mob entity that needs to be created first? |
| 2 | Big Brother (DronTek Pattern) drone config | chassis.json | Only Drone 1 (Shield) included; Drones 2-4 missing | The pattern schema only supports a single `drone` object per pattern (with `systems` and `modules` arrays). The current config has `"systems": ["Refractive Shield Projector", "Electro-Magnetic Shield Projector"]`. If the PDF defines 4 distinct drone loadouts, the schema would need to be extended to support a `drones` array. This is a schema limitation, not just missing data |
| 3 | Needle Missile Pod action | actions.json | Missing Uses(30) trait | TraitSchema accepts any string type, so `{"type": "uses", "amount": 30}` is valid. However, no existing actions use a "uses" trait - check if this is a data model convention or if it should be added as a new trait pattern. The content text does describe the uses mechanic |
| 4 | Missile Pod action | actions.json | Missing Uses(6) trait | Same as Needle Missile Pod - `{"type": "uses", "amount": 6}` is technically valid but no precedent exists. Check PDF to confirm whether Uses is listed as a formal trait or just described in text |
| 5 | Power Loader Rigging Arm x2 | vehicles.json | Missing quantity indicator | Vehicle `systems` field is `string[]` with no quantity support. Options: duplicate the entry as `["Locomotion System", "Rigging Arm", "Rigging Arm"]`, or accept the limitation. Need to decide on convention |
