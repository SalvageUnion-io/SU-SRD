# titans

Mech-scale single-threat enemies (monsters and bosses)

## Metadata

- **Schema ID**: `titans`
- **Schema File**: `schemas/titans.schema.json`
- **Data File**: `data/titans.json`
- **Total Items**: 13

## Fields

| Field               | Type          | Required | Description                                                                                                                                               |
| ------------------- | ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset_url`         | string        | ❌       | URL to an image asset for this entity                                                                                                                     |
| `content`           | Array<object> | ❌       | Descriptive content blocks for this entity                                                                                                                |
| `id`                | string        | ✅       | Unique identifier for this entity                                                                                                                         |
| `indexable`         | boolean       | ✅       | Whether this entity appears in search results                                                                                                             |
| `blackMarket`       | boolean       | ✅       | Whether this entity is only available on the black market                                                                                                 |
| `name`              | string        | ✅       | Display name of this entity                                                                                                                               |
| `source`            | string        | ✅       | Primary source book this entity appears in                                                                                                                |
| `page`              | integer       | ✅       | Page number in the primary source book                                                                                                                    |
| `booklet`           | string        | ❌       | Booklet code within a multi-booklet primary source (e.g. "CR", "PH", "PC", "RR", "AP" for the Salvage Union Starter Set). Omit for single-volume sources. |
| `additionalSources` | Array<object> | ❌       | Other source books where this entity is reprinted                                                                                                         |
| `kind`              | string        | ✅       | Monster (instinctual creature) or Boss (named antagonist with goals and motivations)                                                                      |
| `structurePoints`   | integer       | ✅       | Structure points of this titan                                                                                                                            |
| `actions`           | Array<string> | ✅       | Action names this titan can perform                                                                                                                       |
| `systems`           | Array<string> | ❌       | Mech system names this titan is equipped with                                                                                                             |
| `modules`           | Array<string> | ❌       | Mech module names this titan is equipped with                                                                                                             |
| `traits`            | Array<object> | ❌       | Traits and special properties                                                                                                                             |

## Example

```json
{
  "id": "8e5b04e5-9532-48c1-86ae-5960da416ede",
  "source": "Salvage Union Workshop Manual",
  "name": "Scylla",
  "kind": "monster",
  "actions": [
    "Scythe Attack",
    "Tail Sweep",
    "Climb",
    "Armour Plating (Scylla)",
    "Ambush Predator",
    "Titanic Actions (Scylla)"
  ],
  "structurePoints": 39,
  "asset_url": "https://opxrguskxuogghzcnppk.supabase.co/storage/v1/object/public/LP-Assets/bio-titans/scylla.jpg",
  "page": 276,
  "content": [
    {
      "type": "paragraph",
      "value": "A gigantic, armoured, arachnid-like predator beast. It has no concept that the war it was designed to fight ended aeons ago, and continues to tear apart anything that enters into its mountainous domain."
    }
  ]
}
```
