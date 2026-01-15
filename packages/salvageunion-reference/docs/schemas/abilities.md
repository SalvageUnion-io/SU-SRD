# abilities

Pilot abilities and skills in Salvage Union

## Metadata

- **Schema ID**: `abilities`
- **Schema File**: `schemas/abilities.schema.json`
- **Data File**: `data/abilities.json`
- **Total Items**: 103

## Fields

| Field                | Type         | Required | Description |
| -------------------- | ------------ | -------- | ----------- | --- | --- |
| `description`        | string       | ❌       |             |
| `tree`               | `tree`       | ✅       |             |
| `level`              | integer      | string   | string      | ✅  |     |
| `mechActionType`     | `actionType` | ❌       |             |
| `grants`             | `grants`     | ❌       |             |
| `activationCurrency` | string       | ❌       |             |
| `actions`            | `actions`    | ❌       |             |

## Example

```json
{
  "id": "ef787157-c4d4-44bf-857f-71eec0db7939",
  "name": "Engineering Expertise",
  "source": "Salvage Union Workshop Manual",
  "tree": "Mechanical Knowledge",
  "level": 1,
  "page": 28,
  "actions": [
    {
      "id": "3c796591-3143-48ab-93a1-4aa6f3a8288c",
      "activationCost": 1,
      "actionType": "Turn",
      "name": "Engineering Expertise",
      "content": [
        {
          "value": "You are able to answer questions pertaining to mechanical and engineering topics. You may ask the Mediator two questions that cover these areas, and they must answer truthfully. You can use this Ability to ask for the full stats of any Mech Chassis, System, Module, or Pilot Equipment that you can see and interact with, as one of these questions."
        }
      ]
    }
  ],
  "description": "Ask questions pertaining to mechanical and engineering topics."
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
