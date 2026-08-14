# vehicles

Conventional vehicles

## Metadata

- **Schema ID**: `vehicles`
- **Schema File**: `schemas/vehicles.schema.json`
- **Data File**: `data/vehicles.json`
- **Total Items**: 11

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
| `traits` | Array<object> | ❌ | Traits and special properties |
| `energyPoints` | integer | ❌ | Energy points for powering systems |
| `heatCapacity` | integer | ❌ | Maximum heat before overheating |
| `systemSlots` | integer | ❌ | Number of system slots available |
| `moduleSlots` | integer | ❌ | Number of module slots available |
| `cargoCapacity` | integer | ❌ | Cargo carrying capacity |
| `actions` | Array<string> | ❌ | Action names this vehicle can perform |

## Example

```json
{
  "id": "c1d53d2d-9abd-4a72-8e78-2674eb7d7329",
  "source": "Salvage Union Workshop Manual",
  "name": "Power Loader",
  "actions": [
    "Locomotion System",
    "Rigging Arm (Vehicle)",
    "Rigging Arm (Vehicle)"
  ],
  "techLevel": 1,
  "salvageValue": 1,
  "structurePoints": 1,
  "page": 292,
  "additionalSources": [
    {
      "source": "Reclamation of the Wastes",
      "page": 102
    }
  ],
  "content": [
    {
      "type": "paragraph",
      "value": "A pneumatically powered heavy loader for moving cargo."
    }
  ]
}
```
