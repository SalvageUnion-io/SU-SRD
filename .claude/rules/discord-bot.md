---
paths:
  - 'apps/discord-bot/**'
  - 'packages/cantina-domain/src/botWire.ts'
---

# Discord bot — changing a reply

## Every reply is a Components V2 container

- Build a pure `ContainerData` and render it with `toContainer`
  (`src/container.ts`): a reference entry is `discordEntryCard` (the SRD's
  Component Embed too), sheets and game cards `entityCard()`, anything else a
  `*Container.ts` builder. Never `embeds:` or `content`: Components V2 rejects them.
- Limits are enforced once, in `toContainer` (`V2_LIMIT`); add no second guard.
- Builders are pure; changing a sent message means rebuilding it.

## What Discord renders

- `setAccentColor()` paints the left edge only; text has no colour and headings
  are already bold, so punctuation is the only emphasis: `rollHeadline` owns
  the die / outcome separator.
- One shape per surface: every roll draws the same furniture.
- No decorative glyphs; extend the functional ones (`↻` in
  `src/commands/roll.ts`, `gauge()` in `src/gameCards.ts`).

## Ephemerality and buttons

- Denials and errors are always ephemeral (`src/commands/cantinaReply.ts`).
- `/su sheet` is always ephemeral, and shows Share only when the server reports
  `publicRead: true`.
- A private roll goes public only from the result encoded in its button, never
  a re-roll; a roll is always a new message; only its roller re-rolls.
- Posted buttons live forever: a retired action is rejected by `parseCustomId`
  with "no longer supported"; never reuse a retired `su:<action>` name.

## Colour and tests

- Accents mirror `apps/web/src/styles/theme.css` in
  `packages/salvageunion-reference/lib/view/discordAccents.ts`; change them together.
- Handlers take the narrow types in `src/commands/interactions.ts`; extend
  `src/__tests__/fakeInteraction.ts` rather than casting.
- `bun --filter discord-bot test` (with the signed replay harness) proves
  structure, not rendering: only the deployed Worker receives interactions.
