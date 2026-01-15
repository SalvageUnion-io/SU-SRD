# drones

Autonomous drones in Salvage Union

## Metadata

- **Schema ID**: `drones`
- **Schema File**: `schemas/drones.schema.json`
- **Data File**: `data/drones.json`
- **Total Items**: 9

## Fields

| Field     | Type      | Required | Description |
| --------- | --------- | -------- | ----------- |
| `systems` | `systems` | ✅       |             |

## Example

```json
{
  "id": "a2e4549e-d235-4647-9768-88372bf93afc",
  "source": "Salvage Union Workshop Manual",
  "name": "Defacer Drone",
  "systems": ["Hover Locomotion System", "Chainsaw Arm"],
  "techLevel": 1,
  "salvageValue": 1,
  "structurePoints": 2,
  "page": 274,
  "content": [
    {
      "type": "paragraph",
      "value": "Used for salvaging and crowd control, their distinctive buzzsaw sound has struck fear into many protesters."
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
- `shared/objects.schema.json#/definitions/mechanicalEntity`
