# crawler-tech-levels

Tech levels for Union Crawlers in Salvage Union

## Metadata

- **Schema ID**: `crawler-tech-levels`
- **Schema File**: `schemas/crawler-tech-levels.schema.json`
- **Data File**: `data/crawler-tech-levels.json`
- **Total Items**: 6

## Fields

| Field             | Type    | Required | Description                                                |
| ----------------- | ------- | -------- | ---------------------------------------------------------- |
| `techLevel`       | integer | ✅       | Tech level (1-6)                                           |
| `structurePoints` | integer | ✅       | Structure points for this tech level                       |
| `populationMin`   | integer | ✅       | Minimum approximate population                             |
| `populationMax`   | integer | ✅       | Maximum approximate population (0 means unlimited/25,000+) |

## Example

```json
{
  "id": "c0ff9aa7-6c06-4022-809a-3297cfc0ba29",
  "name": "Hamlet Crawler",
  "techLevel": 1,
  "structurePoints": 20,
  "populationMin": 100,
  "populationMax": 500,
  "source": "Salvage Union Workshop Manual",
  "page": 218
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
