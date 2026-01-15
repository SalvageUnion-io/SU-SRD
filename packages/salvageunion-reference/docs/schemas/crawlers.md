# crawlers

Crawler vehicles in Salvage Union

## Metadata

- **Schema ID**: `crawlers`
- **Schema File**: `schemas/crawlers.schema.json`
- **Data File**: `data/crawlers.json`
- **Total Items**: 5

## Fields

| Field     | Type      | Required | Description |
| --------- | --------- | -------- | ----------- |
| `npc`     | `npc`     | ✅       |             |
| `actions` | `actions` | ✅       |             |

## Example

```json
{
  "id": "8bffb508-8c8f-418d-b6ce-f24f7266e41b",
  "name": "Augmented",
  "source": "Salvage Union Workshop Manual",
  "npc": {
    "position": "Union Crawler A.I.",
    "hitPoints": 0,
    "choices": [
      {
        "id": "c7e2b66a-6b62-446d-90ff-11873089bfe0",
        "name": "A.I. Personality",
        "content": [
          {
            "type": "paragraph",
            "value": "Roll on the A.I. Personality Table for their personality."
          }
        ]
      }
    ],
    "content": [
      {
        "type": "paragraph",
        "value": "Your Union Crawler has an advanced, intelligent A.I. on board which controls its core functions. The A.I. is jacked into the Corpo Net, once per Downtime you can ask them two questions about any topic and they will answer you truthfully. Name your A.I. and roll on the A.I. Personality Table for their personality."
      }
    ]
  },
  "actions": [
    {
      "name": "Crawler Wide Augments",
      "id": "8d09b52e-0bd9-4d26-bbd9-40c9f29abdc5",
      "content": [
        {
          "type": "paragraph",
          "value": "Every Pilot on the Union Crawler may train any Pilot Ability from the Augment Ability Tree in addition to their other abilities. When you choose this Crawler Type during character creation all Pilots gain an additional Training Point which they may only spend on the Augment Ability Tree."
        }
      ]
    }
  ],
  "page": 216,
  "content": [
    {
      "type": "paragraph",
      "value": "Nearly everyone on your Union Crawler is augmented in some way and your medical technicians are able to implement a variety of body modifications with ease."
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
