# systems

Mech systems in Salvage Union

## Metadata

- **Schema ID**: `systems`
- **Schema File**: `schemas/systems.schema.json`
- **Data File**: `data/systems.json`
- **Total Items**: 96

## Example

```json
{
  "id": "418deda4-ab48-4bc4-a527-d56f4d77746e",
  "source": "Salvage Union Workshop Manual",
  "name": ".50 Cal Machine Gun",
  "techLevel": 1,
  "slotsRequired": 2,
  "salvageValue": 2,
  "page": 164,
  "actions": [
    {
      "id": "696b540c-310b-497d-a6eb-191b4d80bc6f",
      "range": ["Close"],
      "damage": {
        "damageType": "SP",
        "amount": 2
      },
      "traits": [
        {
          "type": "ballistic"
        },
        {
          "type": "jamming"
        },
        {
          "type": "pinning"
        }
      ],
      "name": ".50 Cal Machine Gun",
      "content": [
        {
          "type": "paragraph",
          "value": "This simple ballistic weapon of the Opus Institute design fires solid, high calibre rounds that can puncture a Mech hull and shred through infantry. It has been a mainstay of battlefields for as long as anyone remembers and remains ubiquitous today."
        },
        {
          "type": "paragraph",
          "value": "Make a ranged attack against a target within Range."
        }
      ]
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/systemModule`
- `shared/objects.schema.json#/definitions/baseEntity`
