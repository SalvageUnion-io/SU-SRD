# distances

Distance bands and ranges

## Metadata

- **Schema ID**: `distances`
- **Schema File**: `schemas/distances.schema.json`
- **Data File**: `data/distances.json`
- **Total Items**: 4

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hasArtwork` | boolean | ❌ | Whether this entity has artwork; the .webp URL is derived from schema + slug |
| `content` | Array<object> | ❌ | Descriptive content for this distance band |
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
  "id": "844461f9-db56-4ce3-9a8b-aa7600f6cc06",
  "source": "Salvage Union Workshop Manual",
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "CR",
      "page": 20
    }
  ],
  "name": "Close",
  "page": 237,
  "content": [
    {
      "type": "paragraph",
      "value": "You are a few good strides from the target and can see it clearly and identifiably, and are able to circle it."
    },
    {
      "type": "paragraph",
      "value": "You are able to launch into a melee attack at this Range, and are in Range to attack with weapons such as the .50 Cal Machine Gun, Red Laser, and Monomolecular Blade."
    }
  ]
}
```
