# actions

Actions, abilities, and attacks that can be performed

## Metadata

- **Schema ID**: `actions`
- **Schema File**: `schemas/actions.schema.json`
- **Data File**: `data/actions.json`
- **Total Items**: 687

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier for this action |
| `name` | string | ✅ | Display name of this action |
| `content` | Array<object> | ❌ | Descriptive content for this action |
| `structurePoints` | number | ❌ | SP modifier from this action |
| `energyPoints` | number | ❌ | EP modifier from this action |
| `heatCapacity` | number | ❌ | Heat capacity modifier from this action |
| `systemSlots` | number | ❌ | System slot modifier from this action |
| `moduleSlots` | number | ❌ | Module slot modifier from this action |
| `cargoCapacity` | number | ❌ | Cargo capacity modifier from this action |
| `techLevel` | unknown | ❌ | Technology level of the item or entity (integer 1-6, 'B' for Bio, or 'N' for Nanite) |
| `salvageValue` | number | ❌ | Scrap value when salvaged |
| `displayName` | string | ❌ | Alternative display name for this action |
| `activationCost` | unknown | ❌ | AP cost to activate this action |
| `range` | Array<string> | ❌ | Range bands for this action |
| `actionType` | string | ❌ | Type of action (Turn, Free, Reaction, etc.) |
| `traits` | Array<object> | ❌ | Traits applied by this action |
| `damage` | object | ❌ | Damage dealt by this action |
| `choices` | Array<object> | ❌ | Choices presented by this action |
| `table` | object | object | object | object | object | object | object | object | object | ❌ | Embedded roll table for this action |
| `tableName` | string | ❌ | Reference to a roll table name |
| `hidden` | boolean | ❌ | If true, this action will not affect the rendering of the entity display |
| `activationCurrency` | string | ❌ | Currency type used for activation (EP or AP, SP or HP, Variable) |
| `source` | string | ❌ | Source book for this action |
| `page` | integer | ❌ | Page number in the source book |
| `actionSource` | string | ❌ | Schema this action originates from |
| `drone` | string | ❌ | Drone name this action is associated with |

## Example

```json
{
  "id": "696b540c-310b-497d-a6eb-191b4d80bc6f",
  "range": [
    "Close"
  ],
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
