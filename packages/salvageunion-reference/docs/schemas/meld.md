# meld

Meld-infected creatures in Salvage Union

## Metadata

- **Schema ID**: `meld`
- **Schema File**: `schemas/meld.schema.json`
- **Data File**: `data/meld.json`
- **Total Items**: 5

## Fields

| Field             | Type           | Required | Description                                                   |
| ----------------- | -------------- | -------- | ------------------------------------------------------------- |
| `actions`         | `actions`      | ✅       |                                                               |
| `traits`          | Array<`trait`> | ❌       | Special traits and properties of items, systems, or abilities |
| `salvageValue`    | integer        | ❌       | Salvage value of the meld creature                            |
| `hitPoints`       | integer        | ❌       | Hit points of the meld creature                               |
| `structurePoints` | integer        | ❌       | Structure points of the meld creature                         |

## Example

```json
{
  "id": "f04d6f2a-723a-45ec-91be-23be3b8275fa",
  "source": "Salvage Union Workshop Manual",
  "name": "Meld Drone",
  "actions": [
    {
      "name": "Bite",
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
          "type": "meld infection"
        }
      ],
      "id": "5db10ab3-6099-4c8e-82df-fc4f9b18eb18",
      "content": [
        {
          "type": "paragraph",
          "value": "The Meld Drone mindlessly attacks the target with teeth and claw."
        }
      ]
    }
  ],
  "salvageValue": 1,
  "hitPoints": 3,
  "page": 289,
  "content": [
    {
      "type": "paragraph",
      "value": "Meld when they take over a biological organism, around the size of a human. The brain is sludged, only the stem remains, they become a peon of the swarm."
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
