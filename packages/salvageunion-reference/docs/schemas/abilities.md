# abilities

Pilot abilities and skills

## Metadata

- **Schema ID**: `abilities`
- **Schema File**: `schemas/abilities.schema.json`
- **Data File**: `data/abilities.json`
- **Total Items**: 103

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
| `description` | string | ❌ | Short description of the ability |
| `tree` | string | ✅ | Ability tree this ability belongs to |
| `level` | unknown | ✅ | Ability level (1-3, L for Legendary, G for Generic) |
| `mechActionType` | string | ❌ | Action type when used as a mech action |
| `grants` | Array<object> | ❌ | Entities or choices granted by this ability |
| `activationCurrency` | string | ❌ | Currency type used for activation |
| `actions` | Array<string> | ✅ | Action names this ability provides |
| `contributions` | Array<object> | ❌ | Flat stat changes this ability makes (ADR-029). An ability could previously declare no mechanical change at all, so Beefcake, Bionic Arms, Bionic Legs and Modular Face Implant were inert prose. |

## Example

```json
{
  "id": "ef787157-c4d4-44bf-857f-71eec0db7939",
  "name": "Engineering Expertise",
  "source": "Salvage Union Workshop Manual",
  "tree": "Mechanical Knowledge",
  "level": 1,
  "page": 28,
  "actions": [
    "Engineering Expertise"
  ],
  "description": "Ask questions pertaining to mechanical and engineering topics.",
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "PH",
      "page": 13
    }
  ]
}
```
