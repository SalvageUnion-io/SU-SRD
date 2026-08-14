# ability-tree-requirements

Requirements for unlocking ability trees

## Metadata

- **Schema ID**: `ability-tree-requirements`
- **Schema File**: `schemas/ability-tree-requirements.schema.json`
- **Data File**: `data/ability-tree-requirements.json`
- **Total Items**: 20

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
| `requirement` | Array<string> | ✅ | List of ability tree names required to access this tree |

## Example

```json
{
  "id": "11bd8480-add9-4cbc-8982-cb7c3e5ab333",
  "name": "Advanced Engineer",
  "requirement": [
    "Mech-Tech"
  ],
  "page": 26,
  "source": "Salvage Union Workshop Manual"
}
```
