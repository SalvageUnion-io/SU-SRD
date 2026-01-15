# ability-tree-requirements

Requirements for ability trees in Salvage Union

## Metadata

- **Schema ID**: `ability-tree-requirements`
- **Schema File**: `schemas/ability-tree-requirements.schema.json`
- **Data File**: `data/ability-tree-requirements.json`
- **Total Items**: 20

## Fields

| Field         | Type          | Required | Description                                             |
| ------------- | ------------- | -------- | ------------------------------------------------------- |
| `requirement` | Array<`tree`> | ✅       | List of ability tree names required to access this tree |

## Example

```json
{
  "id": "11bd8480-add9-4cbc-8982-cb7c3e5ab333",
  "name": "Advanced Engineer",
  "requirement": ["Mech-Tech"],
  "page": 26,
  "source": "Salvage Union Workshop Manual"
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
