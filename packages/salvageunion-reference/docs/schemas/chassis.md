# chassis

Mech chassis definitions in Salvage Union

## Metadata

- **Schema ID**: `chassis`
- **Schema File**: `schemas/chassis.schema.json`
- **Data File**: `data/chassis.json`
- **Total Items**: 31

## Fields

| Field      | Type       | Required | Description |
| ---------- | ---------- | -------- | ----------- |
| `actions`  | `actions`  | ✅       |             |
| `patterns` | `patterns` | ✅       |             |
| `npc`      | `npc`      | ❌       |             |

## Example

```json
{
  "id": "40109396-2ee4-49ae-8290-2f435fd88c5e",
  "name": "Mule",
  "source": "Salvage Union Workshop Manual",
  "page": 100,
  "asset_url": "https://opxrguskxuogghzcnppk.supabase.co/storage/v1/object/public/LP-Assets/chassis/mule.png",
  "actions": [
    {
      "name": "Integrated Cargo Bay",
      "id": "d14854b7-56fc-4bf4-a9e8-74a5648fc661",
      "content": [
        {
          "type": "paragraph",
          "value": "Increases the Cargo Capacity of the Mule by 10, to 16."
        }
      ]
    }
  ],
  "patterns": [
    {
      "name": "Hauler Pattern",
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
      "name": "Crusher Pattern",
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
      "name": "Evantis Pattern",
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
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
- `shared/objects.schema.json#/definitions/chassisStats`
