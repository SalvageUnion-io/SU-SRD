# equipment

Pilot equipment and gear in Salvage Union

## Metadata

- **Schema ID**: `equipment`
- **Schema File**: `schemas/equipment.schema.json`
- **Data File**: `data/equipment.json`
- **Total Items**: 47

## Fields

| Field               | Type                | Required | Description |
| ------------------- | ------------------- | -------- | ----------- |
| `bonusPerTechLevel` | `bonusPerTechLevel` | ❌       |             |
| `choices`           | `choices`           | ❌       |             |
| `actions`           | `actions`           | ✅       |             |

## Example

```json
{
  "id": "2ad40fb2-ab1f-4a0e-b974-1abef4f5fbee",
  "source": "Salvage Union Workshop Manual",
  "name": "First Aid Kit",
  "techLevel": 1,
  "page": 78,
  "actions": [
    {
      "id": "907d2ca2-f355-458f-9852-8923f19ab1af",
      "traits": [
        {
          "type": "uses",
          "amount": 3
        }
      ],
      "range": ["Close"],
      "name": "First Aid Kit",
      "content": [
        {
          "type": "paragraph",
          "value": "This set of bandages, plasters, gauze, painkillers, and antiseptics allows you to patch up wounds in the field."
        },
        {
          "type": "paragraph",
          "value": "A target creature of your choice in Range regains 3 Hit Points. If they were on 0 Hit Points this restores them to consciousness with 3 HP."
        },
        {
          "type": "paragraph",
          "value": "*Union Safety Guideline 305.15 recommends each Union Crawler salvage crew equip a First Aid Kit for all active field work.*"
        }
      ]
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
- `shared/objects.schema.json#/definitions/equipmentStats`
