# meld

Meld-infected creatures

## Metadata

- **Schema ID**: `meld`
- **Schema File**: `schemas/meld.schema.json`
- **Data File**: `data/meld.json`
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
| `actions` | Array<string> | ✅ | Action names this meld creature can perform |
| `traits` | Array<object> | ❌ | Traits and special properties |
| `salvageValue` | integer | ❌ | Scrap value when salvaged |
| `hitPoints` | integer | ❌ | Hit points of this meld creature |
| `structurePoints` | integer | ❌ | Structure points of this meld creature |

## Example

```json
{
  "id": "f04d6f2a-723a-45ec-91be-23be3b8275fa",
  "source": "Salvage Union Workshop Manual",
  "name": "Meld Drone",
  "actions": [
    "Bite"
  ],
  "salvageValue": 1,
  "hitPoints": 3,
  "page": 289,
  "additionalSources": [
    {
      "source": "Reclamation of the Wastes",
      "page": 113
    }
  ],
  "content": [
    {
      "type": "paragraph",
      "value": "Meld when they take over a biological organism, around the size of a human. The brain is sludged, only the stem remains, they become a peon of the swarm."
    }
  ]
}
```
