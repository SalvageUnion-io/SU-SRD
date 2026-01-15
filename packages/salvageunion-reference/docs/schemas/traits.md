# traits

Traits and special properties in Salvage Union

## Metadata

- **Schema ID**: `traits`
- **Schema File**: `schemas/traits.schema.json`
- **Data File**: `data/traits.json`
- **Total Items**: 43

## Fields

| Field     | Type      | Required | Description |
| --------- | --------- | -------- | ----------- |
| `content` | `content` | ❌       |             |

## Example

```json
{
  "id": "ceda0aba-bd8e-4123-ad96-83f68acdac48",
  "source": "Salvage Union Workshop Manual",
  "name": "amphibious",
  "page": 118,
  "content": [
    {
      "type": "paragraph",
      "value": "Anything with this Trait can move, function and survive underwater and on land."
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
