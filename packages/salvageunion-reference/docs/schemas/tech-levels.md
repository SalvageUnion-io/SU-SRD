# tech-levels

Tech level descriptions

## Metadata

- **Schema ID**: `tech-levels`
- **Schema File**: `schemas/tech-levels.schema.json`
- **Data File**: `data/tech-levels.json`
- **Total Items**: 6

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hasArtwork` | boolean | ❌ | Whether this entity has artwork; the .webp URL is derived from schema + slug |
| `content` | Array<object> | ❌ | Descriptive content for this tech level |
| `id` | string | ✅ | Unique identifier for this entity |
| `blackMarket` | boolean | ❌ | Whether this entity is only available on the black market |
| `name` | string | ✅ | Display name of this entity |
| `source` | string | ✅ | Primary source book this entity appears in |
| `page` | integer | ✅ | Page number in the primary source book |
| `booklet` | string | ❌ | Booklet code within a multi-booklet primary source (e.g. "CR", "PH", "PC", "RR", "AP" for the Salvage Union Starter Set). Omit for single-volume sources. |
| `additionalSources` | Array<object> | ❌ | Other source books where this entity is reprinted |
| `techLevel` | integer | ✅ | Numeric tech level value |

## Example

```json
{
  "id": "496b0ce2-c154-41c1-9d77-08bc9d2149b3",
  "name": "Tech 1",
  "techLevel": 1,
  "source": "Salvage Union Workshop Manual",
  "page": 162,
  "content": [
    {
      "type": "paragraph",
      "value": "Basic industrial equipment, simple mechanisms, antique, obsolete, or scrap built weaponry."
    }
  ]
}
```
