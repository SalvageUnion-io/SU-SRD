# catalog-categories

Catalog categories for organizing schemas in the UI

## Metadata

- **Schema ID**: `catalog-categories`
- **Schema File**: `schemas/catalog-categories.schema.json`
- **Data File**: `data/catalog-categories.json`
- **Total Items**: 6

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier for this catalog category |
| `name` | string | ✅ | Display name of this catalog category |
| `schemas` | Array<string> | ✅ | Schema collections included in this category |
| `flat` | boolean | ✅ | Whether to display schemas in a flat list |

## Example

```json
{
  "id": "pilot",
  "name": "Pilot",
  "schemas": [
    "classes",
    "abilities",
    "equipment"
  ]
}
```
