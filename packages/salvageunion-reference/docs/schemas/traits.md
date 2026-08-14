# traits

Traits and special properties

## Metadata

- **Schema ID**: `traits`
- **Schema File**: `schemas/traits.schema.json`
- **Data File**: `data/traits.json`
- **Total Items**: 48

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hasArtwork` | boolean | ❌ | Whether this entity has artwork; the .webp URL is derived from schema + slug |
| `content` | Array<object> | ❌ | Definition and rules for this trait |
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
  "id": "ceda0aba-bd8e-4123-ad96-83f68acdac48",
  "source": "Salvage Union Workshop Manual",
  "name": "amphibious",
  "page": 118,
  "content": [
    {
      "type": "paragraph",
      "value": "Anything with this Trait can move, function and survive underwater and on land."
    }
  ],
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "CR",
      "page": 34
    }
  ]
}
```
