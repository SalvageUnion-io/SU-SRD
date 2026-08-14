# crawler-bays

Bays and facilities on Union Crawlers

## Metadata

- **Schema ID**: `crawler-bays`
- **Schema File**: `schemas/crawler-bays.schema.json`
- **Data File**: `data/crawler-bays.json`
- **Total Items**: 14

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hasArtwork` | boolean | ❌ | Whether this entity has artwork; the .webp URL is derived from schema + slug |
| `content` | Array<object> | ❌ | Descriptive content blocks for this entity |
| `id` | string | ✅ | Unique identifier for this entity |
| `blackMarket` | boolean | ❌ | Whether this entity is only available on the black market |
| `name` | string | ✅ | Display name of this entity |
| `source` | string | ✅ | Primary source book this entity appears in |
| `page` | integer | ✅ | Page number in the primary source book |
| `booklet` | string | ❌ | Booklet code within a multi-booklet primary source (e.g. "CR", "PH", "PC", "RR", "AP" for the Salvage Union Starter Set). Omit for single-volume sources. |
| `additionalSources` | Array<object> | ❌ | Other source books where this entity is reprinted |
| `expansion` | boolean | ❌ | True for expansion "upgrade"/found bays acquired during play (built for a resource cost or found as a scenario facility); absent/false for base facilities pre-installed on every Union Crawler. A stored data tag (mirrors the legalStarting convention) — never computed from source/cost/techLevel. |
| `damagedEffect` | string | ❌ | Effect when this bay is damaged |
| `npc` | object | ❌ | NPC crew member who operates this bay |
| `techLevel` | unknown | ❌ | Tech level of this bay |
| `salvageValue` | integer | ❌ | Scrap value when this bay is salvaged |
| `cost` | object | ❌ | Resource cost to build or add this bay to a Union Crawler |
| `choices` | Array<object> | ❌ | Choices available to the player when interacting with the NPC |
| `tableName` | string | ❌ | Reference to a roll table name |

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
        "id": "b8cee691-8fc9-4f0b-8e37-84c600a529f4",
        "source": {
          "kind": "text"
        },
        "name": "Name",
        "content": [
          {
            "type": "paragraph",
            "value": "The name of the NPC."
          }
        ]
      },
      {
        "id": "5118fa1c-a291-4bee-a91c-3e2a4fcc1730",
        "source": {
          "kind": "text",
          "multiline": true
        },
        "name": "Description",
        "content": [
          {
            "type": "paragraph",
            "value": "A brief description of the NPC's appearance and personality."
          }
        ]
      },
      {
        "id": "f99d2c89-3bd5-4573-a7d0-1b608f93467b",
        "source": {
          "kind": "text",
          "multiline": true
        },
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
        "source": {
          "kind": "text",
          "multiline": true
        },
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
    },
    {
      "type": "paragraph",
      "value": "Once per Downtime, before you set out into the wasteland, you may ask the Mediator a number of questions equal to the Tech Level of your Union Crawler about the area of the Region Map you are in, and they will answer you truthfully."
    },
    {
      "type": "paragraph",
      "value": "If the Command Bay is damaged your Union Crawler can no longer move, and its scanning and map functions no longer work. You are in the dark when it comes to conducting missions outside of the immediate area."
    }
  ],
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "PH",
      "page": 57
    }
  ]
}
```
