# systems

Mech systems (weapons and utilities)

## Metadata

- **Schema ID**: `systems`
- **Schema File**: `schemas/systems.schema.json`
- **Data File**: `data/systems.json`
- **Total Items**: 126

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
| `structurePoints` | integer | ❌ | Structure points (mech health) |
| `energyPoints` | integer | ❌ | Energy points for powering systems |
| `heatCapacity` | integer | ❌ | Maximum heat before overheating |
| `systemSlots` | integer | ❌ | Number of system slots available |
| `moduleSlots` | integer | ❌ | Number of module slots available |
| `cargoCapacity` | integer | ❌ | Cargo carrying capacity |
| `techLevel` | unknown | ✅ | Technology level of the item or entity (integer 1-6, 'B' for Bio, or 'N' for Nanite) |
| `salvageValue` | integer | ✅ | Scrap value when salvaged |
| `slotsRequired` | integer | ✅ | Number of slots this system/module occupies |
| `recommended` | boolean | ❌ | Whether this is a recommended starting system/module |
| `count` | integer | ❌ | Number of this system/module installed |
| `contributions` | Array<object> | ❌ | Every flat mechanical change this item makes to a stat (ADR-029). This is the ONE numeric encoding: the older `statBonus` shape — a bare per-copy map with no target, duration or expression amounts — was a strict subset of it, and two encodings summed independently by the same derivation is a double-count waiting to be authored. |
| `appliedEffects` | Array | ❌ | Trait/damage/range effects this item applies unconditionally (ADR-029). Same vocabulary as a choice option’s `effects`, declared directly on the record for grants that are not a choice. Named `appliedEffects`, not `effects`: that key is already taken on meta entities with a different `{ label, value }` shape (see getEffects), and one field name meaning two things is how a schema rots. |
| `actions` | Array<string> | ✅ | Action names this system/module provides |
| `traits` | Array<object> | ❌ | Traits and special properties |

## Example

```json
{
  "id": "418deda4-ab48-4bc4-a527-d56f4d77746e",
  "source": "Salvage Union Workshop Manual",
  "name": ".50 Cal Machine Gun",
  "techLevel": 1,
  "slotsRequired": 2,
  "salvageValue": 2,
  "page": 164,
  "actions": [
    ".50 Cal Machine Gun"
  ],
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "PC",
      "page": 48
    }
  ]
}
```
