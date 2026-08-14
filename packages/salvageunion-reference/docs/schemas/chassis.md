# chassis

Mech chassis definitions

## Metadata

- **Schema ID**: `chassis`
- **Schema File**: `schemas/chassis.schema.json`
- **Data File**: `data/chassis.json`
- **Total Items**: 51

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hasArtwork` | boolean | ❌ | Whether this entity has artwork; the .webp URL is derived from schema + slug |
| `content` | Array<object> | ❌ | Descriptive content blocks for this entity |
| `id` | string | ✅ | Unique identifier for this entity |
| `blackMarket` | boolean | ❌ | Whether this entity is only available on the black market |
| `name` | string | ✅ | Display name of this entity |
| `source` | string | ✅ | Primary source book this entity appears in |
| `page` | integer | ✅ | Page number in the primary source book |
| `booklet` | string | ❌ | Booklet code within a multi-booklet primary source (e.g. "CR", "PH", "PC", "RR", "AP" for the Salvage Union Starter Set). Omit for single-volume sources. |
| `additionalSources` | Array<object> | ❌ | Other source books where this entity is reprinted |
| `structurePoints` | integer | ✅ | Structure points (mech health) |
| `energyPoints` | integer | ✅ | Energy points for powering systems |
| `heatCapacity` | integer | ✅ | Maximum heat before overheating |
| `systemSlots` | integer | ✅ | Number of system slots available |
| `moduleSlots` | integer | ✅ | Number of module slots available |
| `cargoCapacity` | integer | ✅ | Cargo carrying capacity |
| `techLevel` | unknown | ✅ | Technology level of the item or entity (integer 1-6, 'B' for Bio, or 'N' for Nanite) |
| `salvageValue` | integer | ✅ | Scrap value when salvaged |
| `chassisAbilities` | Array<string> | ✅ | Array of chassis ability names that reference actions.json |
| `patterns` | Array<object> | ✅ | Available mech patterns for this chassis |

## Example

```json
{
  "id": "40109396-2ee4-49ae-8290-2f435fd88c5e",
  "name": "Mule",
  "source": "Salvage Union Workshop Manual",
  "page": 100,
  "hasArtwork": true,
  "patterns": [
    {
      "name": "Hauler",
      "source": "Salvage Union Workshop Manual",
      "page": 101,
      "legalStarting": true,
      "systems": [
        {
          "name": ".50 Cal Machine Gun"
        },
        {
          "name": "Escape Hatch"
        },
        {
          "name": "Floodlights"
        },
        {
          "name": "Locomotion System"
        },
        {
          "name": "Loudspeakers"
        },
        {
          "name": "Rigging Arm"
        },
        {
          "name": "Transport Hold"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "Reactor Flare"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "This Mule, favoured by wastelanders and traders alike, is designed for hauling cargo, whilst being armed with some rudimentary defences."
        }
      ]
    },
    {
      "name": "Crusher",
      "source": "Salvage Union Workshop Manual",
      "page": 101,
      "systems": [
        {
          "name": "Red Laser"
        },
        {
          "name": "Dozer Blades"
        },
        {
          "name": "Escape Hatch"
        },
        {
          "name": "Hydraulic Crusher"
        },
        {
          "name": "Locomotion System"
        },
        {
          "name": "Loudspeakers"
        },
        {
          "name": "Rigging Arm"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "Survey Scanner"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "Clean and simple, this Mule can salvage Scrap, haul it back to a Crawler or wasteland settlement, and defend itself in a pinch from any raiders."
        }
      ]
    },
    {
      "name": "Evantis",
      "source": "Salvage Union Workshop Manual",
      "page": 101,
      "systems": [
        {
          "name": "Missile Pod"
        },
        {
          "name": "Armour Plating"
        },
        {
          "name": "Composite Armour"
        },
        {
          "name": "Ejection System"
        },
        {
          "name": "Locomotion System"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "Laser Guidance"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "These heavily armed and armoured Mules were used extensively during the Second Corpo War, to ferry cargo between arcos. Many salvager raids were rebuffed by corpos 'Circling the Mules' to create a devastating ring of missile fire."
        }
      ]
    },
    {
      "name": "Acid Spitter",
      "source": "We Were Here First!",
      "page": 76,
      "systems": [
        {
          "name": "Acid Cannon"
        },
        {
          "name": "Rigging Arm"
        },
        {
          "name": "Escape Hatch"
        },
        {
          "name": "Locomotion System"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "Olfactory Glands"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "Mules fitted with acid spitters to defend their Bio-Salvage hauls in Gehenna."
        }
      ]
    },
    {
      "name": "Survivor",
      "source": "Salvage Union Starter Set",
      "booklet": "PC",
      "page": 13,
      "systems": [
        {
          "name": ".50 Cal Machine Gun"
        },
        {
          "name": "Armour Plating"
        },
        {
          "name": "Floodlights"
        },
        {
          "name": "Escape Hatch"
        },
        {
          "name": "High Pressure Hose"
        },
        {
          "name": "Hydraulic Crusher"
        },
        {
          "name": "Locomotion System"
        },
        {
          "name": "Loudspeakers"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "Cooling Unit"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "The only Mech that survived the trade caravan ambush Judge crawled out of, built to withstand everything the wastes can throw at it and haul cargo to wherever the job says it needs to go."
        },
        {
          "type": "paragraph",
          "value": "This is a pre-made Mech for the Reclamation of the Wastes Campaign, piloted by Judge."
        }
      ]
    },
    {
      "name": "Shunter",
      "source": "Salvage Union Starter Set",
      "booklet": "PC",
      "page": 13,
      "systems": [
        {
          "name": "Hydraulic Crusher"
        },
        {
          "name": "Escape Hatch"
        },
        {
          "name": "Floodlights"
        },
        {
          "name": "Hydraulic Shunter"
        },
        {
          "name": "Locomotion System"
        },
        {
          "name": "Loudspeakers"
        },
        {
          "name": "Personnel Transport Pod"
        },
        {
          "name": "Rigging Arm"
        },
        {
          "name": "Tracking Node"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "Used extensively by the TDA during the construction of their new settlements within the Central Wastes, designed to be free of corpo rule. The Mech is designed to track and move heavy cargo and machinery."
        }
      ]
    },
    {
      "name": "Appleseed",
      "hidden": true,
      "source": "Mech Monday",
      "systems": [
        {
          "name": ".50 Cal Machine Gun"
        },
        {
          "name": "High Pressure Hose"
        },
        {
          "name": "Dozer Blades"
        },
        {
          "name": "Smuggling Hold"
        },
        {
          "name": "Locomotion System"
        },
        {
          "name": "Rigging Arm"
        },
        {
          "name": "Escape Hatch"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "Navigation Module"
        },
        {
          "name": "Goflow Plant Growing System"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "Popularized by the Green/Thumb smuggler sect, these humble Mules pose as simple traders while secretly growing, planting, and distributing stolen corpo plants throughout the wasteland."
        }
      ]
    },
    {
      "name": "Bola Spider",
      "hidden": true,
      "source": "Mech Monday",
      "systems": [
        {
          "name": "Railgun"
        },
        {
          "name": "Spider Locomotion System"
        },
        {
          "name": "Escape Hatch"
        },
        {
          "name": "Rigging Arm"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "Coolant Flow Manifold"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "When life hands you lemons, you make lemonade. And when life hands you a working railgun, you make a horrible thing that lurks in the most inaccessible spaces, spitting death until the chassis nearly tears itself apart under the strain."
        }
      ]
    },
    {
      "name": "Glorified Truck",
      "hidden": true,
      "source": "Mech Monday",
      "systems": [
        {
          "name": "Escape Hatch"
        },
        {
          "name": "Locomotion System"
        },
        {
          "name": "Transport Hold",
          "count": 4
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "Personal Recreation Device"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "This Mule Pattern brings all the scrap to the yard, and that's mostly all that it can do. Who needs the flashy Atlas when this humble Mule can do the same job bearing tons of scrap on its back?"
        }
      ]
    },
    {
      "name": "Guardian Angel",
      "hidden": true,
      "source": "Mech Monday",
      "systems": [
        {
          "name": "Floodlights"
        },
        {
          "name": "High Pressure Hose"
        },
        {
          "name": "Escape Hatch"
        },
        {
          "name": "Locomotion System"
        },
        {
          "name": "Riveting Gun"
        },
        {
          "name": "Armour Plating"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "Personal Recreation Device"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "Focused on assisting others, this Mule pattern keeps away from the fight and aims to fix and help those around it. It has no way to cause direct harm, but compensates with simple tools."
        }
      ]
    },
    {
      "name": "Honey Bee",
      "hidden": true,
      "source": "Mech Monday",
      "systems": [
        {
          "name": "Locomotion System"
        },
        {
          "name": "Torpedo Tubes"
        },
        {
          "name": "Escape Hatch"
        },
        {
          "name": "Prawn Sifter"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "DDR Module"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "Developed to reduce attacks on lone salvagers, the Honey Bee would, if threatened, deploy a number of heavy munitions at very close range, taking out any attackers and cargo, as well as itself."
        }
      ]
    },
    {
      "name": "Party Bus",
      "hidden": true,
      "source": "Mech Monday",
      "systems": [
        {
          "name": "Floodlights"
        },
        {
          "name": "FM-3 Flamethrower"
        },
        {
          "name": "Locomotion System"
        },
        {
          "name": "Loudspeakers",
          "count": 3
        },
        {
          "name": "Personnel Transport Pod"
        },
        {
          "name": "Smoke Machine"
        },
        {
          "name": "AFF Coolant Foam",
          "count": 2
        }
      ],
      "modules": [
        {
          "name": "Holo Projector"
        },
        {
          "name": "DDR Module"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "Party Bus is the perfect roaming night club. Featuring Disco Lights, Pyrotechnics, Smoke, Foam, and more speakers than you'll ever need, take this Mule an 11 of your pals out for night on the wastlands."
        }
      ]
    },
    {
      "name": "Steambender",
      "hidden": true,
      "source": "Mech Monday",
      "systems": [
        {
          "name": "Armoured Shield"
        },
        {
          "name": "Articulated Rigging Arm"
        },
        {
          "name": "Escape Hatch"
        },
        {
          "name": "FM-3 Flamethrower"
        },
        {
          "name": "High Pressure Hose"
        },
        {
          "name": "Locomotion System"
        },
        {
          "name": "Radiation Sealing"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "Zoom Optics"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "With massive hoses and tanks for water and napalm, this Opus Institute pattern is used regularly for cleanup operations of Meld contaminated areas. While no dedicated fighter or hauler, this mech can do either in a pinch."
        }
      ]
    },
    {
      "name": "Surprise",
      "hidden": true,
      "source": "Mech Monday",
      "systems": [
        {
          "name": "Locomotion System"
        },
        {
          "name": "Radomes"
        },
        {
          "name": "N15 Fat Boy"
        }
      ],
      "modules": [
        {
          "name": "Encrypted Comms"
        },
        {
          "name": "ECM Transmitter"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "The mech version of a dye pack, this Mule is typically deployed at a vulnerable part of the convoy, ready to destroy the attackers if all seems lost. The mech movement and weapon activation are both controlled remotely."
        }
      ]
    },
    {
      "name": "Swayback Wideloader",
      "hidden": true,
      "source": "Mech Monday",
      "systems": [
        {
          "name": "Locomotion System"
        },
        {
          "name": "Loudspeakers"
        },
        {
          "name": "Floodlights"
        },
        {
          "name": "Escape Hatch"
        },
        {
          "name": "Transport Hold"
        },
        {
          "name": "Armour Plating",
          "count": 2
        },
        {
          "name": "Sandblaster"
        },
        {
          "name": "Rigging Arm"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "Personal Recreation Device"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "Scrapped from vintage vehicles, more classic than innovative. Does what Mules do. Thick hide and cavernous hold."
        }
      ]
    },
    {
      "name": "Wagon",
      "hidden": true,
      "source": "Mech Monday",
      "systems": [
        {
          "name": ".50 Cal Machine Gun"
        },
        {
          "name": "Personnel Transport Pod",
          "count": 4
        },
        {
          "name": "Locomotion System"
        }
      ],
      "modules": [
        {
          "name": "Comms Module"
        },
        {
          "name": "Barometric Sensor"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "Designed by Wastelanders looking to pick up their entire settlement and move. This Pattern is capable of hauling almost a dozen families and their belongings across the wastleland with a Weather Sensor to ensure your Wagon isn't blown away."
        }
      ]
    },
    {
      "name": "Weatherboy",
      "hidden": true,
      "source": "Mech Monday",
      "systems": [
        {
          "name": "Frost Protection"
        },
        {
          "name": "Hydrologic Locomotion System"
        },
        {
          "name": "Escape Hatch"
        },
        {
          "name": "Stabilising Locomotion System"
        },
        {
          "name": "Radiation Sealing"
        }
      ],
      "modules": [
        {
          "name": "Barometric Sensor"
        },
        {
          "name": "Navigation Module"
        }
      ],
      "content": [
        {
          "type": "paragraph",
          "value": "Built to handle the worst weather the world has to offer, the Weatherboy is used by Union Crawlers as a scouting system to gather information on the weather patterns of an area. Typically, a Weatherboy spends extended time in an area to register full cycles."
        }
      ]
    }
  ],
  "structurePoints": 12,
  "energyPoints": 4,
  "heatCapacity": 6,
  "systemSlots": 16,
  "moduleSlots": 2,
  "cargoCapacity": 16,
  "techLevel": 1,
  "salvageValue": 7,
  "content": [
    {
      "type": "paragraph",
      "value": "The 'M-63' Mule was developed by the Opus Institute as one of the first open source Mech blueprints. They remain a ubiquitous presence across the wasteland as a result. Their design was replicated not only by other corpos, but numerous enthusiasts with a crafting bay. The Mule's spacious cargo bay makes the Mech invaluable to wastelanders, corpos, and salvagers alike for transporting salvage over a wide array of terrain, whilst its general hardiness allows it to survive numerous threats from raider ambushes to radiation storms."
    }
  ],
  "chassisAbilities": [
    "Integrated Cargo Bay"
  ],
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "PC",
      "page": 12
    }
  ]
}
```
