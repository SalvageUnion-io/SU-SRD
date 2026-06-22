# sources

Source books and expansions

## Metadata

- **Schema ID**: `sources`
- **Schema File**: `schemas/sources.schema.json`
- **Data File**: `data/sources.json`
- **Total Items**: 10

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
| `purchaseLink`      | string        | ❌       | URL where this source can be purchased                                                                                                                    |

## Example

```json
{
  "id": "75879e96-0bdd-4bfb-911d-ac6706f03010",
  "name": "Salvage Union Workshop Manual",
  "source": "Salvage Union Workshop Manual",
  "page": 1,
  "purchaseLink": "https://leyline.press/products/salvage-union-core-book?variant=43991343956158",
  "content": [
    {
      "type": "paragraph",
      "value": "Salvage Union is a post-apocalyptic mech tabletop roleplaying game. You play as salvager mech pilots who scour the wasteland for salvage in scrap built mechs."
    },
    {
      "type": "paragraph",
      "value": "Set in a scarred world ruled by corporations whose denizens live in isolated mega-settlements known as Arcos. The corpos control the vast majority of arable land and resources and have a constant hunger for power and control."
    },
    {
      "type": "paragraph",
      "value": "As Salvagers you have found a way to live your lives outside the bounds of corpo control, roaming the wastes in a vast mech known as a Union Crawler which houses your entire community. The scrap you haul back to your Union Crawler is used to support, sustain, and grow your community and craft new mechs for you and your crew."
    },
    {
      "type": "paragraph",
      "value": "As you explore the wastelands for scrap you’ll encounter wastelanders, raiders, mutants, Bio-Titans, alien Meld, and corpo forces all fighting for survival in this hostile landscape."
    },
    {
      "type": "paragraph",
      "value": "Will you salvage enough scrap for you and your community to survive in the wastes or fall prey to its dangers?"
    }
  ]
}
```
