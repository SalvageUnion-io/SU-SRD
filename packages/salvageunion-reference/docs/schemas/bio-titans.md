# bio-titans

Mech-scale biological monsters

## Metadata

- **Schema ID**: `bio-titans`
- **Schema File**: `schemas/bio-titans.schema.json`
- **Data File**: `data/bio-titans.json`
- **Total Items**: 12

## Fields

| Field               | Type          | Required | Description                                                                                                                                               |
| ------------------- | ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assetExtension`    | string        | ❌       | Image file extension; the URL is derived from the entity schema + slug                                                                                    |
| `content`           | Array<object> | ❌       | Descriptive content blocks for this entity                                                                                                                |
| `id`                | string        | ✅       | Unique identifier for this entity                                                                                                                         |
| `indexable`         | boolean       | ✅       | Whether this entity appears in search results                                                                                                             |
| `blackMarket`       | boolean       | ✅       | Whether this entity is only available on the black market                                                                                                 |
| `name`              | string        | ✅       | Display name of this entity                                                                                                                               |
| `source`            | string        | ✅       | Primary source book this entity appears in                                                                                                                |
| `page`              | integer       | ✅       | Page number in the primary source book                                                                                                                    |
| `booklet`           | string        | ❌       | Booklet code within a multi-booklet primary source (e.g. "CR", "PH", "PC", "RR", "AP" for the Salvage Union Starter Set). Omit for single-volume sources. |
| `additionalSources` | Array<object> | ❌       | Other source books where this entity is reprinted                                                                                                         |
| `structurePoints`   | integer       | ✅       | Structure points of this bio-titan                                                                                                                        |
| `actions`           | Array<string> | ✅       | Action names this bio-titan can perform                                                                                                                   |
| `systems`           | Array<string> | ❌       | Mech system names this bio-titan is equipped with                                                                                                         |
| `modules`           | Array<string> | ❌       | Mech module names this bio-titan is equipped with                                                                                                         |
| `traits`            | Array<object> | ❌       | Traits and special properties                                                                                                                             |

## Example

```json
{
  "id": "8e5b04e5-9532-48c1-86ae-5960da416ede",
  "source": "Salvage Union Workshop Manual",
  "name": "Scylla",
  "actions": [
    "Scythe Attack",
    "Tail Sweep",
    "Climb",
    "Armour Plating (Scylla)",
    "Ambush Predator",
    "Titanic Actions (Scylla)"
  ],
  "structurePoints": 39,
  "assetExtension": "jpg",
  "page": 276,
  "content": [
    {
      "type": "paragraph",
      "value": "A gigantic, armoured, arachnid-like predator beast. It has no concept that the war it was designed to fight ended aeons ago, and continues to tear apart anything that enters into its mountainous domain."
    }
  ]
}
```
