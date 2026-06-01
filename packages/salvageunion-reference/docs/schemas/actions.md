# actions

Actions, abilities, and attacks that can be performed

## Metadata

- **Schema ID**: `actions`
- **Schema File**: `schemas/actions.schema.json`
- **Data File**: `data/actions.json`
- **Total Items**: 688

## Example

```json
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
  ],
  "actionSource": "systems",
  "actionType": "Turn"
}
```

## Schema Composition

This schema extends the following definitions:
