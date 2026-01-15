# classes

Character classes in Salvage Union (base, advanced, and hybrid)

## Metadata

- **Schema ID**: `classes`
- **Schema File**: `schemas/classes.schema.json`
- **Data File**: `data/classes.json`
- **Total Items**: 10

## Schema Structure

The unified classes schema supports two types of classes:

### Base Classes

Base classes (e.g., Engineer, Hacker, Scout) have the following fields:

| Field           | Type          | Required | Description                                                |
| --------------- | ------------- | -------- | ---------------------------------------------------------- |
| `maxAbilities`  | integer       | ✅       | Maximum number of abilities this class can have            |
| `advanceable`   | boolean       | ✅       | Whether this class can advance to hybrid classes           |
| `coreTrees`     | Array<`tree`> | ✅       | Core ability trees available to this class                 |
| `advancedTree`  | `tree`        | ❌       | Advanced ability tree (only for advanceable base classes)  |
| `legendaryTree` | `tree`        | ❌       | Legendary ability tree (only for advanceable base classes) |
| `content`       | `content`     | ❌       |                                                            |

### Hybrid Classes

Hybrid classes (e.g., Fabricator, Cyborg, Union Rep) have the following fields:

| Field           | Type      | Required | Description                                      |
| --------------- | --------- | -------- | ------------------------------------------------ |
| `hybrid`        | `boolean` | ❌       | Set to `true` to indicate this is a hybrid class |
| `advancedTree`  | `tree`    | ✅       | Advanced ability tree for this hybrid class      |
| `legendaryTree` | `tree`    | ✅       | Legendary ability tree for this hybrid class     |
| `content`       | `content` | ❌       |                                                  |

## Examples

### Base Class Example

```json
{
  "id": "2b3699e5-399b-4085-ad24-c497c94aa4db",
  "name": "Engineer",
  "source": "Salvage Union Workshop Manual",
  "asset_url": "https://opxrguskxuogghzcnppk.supabase.co/storage/v1/object/public/LP-Assets/classes.core/engineer.jpg",
  "coreTrees": ["Mechanical Knowledge", "Forging", "Mech-Tech"],
  "maxAbilities": 10,
  "advanceable": true,
  "advancedTree": "Advanced Engineer",
  "legendaryTree": "Legendary Engineer",
  "page": 26,
  "content": [
    {
      "type": "paragraph",
      "value": "Engineers form an integral component of the Union, the grease that keeps our Mechs and Crawlers trundling across the great wastelands. They can take apart and put back together a Mech Chassis in the blink of an eye, and keep their salvage crew operational out in the wastes. Choose an Engineer if you want a character with a breadth of engineering and mechanical knowledge; who can repair and support you and your allies' Mechs, mount Mech parts significantly faster, and allow you to craft Mech parts in the field."
    }
  ]
}
```

### Hybrid Class Example

```json
{
  "id": "5fb0f656-b454-45ea-8367-b529e68c9b9e",
  "hybrid": true,
  "name": "Fabricator",
  "source": "Salvage Union Workshop Manual",
  "asset_url": "https://opxrguskxuogghzcnppk.supabase.co/storage/v1/object/public/LP-Assets/classes.hybrid/fabricator.jpg",
  "advancedTree": "Fabricator",
  "legendaryTree": "Legendary Fabricator",
  "page": 62,
  "content": [
    {
      "type": "paragraph",
      "value": "You have chosen the path of the Fabricator. Technology is an extension of yourself which you can toy and tinker with to your steel heart's content. What beautiful creations will you form?"
    }
  ]
}
```

## Notes

- Base classes can be selected as initial classes when creating a pilot
- Hybrid classes cannot be selected as initial classes - they can only be selected as advanced classes
- Base classes with `advanceable: true` and `advancedTree`/`legendaryTree` fields can advance to their advanced and legendary ability trees
- The schema uses a discriminated union: base classes are identified by the presence of `coreTrees`, while hybrid classes are identified by `hybrid: true`

## Schema Composition

This schema extends the following definitions:

- `shared/objects.schema.json#/definitions/baseEntity`
- `shared/objects.schema.json#/definitions/advancedClass`
