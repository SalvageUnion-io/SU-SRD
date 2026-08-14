# crawler-tech-levels

Tech level progression for Union Crawlers

## Metadata

- **Schema ID**: `crawler-tech-levels`
- **Schema File**: `schemas/crawler-tech-levels.schema.json`
- **Data File**: `data/crawler-tech-levels.json`
- **Total Items**: 6

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
| `techLevel` | integer | ✅ | Tech level (1-6) |
| `structurePoints` | integer | ✅ | Structure points at this tech level |
| `upkeepCost` | integer | ✅ | Scrap multiplier for upkeep (e.g. 5 means 5× Tech N Scrap) |
| `upgradeCost` | unknown | ✅ | Scrap multiplier for upgrade (e.g. 30 means 30× Tech N Scrap), null if max tech level |
| `populationMin` | integer | ✅ | Minimum approximate population |
| `populationMax` | unknown | ✅ | Maximum approximate population (null means unbounded — 25,000+) |

## Example

```json
{
  "id": "c0ff9aa7-6c06-4022-809a-3297cfc0ba29",
  "name": "Hamlet Crawler",
  "techLevel": 1,
  "structurePoints": 20,
  "upkeepCost": 5,
  "upgradeCost": 30,
  "populationMin": 100,
  "populationMax": 500,
  "source": "Salvage Union Workshop Manual",
  "page": 218
}
```
