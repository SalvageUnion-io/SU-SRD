# npcs

Non-player characters and people in Salvage Union

## Metadata

- **Schema ID**: `npcs`
- **Schema File**: `schemas/npcs.schema.json`
- **Data File**: `data/npcs.json`
- **Total Items**: 6

## Fields

| Field       | Type        | Required | Description |
| ----------- | ----------- | -------- | ----------- |
| `hitPoints` | `hitPoints` | ✅       |             |

## Example

```json
{
  "id": "c6bfc845-b1dc-43e9-8f79-fd4854842949",
  "source": "Salvage Union Workshop Manual",
  "name": "Wastelander",
  "asset_url": "https://opxrguskxuogghzcnppk.supabase.co/storage/v1/object/public/LP-Assets/npcs/wastelander.jpg",
  "actions": [
    {
      "name": "Improvised Melee Weapon",
      "range": ["Close"],
      "damage": {
        "amount": 2,
        "damageType": "HP"
      },
      "traits": [
        {
          "type": "melee"
        }
      ],
      "id": "481f14da-1d3a-49c1-a973-68051980c042"
    },
    {
      "name": "Salvaging Tools",
      "id": "28704d5b-7842-4bdd-b1ce-5373822dfaaf"
    }
  ],
  "hitPoints": 2,
  "page": 53,
  "content": [
    {
      "type": "paragraph",
      "value": "Represents the myriad of common denizens of the wastelands."
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
- `shared/objects.schema.json#/definitions/combatEntity`
