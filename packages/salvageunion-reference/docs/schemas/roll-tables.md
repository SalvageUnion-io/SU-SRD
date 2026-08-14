# roll-tables

Random tables and roll tables

## Metadata

- **Schema ID**: `roll-tables`
- **Schema File**: `schemas/roll-tables.schema.json`
- **Data File**: `data/roll-tables.json`
- **Total Items**: 96

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hasArtwork` | boolean | ❌ | Whether this entity has artwork; the .webp URL is derived from schema + slug |
| `content` | Array<object> | ❌ | Descriptive content for this roll table |
| `id` | string | ✅ | Unique identifier for this entity |
| `blackMarket` | boolean | ❌ | Whether this entity is only available on the black market |
| `name` | string | ✅ | Display name of this entity |
| `source` | string | ✅ | Primary source book this entity appears in |
| `page` | integer | ✅ | Page number in the primary source book |
| `booklet` | string | ❌ | Booklet code within a multi-booklet primary source (e.g. "CR", "PH", "PC", "RR", "AP" for the Salvage Union Starter Set). Omit for single-volume sources. |
| `additionalSources` | Array<object> | ❌ | Other source books where this entity is reprinted |
| `table` | object | object | object | object | object | object | object | object | object | ✅ | The roll table data with outcomes keyed by roll ranges |

## Example

```json
{
  "id": "fa9860bb-83c2-4d8c-b100-40708948257d",
  "source": "Salvage Union Workshop Manual",
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "CR",
      "page": 14
    }
  ],
  "name": "Core Mechanic",
  "table": {
    "1": {
      "label": "Cascade Failure",
      "value": "Something has gone terribly wrong. You suffer a severe consequence of the Mediator's choice. When attacking, you miss the target and suffer a Setback chosen by the Mediator."
    },
    "20": {
      "label": "Nailed it",
      "value": "You have overcome the odds and managed an outstanding success. You may achieve an additional bonus of your choice to the action. When dealing damage, you can choose to double it or pick another appropriate bonus effect."
    },
    "11-19": {
      "label": "Success",
      "value": "You have achieved your goal without any compromises. When attacking, you hit the target and deal standard damage."
    },
    "6-10": {
      "label": "Tough Choice",
      "value": "You succeed in your action, but at a cost. The Mediator gives you a Tough Choice with some kind of Setback attached. When attacking, you hit, but must make a Tough Choice."
    },
    "2-5": {
      "label": "Failure",
      "value": "You have failed at what you were attempting to do. You face a Setback of the Mediator's choice. When attacking, you miss the target."
    },
    "type": "standard"
  },
  "page": 232,
  "content": [
    {
      "type": "paragraph",
      "value": "When a player declares an action within the game that has an uncertain, risky, or potentially inter- esting outcome, they roll a 20-sided die. This is referred to as a d20, or 'the die'. Salvage Union only uses this one die, and it is all you need to resolve situations in the game."
    }
  ]
}
```
