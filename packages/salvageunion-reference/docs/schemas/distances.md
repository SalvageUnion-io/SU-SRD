# distances

Distances in Salvage Union are abstracted into the following Range categories. Both Pilots and Mechs use these Range categories for their movement as well as the effective distances for their weapons and other Abilities. The Mediator can factor in any other difference between the speed and distance of Pilots and Mechs based on the narrative and the situation.

## Metadata

- **Schema ID**: `distances`
- **Schema File**: `schemas/distances.schema.json`
- **Data File**: `data/distances.json`
- **Total Items**: 4

## Fields

| Field     | Type      | Required | Description |
| --------- | --------- | -------- | ----------- |
| `content` | `content` | ❌       |             |

## Example

```json
{
  "id": "d1a2b3c4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  "source": "Salvage Union Workshop Manual",
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

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
