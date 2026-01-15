# squads

NPC squads and groups in Salvage Union

## Metadata

- **Schema ID**: `squads`
- **Schema File**: `schemas/squads.schema.json`
- **Data File**: `data/squads.json`
- **Total Items**: 9

## Fields

| Field        | Type           | Required | Description                                                   |
| ------------ | -------------- | -------- | ------------------------------------------------------------- |
| `hitPoints`  | `hitPoints`    | ❌       |                                                               |
| `actions`    | `actions`      | ✅       |                                                               |
| `traits`     | Array<`trait`> | ❌       | Special traits and properties of items, systems, or abilities |
| `damageType` | `damageType`   | ❌       |                                                               |

## Example

```json
{
  "id": "fa6feaf4-1202-4263-9e1a-a71a6f43a661",
  "source": "Salvage Union Workshop Manual",
  "name": "Waster Mob",
  "actions": [
    {
      "name": "Improvised Weapons",
      "range": ["Close"],
      "damage": {
        "amount": 4,
        "damageType": "HP"
      },
      "traits": [
        {
          "type": "melee"
        },
        {
          "type": "multi-attack",
          "amount": 2
        }
      ],
      "id": "63859850-7ffd-4449-b840-312fbbc05d61"
    },
    {
      "name": "Salvaging Tools",
      "id": "97acc3d5-6250-485c-8188-84523edc9365"
    }
  ],
  "hitPoints": 4,
  "damageType": "HP",
  "page": 300,
  "content": [
    {
      "type": "paragraph",
      "value": "A mob of wastelanders with improvised weapons."
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
