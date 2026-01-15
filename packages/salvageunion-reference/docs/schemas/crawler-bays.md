# crawler-bays

Bays and facilities on Union Crawlers in Salvage Union

## Metadata

- **Schema ID**: `crawler-bays`
- **Schema File**: `schemas/crawler-bays.schema.json`
- **Data File**: `data/crawler-bays.json`
- **Total Items**: 10

## Fields

| Field           | Type            | Required | Description                                                   |
| --------------- | --------------- | -------- | ------------------------------------------------------------- |
| `damagedEffect` | string          | ✅       | Effect when this bay is damaged                               |
| `npc`           | `npc`           | ✅       |                                                               |
| `choices`       | Array<`choice`> | ❌       | Choices available to the player when interacting with the NPC |
| `table`         | `table`         | ❌       |                                                               |

## Example

```json
{
  "id": "233d7930-1c4d-475d-9ea8-c88a1c70350c",
  "name": "Command Bay",
  "source": "Salvage Union Workshop Manual",
  "damagedEffect": "If the Command Bay is damaged your Union Crawler can no longer move, and its scanning and map functions no longer work. You are in the dark when it comes to conducting missions outside of the immediate area.",
  "page": 221,
  "npc": {
    "position": "Princeps",
    "hitPoints": 4,
    "choices": [
      {
        "id": "f99d2c89-3bd5-4573-a7d0-1b608f93467b",
        "name": "Keepsake",
        "content": [
          {
            "type": "paragraph",
            "value": "A Keepsake is a personal item that represents something important to the NPC. It could be a memento from their past, a family heirloom, or something they have worked hard to acquire. The Keepsake is a reminder of the NPC's history and personality."
          }
        ]
      },
      {
        "id": "f64fd72a-ae30-4712-b36b-3c690c98ccb0",
        "name": "Motto",
        "content": [
          {
            "type": "paragraph",
            "value": "A Motto is a personal saying or phrase that represents the NPC's personality or beliefs. It could be something they live by, or something they are trying to achieve. The Motto is a reminder of the NPC's personality and goals."
          }
        ]
      }
    ],
    "content": [
      {
        "type": "paragraph",
        "value": "The Command Bay is operated and maintained by the Bridge Crew, the most experienced of whom is known as the Princeps."
      }
    ]
  },
  "content": [
    {
      "type": "paragraph",
      "value": "This area of your Union Crawler is where the core of the crew that controls your Union Crawler resides. It is also designed for surveying and planning out forays into the wasteland. It allows you to scan the area within the Campaign Map and get a simple holomap of the environment and any key points of interest."
    }
  ]
}
```

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
