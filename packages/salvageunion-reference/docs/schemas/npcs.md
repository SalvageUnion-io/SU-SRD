# npcs

Non-player characters and people

## Metadata

- **Schema ID**: `npcs`
- **Schema File**: `schemas/npcs.schema.json`
- **Data File**: `data/npcs.json`
- **Total Items**: 19

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
| `hitPoints` | integer | ✅ | Hit points (HP) or structure points (SP) of this NPC; see damageType to disambiguate. |
| `damageType` | string | ❌ | Whether this NPC tracks HP (organic) or SP (mechanical/cybernetic). Defaults to HP when omitted. |
| `bioSalvageValue` | integer | ❌ | Bio-salvage value for Chimerium mutants |

## Example

```json
{
  "id": "c6bfc845-b1dc-43e9-8f79-fd4854842949",
  "source": "Salvage Union Workshop Manual",
  "name": "Wastelander",
  "hasArtwork": true,
  "actions": [
    "Improvised Melee Weapon (Wastelander)",
    "Salvaging Tools (NPC)"
  ],
  "hitPoints": 2,
  "page": 298,
  "additionalSources": [
    {
      "source": "Reclamation of the Wastes",
      "page": 104
    }
  ],
  "content": [
    {
      "type": "paragraph",
      "value": "Represents the myriad of common denizens of the wastelands."
    }
  ]
}
```
