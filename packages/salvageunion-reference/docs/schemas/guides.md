# guides

Player-facing guides and processes

## Metadata

- **Schema ID**: `guides`
- **Schema File**: `schemas/guides.schema.json`
- **Data File**: `data/guides.json`
- **Total Items**: 15

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
| `guideType` | string | ✅ | Category of this guide |
| `guideColor` | string | ✅ | Hex color for entity display header/footer |
| `steps` | Array<object> | ✅ | Ordered sequence of steps |

## Example

```json
{
  "id": "1888989e-9835-4c24-81f9-4b6867c55cae",
  "name": "Safety Protocols",
  "source": "Salvage Union Workshop Manual",
  "page": 12,
  "additionalSources": [
    {
      "source": "Salvage Union Starter Set",
      "booklet": "CR",
      "page": 8
    }
  ],
  "guideType": "gameplay",
  "guideColor": "#5A9DB5",
  "content": [
    {
      "type": "paragraph",
      "value": "Salvage Union takes place in a post-apocalyptic setting, and is intended for mature audiences. It explores a variety of themes and topics that may make some readers uncomfortable. These include exploitation, authoritarianism, violence, anxiety, death, mental illness, poverty, and trauma."
    },
    {
      "type": "paragraph",
      "value": "Whilst these themes each carry a heavy weight with them, it is important to note that the game is meant to be played as a cooperative and fun experience through the improvisational means of a tabletop roleplaying game. No one should be forced to deal with any topics that they may find distressing or would cause any real conflict between players at the table."
    },
    {
      "type": "paragraph",
      "value": "These topics are presented as part of the world, but the intent is not to have you as either a player or the Mediator revel in them or use them to engage in fantasies that others playing with you find distressing."
    },
    {
      "type": "paragraph",
      "value": "The themes of authoritarianism and exploitation are presented as abhorrent, and are not intended to be glorified in any way, shape, or form. This game is not for fascists, or anyone else who holds any hateful beliefs."
    },
    {
      "type": "paragraph",
      "value": "The following Safety Protocols are intended to help facilitate a positive experience for everyone at the table."
    }
  ],
  "steps": [
    {
      "id": "f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "name": "Boundaries",
      "content": [
        {
          "type": "paragraph",
          "value": "Before you begin the game, ask the players in your group to let you know if there is any subject matter that is sensitive for them. You can use these categories to help create boundaries for your game's content."
        },
        {
          "type": "label",
          "value": "Out of Bounds"
        },
        {
          "type": "paragraph",
          "value": "If something is out of bounds, this means you should not use it in your game. For example, if a player says graphic descriptions of torture are out of bounds, everyone in the group should agree to not use that subject matter in the game. Things that are out of bounds should not be discussed or brought during the game."
        },
        {
          "type": "label",
          "value": "Off Camera"
        },
        {
          "type": "paragraph",
          "value": "There are some topics that might be okay to include within the game, but not in detail. In this case, you should reference these events indirectly or metaphorically, as if they are happening off screen, in the background."
        },
        {
          "type": "paragraph",
          "value": "For example, if a player is uncomfortable with detailed descriptions of blood and gore, you might describe a group of wastelanders being massacred by a rampaging Mech, with the grim sounds of metal and shouting in the background."
        },
        {
          "type": "paragraph",
          "value": "Or, some groups may want to explore sexual relationships between characters within the game, but would want things to fade to black during any actual scene involving intercourse."
        },
        {
          "type": "paragraph",
          "value": "Some players may realise something is out of bounds only when they hear it. If you notice a player is uncomfortable during a game, ask them if they are okay to keep playing before continuing."
        }
      ]
    },
    {
      "id": "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6e",
      "name": "Stop Sign",
      "content": [
        {
          "type": "paragraph",
          "value": "Players can use a STOP SIGN to signal when something makes them uncomfortable, or when they need to pause the game."
        },
        {
          "type": "paragraph",
          "value": "The STOP SIGN can be anything your group agrees to use. It can be a verbal cue (like a safe word), a gesture, or a card that you hold up."
        },
        {
          "type": "paragraph",
          "value": "If someone uses a STOP SIGN, pause the game to find out why by talking to each other out of character. Listen to other players if they need to set a new boundary, and respect the boundaries of other players in your group."
        },
        {
          "type": "paragraph",
          "value": "A player can use a STOP SIGN at any time within the game, and does not need to justify its use."
        }
      ]
    }
  ]
}
```
