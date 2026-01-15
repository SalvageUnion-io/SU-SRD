# creatures

Creatures and wildlife in Salvage Union

## Metadata

- **Schema ID**: `creatures`
- **Schema File**: `schemas/creatures.schema.json`
- **Data File**: `data/creatures.json`
- **Total Items**: 6

## Fields

| Field       | Type        | Required | Description |
| ----------- | ----------- | -------- | ----------- |
| `hitPoints` | `hitPoints` | ✅       |             |

## Example

```json
{
  "id": "ba8b32f2-3916-43d0-937d-74168b846114",
  "source": "Salvage Union Workshop Manual",
  "name": "Irradiated Scorpion",
  "actions": [
    {
      "name": "Stinger",
      "range": ["Close"],
      "damage": {
        "amount": 2,
        "damageType": "HP"
      },
      "traits": [
        {
          "type": "melee"
        },
        {
          "type": "poison"
        },
        {
          "type": "deadly (creatures only)"
        }
      ],
      "id": "110f09d1-2f84-4ec5-a9a2-df36461bde75"
    }
  ],
  "hitPoints": 4,
  "page": 296,
  "content": [
    {
      "type": "paragraph",
      "value": "Mutated beyond their usual size, they have been known to kill entire camps of wasters."
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
- `shared/objects.schema.json#/definitions/combatEntity`
