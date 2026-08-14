# squads

NPC squads and groups

## Metadata

- **Schema ID**: `squads`
- **Schema File**: `schemas/squads.schema.json`
- **Data File**: `data/squads.json`
- **Total Items**: 23

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
| `hitPoints` | integer | ❌ | Hit points of this squad |
| `actions` | Array<string> | ✅ | Action names this squad can perform |
| `traits` | Array<object> | ❌ | Traits and special properties |
| `damageType` | string | ❌ | Type of damage this squad deals |

## Example

```json
{
  "id": "fa6feaf4-1202-4263-9e1a-a71a6f43a661",
  "source": "Salvage Union Workshop Manual",
  "name": "Waster Mob",
  "actions": [
    "Improvised Weapons",
    "Salvaging Tools (NPC)"
  ],
  "hitPoints": 4,
  "damageType": "HP",
  "page": 300,
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "AP",
      "page": 2
    },
    {
      "source": "Reclamation of the Wastes",
      "page": 104
    }
  ],
  "content": [
    {
      "type": "paragraph",
      "value": "A mob of wastelanders with improvised weapons."
    }
  ]
}
```
