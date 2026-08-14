# drones

Autonomous drones

## Metadata

- **Schema ID**: `drones`
- **Schema File**: `schemas/drones.schema.json`
- **Data File**: `data/drones.json`
- **Total Items**: 14

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
| `structurePoints` | integer | ❌ | Structure points (mech health) |
| `techLevel` | unknown | ❌ | Technology level of the item or entity (integer 1-6, 'B' for Bio, or 'N' for Nanite) |
| `salvageValue` | integer | ❌ | Scrap value when salvaged |
| `systems` | Array<string> | ❌ | Installed system names |
| `traits` | Array<object> | ❌ | Traits and special properties |
| `energyPoints` | integer | ❌ | Energy points for powering systems |
| `heatCapacity` | integer | ❌ | Maximum heat before overheating |
| `systemSlots` | integer | ❌ | Number of system slots available |
| `moduleSlots` | integer | ❌ | Number of module slots available |
| `cargoCapacity` | integer | ❌ | Cargo carrying capacity |
| `actions` | Array<string> | ❌ | Action names this drone can perform |
| `modules` | Array<string> | ❌ | Mech module names this drone is equipped with |
| `bonusPerTechLevel` | object | ❌ | Stat bonuses gained per tech level |
| `choices` | Array<object> | ❌ | Configuration choices for this drone |

## Example

```json
{
  "id": "a2e4549e-d235-4647-9768-88372bf93afc",
  "source": "Salvage Union Workshop Manual",
  "name": "Defacer Drone",
  "systems": [
    "Hover Locomotion System",
    "Chainsaw Arm"
  ],
  "techLevel": 1,
  "salvageValue": 1,
  "structurePoints": 2,
  "page": 294,
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "AP",
      "page": 2
    }
  ],
  "content": [
    {
      "type": "paragraph",
      "value": "Used for salvaging and crowd control, their distinctive buzzsaw sound has struck fear into many protesters."
    }
  ]
}
```
