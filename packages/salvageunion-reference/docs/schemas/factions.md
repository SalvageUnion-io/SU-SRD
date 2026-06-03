# factions

Faction groups and organizations

## Metadata

- **Schema ID**: `factions`
- **Schema File**: `schemas/factions.schema.json`
- **Data File**: `data/factions.json`
- **Total Items**: 10

## Fields

| Field               | Type          | Required | Description                                                                                                                                               |
| ------------------- | ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset_url`         | string        | ❌       | URL to an image asset for this entity                                                                                                                     |
| `content`           | Array<object> | ❌       | Descriptive content for this faction                                                                                                                      |
| `id`                | string        | ✅       | Unique identifier for this entity                                                                                                                         |
| `indexable`         | boolean       | ✅       | Whether this entity appears in search results                                                                                                             |
| `blackMarket`       | boolean       | ✅       | Whether this entity is only available on the black market                                                                                                 |
| `name`              | string        | ✅       | Display name of this entity                                                                                                                               |
| `source`            | string        | ✅       | Primary source book this entity appears in                                                                                                                |
| `page`              | integer       | ✅       | Page number in the primary source book                                                                                                                    |
| `booklet`           | string        | ❌       | Booklet code within a multi-booklet primary source (e.g. "CR", "PH", "PC", "RR", "AP" for the Salvage Union Starter Set). Omit for single-volume sources. |
| `additionalSources` | Array<object> | ❌       | Other source books where this entity is reprinted                                                                                                         |
| `goals`             | string        | ✅       | The goals and motivations of this faction                                                                                                                 |
| `assets`            | string        | ✅       | The assets and resources controlled by this faction                                                                                                       |
| `weaknesses`        | string        | ✅       | The weaknesses and vulnerabilities of this faction                                                                                                        |
| `formation`         | Array<object> | ❌       | The mechs that make up this faction formation                                                                                                             |

## Example

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "BOLZA Logistics Corps",
  "source": "We Were Here First!",
  "page": 14,
  "content": [
    {
      "type": "paragraph",
      "value": "The logistical arm of the BOLZA operation, responsible for resupply and recovery. They are not combat trained and are less indoctrinated into BOLZA ideals. Led by the foreman of the crew, 'Weaver'."
    }
  ],
  "goals": "Get the job done and get back home to their families. Some are looking for a payday and might look to do some skimming. Most know this is a bad idea.",
  "assets": "All the transport, repair, and support mechs in the BOLZA force. They also control access to the Chimerium storage facility at the BOLZA Camp.",
  "weaknesses": "Not being as loyal to the corpo, they can be bought - provided they will be safe. That said, it is a big ask. Better the devil you know.",
  "formation": [
    {
      "chassis": "Atlas",
      "pattern": "Bastion",
      "source": "Salvage Union Workshop Manual",
      "page": 125
    },
    {
      "chassis": "Jackhammer",
      "pattern": "Auger",
      "source": "Salvage Union Workshop Manual",
      "page": 117
    },
    {
      "chassis": "Magpie",
      "pattern": "Maggie",
      "source": "Salvage Union Workshop Manual",
      "page": 121
    },
    {
      "chassis": "Mirrorball",
      "pattern": "Reclaimer",
      "source": "Salvage Union Workshop Manual",
      "page": 123
    }
  ]
}
```
