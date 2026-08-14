# creatures

Creatures and wildlife

## Metadata

- **Schema ID**: `creatures`
- **Schema File**: `schemas/creatures.schema.json`
- **Data File**: `data/creatures.json`
- **Total Items**: 13

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
| `actions` | Array<string> | ❌ | Action names this entity can perform |
| `traits` | Array<object> | ❌ | Traits and special properties |
| `hitPoints` | integer | ✅ | Hit points of this creature |

## Example

```json
{
  "id": "ba8b32f2-3916-43d0-937d-74168b846114",
  "source": "Salvage Union Workshop Manual",
  "name": "Irradiated Scorpion",
  "actions": [
    "Stinger"
  ],
  "hitPoints": 4,
  "page": 296,
  "additionalSources": [
    {
      "source": "Reclamation of the Wastes",
      "page": 109
    }
  ],
  "content": [
    {
      "type": "paragraph",
      "value": "Mutated beyond their usual size, they have been known to kill entire camps of wasters."
    }
  ]
}
```
