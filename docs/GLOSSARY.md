# Salvage Union Glossary

This glossary defines key terminology used in the Salvage Union tabletop RPG and throughout the SURef codebase.

## Entity Types

### Pilot
A player character who operates mechs. Pilots have:
- **Class** - Starting profession (Engineer, Hacker, Hauler, Salvager, Scout, Soldier)
- **Abilities** - Skills and specializations unlocked with Training Points (TP)
- **Equipment** - Personal gear and tools
- **Training Points (TP)** - Currency for unlocking abilities

### Mech
A piloted mechanical vehicle. Mechs have:
- **Chassis** - The base frame/structure (e.g., Atlas, Scorpion)
- **Structure Points (SP)** - Health/durability of the mech
- **Energy Points (EP)** - Power for systems and modules
- **Systems** - Weapons and active systems installed
- **Modules** - Passive upgrades and modifications
- **Pattern** - Visual customization option
- **Quirk** - Unique characteristic or flaw

### Crawler
A large mobile base/fortress. Crawlers have:
- **Type** - Classification (e.g., Fortress, Outpost)
- **Bays** - Specialized compartments for various purposes
- **Scrap** - Currency and resources
- **NPCs** - Non-player characters assigned to bays

### Bay
A specialized compartment in a crawler. Bays can be:
- Storage bays (cargo)
- Living quarters
- Workshops
- Medical bays
- Defense systems
- Custom configurations

## Stats and Resources

### Structure Points (SP)
- **Mech SP** - Health points for mechs. When reduced to 0, the mech is destroyed.
- **Bay SP** - Durability for crawler bays. Damaged bays may have reduced functionality.

### Energy Points (EP)
- **Mech EP** - Power available to mech systems and modules. Spent to activate abilities.

### Training Points (TP)
- **Pilot TP** - Currency used to unlock new abilities for pilots.
- Earned through gameplay and character progression.

### Ability Points (AP)
- Used for pilot abilities that require activation cost.
- Different from EP (mech energy) and TP (training currency).

### Scrap
- Currency and resources in the Salvage Union world.
- Used for repairs, upgrades, and trading.

## Game Mechanics

### Tech Level
Items have a tech level rating:
- **Numeric (1-5)** - Standard tech levels, higher is more advanced
- **B** - Basic tech, equivalent to level 1 for calculations
- **N** - Neutral tech, equivalent to level 1 for calculations

### Salvage Value
The scrap value of an item when salvaged/scrapped. Used for trading and economy.

### Traits
Special properties of items:
- **Weapon traits** - Melee, Ballistic, Energy, Missile
- **Armor traits** - Protection ratings
- **Special traits** - Unique abilities (e.g., "Modular", "Explosive")

### Actions
Abilities that can be used by entities:
- **Pilot actions** - Skills and abilities from pilot class
- **System actions** - Weapons and active systems on mechs
- **Module actions** - Passive or active module abilities

### Choices
Options players must select for entities with variants:
- **Ability choices** - Specializations (e.g., Bionic Senses → Hearing/Vision)
- **NPC choices** - Character variations
- **Module choices** - Configuration options

## Schema Types

### Core Entities
- **Abilities** - Pilot skills and specializations
- **Chassis** - Mech base frames
- **Classes** - Pilot professions
- **Equipment** - Pilot gear and tools
- **Systems** - Mech weapons and active systems
- **Modules** - Mech passive upgrades
- **Crawlers** - Mobile base types
- **Crawler Bays** - Specialized compartments

### Reference Entities
- **Keywords** - Game terminology and rules
- **Traits** - Item properties and modifiers
- **Actions** - Standard game actions
- **Roll Tables** - Random generation tables
- **NPCs** - Non-player character templates
- **Squads** - NPC group configurations

### World Entities
- **Creatures** - Wasteland creatures
- **Vehicles** - Non-mech vehicles
- **Drones** - Autonomous units
- **Bio-Titans** - Massive bio-engineered creatures
- **Meld** - Meld-infected creatures
- **Factions** - Organizations and groups
- **Distances** - Measurement standards

## Database Terms

### SUEntities (Normalized Entities)
Stored player-owned entities referencing `salvageunion-reference` data:
- Links to parent (Pilot, Mech, Crawler)
- References schema via `schema_name` and `schema_ref_id`
- Stores metadata for instance-specific state

### Player Choices
Player selections for entities with choice options:
- Links to entity via `entity_id`
- Stores selected `choice_ref_id` and `value`

### Cargo
Items stored on mechs or crawlers:
- Can reference schema entities (e.g., equipment, systems)
- Can be custom named items
- Includes amount for stackable items
- Position metadata for grid-based storage

## Status Terms

### Active/Inactive
- **Pilot Active** - Currently playable pilot
- **Mech Active** - Currently assigned to active pilot
- Only one active pilot/mech per user

### Private/Public
- **Private** - Only visible to owner and game members
- **Public** - Visible to all users
- Applies to pilots, mechs, crawlers, and games

### Damaged
- **Mech Damaged** - Systems or modules are damaged/reduced functionality
- **Bay Damaged** - Crawler bay has reduced functionality
- Stored in entity metadata

## Game Terms

### Game
A play session or campaign:
- **Mediator** - Game master/user who manages the game
- **Members** - Players participating in the game
- **Public/Private** - Visibility settings

### Hydrated Entity
A database entity with reference data loaded:
- Contains `ref` property with data from `salvageunion-reference`
- Includes `choices` array for player selections
- Used throughout the app for displaying full entity information

### Reference Data
Static game data from `salvageunion-reference` package:
- Schema-validated JSON files
- TypeScript ORM for type-safe access
- Never modified by players (read-only reference)
