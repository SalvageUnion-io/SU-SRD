# keywords

Game keywords and terminology in Salvage Union

## Metadata

- **Schema ID**: `keywords`
- **Schema File**: `schemas/keywords.schema.json`
- **Data File**: `data/keywords.json`
- **Total Items**: 73

## Fields

| Field     | Type      | Required | Description |
| --------- | --------- | -------- | ----------- |
| `content` | `content` | ❌       |             |

## Example

```json
{
  "id": "be7568fc-8b20-4b81-9761-e8f352bbd20d",
  "source": "Salvage Union Workshop Manual",
  "name": "actions",
  "page": 20,
  "content": [
    {
      "type": "paragraph",
      "value": "Refers to Pilot, Mech, and NPC Abilities such as those Bio-Titans have. Often activated by spending Ability Points or Energy Points respectively to produce a variety of effects in play. Pilot Abilities may be used in a Mech unless otherwise stated."
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
