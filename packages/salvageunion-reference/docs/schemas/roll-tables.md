# roll-tables

Random tables and roll tables in Salvage Union

## Metadata

- **Schema ID**: `roll-tables`
- **Schema File**: `schemas/roll-tables.schema.json`
- **Data File**: `data/roll-tables.json`
- **Total Items**: 22

## Fields

| Field     | Type      | Required | Description                           |
| --------- | --------- | -------- | ------------------------------------- |
| `section` | string    | ✅       | Section or category of the roll table |
| `table`   | `table`   | ✅       |                                       |
| `content` | `content` | ❌       |                                       |

## Example

```json
{
  "id": "fa9860bb-83c2-4d8c-b100-40708948257d",
  "source": "Salvage Union Workshop Manual",
  "name": "Core Mechanic",
  "section": "core",
  "table": {
    "1": "Cascade Failure: Something has gone terribly wrong. You suffer a severe consequence of the Mediator’s choice. When attacking, you miss the target and suffer a Setback chosen by the Mediator.",
    "20": "Nailed it: You have overcome the odds and managed an outstanding success. You may achieve an additional bonus of your choice to the action. When dealing damage, you can choose to double it or pick another appropriate bonus effect.",
    "11-19": "Success: You have achieved your goal without any compromises. When attacking, you hit the target and deal standard damage.",
    "6-10": "Tough Choice: You succeed in your action, but at a cost. The Mediator gives you a Tough Choice with some kind of Setback attached. When attacking, you hit, but must make a Tough Choice.",
    "2-5": "Failure: You have failed at what you were attempting to do. You face a Setback of the Mediator’s choice. When attacking, you miss the target.",
    "type": "standard"
  },
  "page": 2,
  "content": [
    {
      "type": "paragraph",
      "value": "When a player declares an action within the game that has an uncertain, risky, or potentially inter- esting outcome, they roll a 20-sided die. This is referred to as a d20, or ‘the die’. Salvage Union only uses this one die, and it is all you need to resolve situations in the game."
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
