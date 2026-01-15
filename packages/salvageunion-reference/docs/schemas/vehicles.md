# vehicles

Conventional vehicles in Salvage Union

## Metadata

- **Schema ID**: `vehicles`
- **Schema File**: `schemas/vehicles.schema.json`
- **Data File**: `data/vehicles.json`
- **Total Items**: 7

## Fields

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |

## Example

```json
{
  "id": "c1d53d2d-9abd-4a72-8e78-2674eb7d7329",
  "source": "Salvage Union Workshop Manual",
  "name": "Power Loader",
  "systems": ["Locomotion System", "Rigging Arm"],
  "techLevel": 1,
  "salvageValue": 1,
  "structurePoints": 1,
  "page": 292,
  "content": [
    {
      "type": "paragraph",
      "value": "A pneumatically powered heavy loader for moving cargo."
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
- `shared/objects.schema.json#/definitions/mechanicalEntity`
