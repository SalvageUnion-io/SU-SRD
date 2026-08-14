# equipment

Pilot equipment and gear

## Metadata

- **Schema ID**: `equipment`
- **Schema File**: `schemas/equipment.schema.json`
- **Data File**: `data/equipment.json`
- **Total Items**: 82

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
| `energyPoints` | integer | ❌ | Energy points for powering systems |
| `heatCapacity` | integer | ❌ | Maximum heat before overheating |
| `systemSlots` | integer | ❌ | Number of system slots available |
| `moduleSlots` | integer | ❌ | Number of module slots available |
| `cargoCapacity` | integer | ❌ | Cargo carrying capacity |
| `techLevel` | unknown | ✅ | Technology level of the item or entity (integer 1-6, 'B' for Bio, or 'N' for Nanite) |
| `salvageValue` | integer | ❌ | Scrap value when salvaged |
| `actions` | Array<string> | ✅ | Action names this equipment provides |
| `traits` | Array<object> | ❌ | Traits and special properties |
| `bonusPerTechLevel` | object | ❌ | Stat bonuses gained per tech level |
| `choices` | Array<object> | ❌ | Configuration choices for this equipment |

## Example

```json
{
  "id": "2ad40fb2-ab1f-4a0e-b974-1abef4f5fbee",
  "source": "Salvage Union Workshop Manual",
  "name": "First Aid Kit",
  "techLevel": 1,
  "page": 80,
  "actions": [
    "First Aid Kit"
  ],
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "PH",
      "page": 38
    }
  ]
}
```
