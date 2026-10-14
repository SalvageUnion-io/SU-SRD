# The bot's Discord profile art, and the Ko-fi page's

`bun run brand` writes every file here from `apps/srd/scripts/brand/`
(`mark.ts` for the icon, `banner.ts` for the banners). Nothing in the build
reads them. `bun run brand:discord` also uploads the icon and the banner to
Discord, with the bot token read from 1Password
(`op://SUSRD/discord-bot/Bot Token`). Ko-fi has no API, so its avatar and
cover go up by hand.

| File | Slot | Spec |
| --- | --- | --- |
| `banner.png` | Discord banner | 680 × 240 PNG (17:6) |
| `icon.png` | Discord app icon and bot avatar; Ko-fi avatar | 1024 × 1024 PNG (1:1) |
| `icon.svg` | The icon as vector | — |
| `kofi-cover.png` | Ko-fi cover | 1500 × 500 PNG (3:1) |

- **Banner:** "SALVAGE UNION.io" in paper on the ink ground with paper flecks,
  "YOU'RE IN THE UNION NOW!" top left in pilot orange, and the book's chapter
  colours along the foot. It has no mark because Discord lays the avatar over
  the banner, and the avatar covers the bottom left, so the title sits right.
- **Icon:** the SU mark (stencil SU on an ink stamp, the chapter colours along
  the foot), full bleed with the glyph scaled into Discord's circular crop.
- **Ko-fi cover:** the banner's materials with the mark beside the wordmark,
  centred, because Ko-fi crops the sides on a phone.
