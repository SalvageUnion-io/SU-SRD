# keywords

Game keywords and terminology

## Metadata

- **Schema ID**: `keywords`
- **Schema File**: `schemas/keywords.schema.json`
- **Data File**: `data/keywords.json`
- **Total Items**: 82

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hasArtwork` | boolean | ❌ | Whether this entity has artwork; the .webp URL is derived from schema + slug |
| `content` | Array<object> | ❌ | Definition and explanation of this keyword |
| `id` | string | ✅ | Unique identifier for this entity |
| `blackMarket` | boolean | ❌ | Whether this entity is only available on the black market |
| `name` | string | ✅ | Display name of this entity |
| `source` | string | ✅ | Primary source book this entity appears in |
| `page` | integer | ✅ | Page number in the primary source book |
| `booklet` | string | ❌ | Booklet code within a multi-booklet primary source (e.g. "CR", "PH", "PC", "RR", "AP" for the Salvage Union Starter Set). Omit for single-volume sources. |
| `additionalSources` | Array<object> | ❌ | Other source books where this entity is reprinted |

## Example

```json
{
  "id": "be7568fc-8b20-4b81-9761-e8f352bbd20d",
  "source": "Salvage Union Workshop Manual",
  "name": "actions",
  "page": 20,
  "content": [
    {
      "type": "paragraph",
      "value": "Refers to Pilot, Mech, and NPC Abilities such as those Bio-Titans have. Often activated by spending Ability Points or Energy Points respectively to produce a variety of effects in play. Pilot Abilities may be used in a Mech unless otherwise stated."
    }
  ],
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "CR",
      "page": 37
    }
  ]
}
```
