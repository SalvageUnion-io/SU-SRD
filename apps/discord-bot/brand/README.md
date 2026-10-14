# The bot's Discord profile art

Set in the Discord Developer Portal (the app's General Information page): the
banner by hand, the icon by hand or by the script below. Nothing in the build
reads these files.

| File | Discord slot | Spec |
| --- | --- | --- |
| `banner.png` | Banner | 680 × 240 PNG (17:6) |
| `icon.png` | App icon and bot avatar | 1024 × 1024 PNG (1:1) |
| `icon.svg` | The icon as vector | — |

- **Banner:** the rules-blue chapter band with ink speckle, "SALVAGE UNION.io"
  notched in ink on the page ground, "YOU'RE IN THE UNION NOW!" top left and
  the book's chapter colours along the foot. The title sits in the right 60%
  because the profile avatar covers the bottom left.
- **Icon:** the SU mark (stencil SU on an ink stamp, the chapter colours along
  the foot), full bleed with the glyph scaled into Discord's circular crop.
  `bun run brand` writes both icon files from `apps/srd/scripts/brand/mark.ts`;
  `bun apps/srd/scripts/brand/build.ts --upload-discord` with `DISCORD_TOKEN`
  set also uploads
  it as the app icon and the bot's avatar, in place of the portal upload.
