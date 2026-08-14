# crawlers

Union Crawler mobile bases

## Metadata

- **Schema ID**: `crawlers`
- **Schema File**: `schemas/crawlers.schema.json`
- **Data File**: `data/crawlers.json`
- **Total Items**: 5

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
| `npc` | object | ✅ | NPC commander of this crawler |
| `actions` | Array<string> | ✅ | Action names this crawler can perform |
| `mutations` | Array<object> | ❌ | Rule mutations applied by this crawler type |

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
        "id": "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b",
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
        "id": "19f65af2-84ba-48f4-886f-e3847e257d23",
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
        "id": "c7e2b66a-6b62-446d-90ff-11873089bfe0",
        "source": {
          "kind": "table",
          "rollTable": "A.I. Personality",
          "orChooseOwn": true
        },
        "name": "A.I. Personality",
        "lifetime": "permanent",
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
        "value": "Your Union Crawler has an advanced, intelligent A.I. on board which controls its core functions. The A.I. is jacked into the Corpo Net, once per Downtime you can ask them two questions about any topic and they will answer you truthfully."
      }
    ]
  },
  "actions": [
    "Crawler Wide Augments"
  ],
  "page": 216,
  "content": [
    {
      "type": "paragraph",
      "value": "Nearly everyone on your Union Crawler is augmented in some way and your medical technicians are able to implement a variety of body modifications with ease."
    }
  ],
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "PH",
      "page": 52
    }
  ]
}
```
