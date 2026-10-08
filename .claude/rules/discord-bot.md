---
paths:
  - 'apps/discord-bot/**'
---

# Discord bot — changing a reply

The architecture (HTTP-interactions Worker, the ITUN Game client and how it
degrades) is in [`apps/discord-bot/CLAUDE.md`](../../apps/discord-bot/CLAUDE.md);
the roll surface's design and its retractions are in the header of
`src/rollContainer.ts`.
This rule is the checklist for the work that keeps landing here: reshaping what
a reply looks like.

## Every reply is a Components V2 container

- Build a pure `ContainerData` and render it with `toContainer` in
  `src/container.ts`. An entity surface (a lookup entry, a sheet, a game card)
  goes through `entityCard()` — one render for that shape; anything else
  authors its blocks in a `*Container.ts` builder. Never an `embeds:` payload —
  with `MessageFlags.IsComponentsV2` Discord rejects `content` and `embeds`
  outright.
- **Limits are enforced once, in `toContainer`** (`enforceContainerLimits`,
  budgets in `V2_LIMIT`). They are server-side ceilings no installed package
  checks, so do not add a second guard; a builder that must fit (lookup) budgets
  against `V2_LIMIT` by measuring what it renders.
- Builders stay pure: data in, data out. Changing a sent message means
  rebuilding it, not mutating it.

## What Discord will and will not render

Learned by shipping it and looking — each cost a PR (#976, #977):

- `setAccentColor()` paints the container's **left edge only**. A
  `TextDisplay` is always default text colour, so a glyph "tinted by the tier"
  renders as a white bar. There is no in-text colour and a heading is already
  bold, so **punctuation is the only emphasis left** — `rollHeadline` owns the
  die / outcome separator; route through it rather than formatting a headline
  inline.
- Keep one shape per surface. A banner or row that appears only for some
  results makes the message change shape with the roll; every roll draws the
  same furniture.
- No block glyphs for decoration. The one surviving glyph set is functional
  (`REROLL_SYMBOL` in `src/customId.ts`, the gauge in `src/gameCards.ts`);
  extend those, do not start a second vocabulary.

## Ephemerality is a rule, not a default

- Denials and errors are **always** ephemeral (`src/commands/itunReply.ts`):
  a public channel is the wrong place to say who lacks an account.
- `/su sheet` is always ephemeral, even when the sheet is public (ADR-032), and
  shows the Share field only when the server reports `publicRead: true`;
  posting to the channel is the owner's act. `sheetVisibility.test.ts` holds it.
- A private roll re-renders publicly only from the result encoded in its
  button — never by re-rolling.

## Buttons are permanent

Posted messages keep their buttons forever. Retiring an action (as `/su check`
was) means `parseCustomId` rejects it and the router answers "no longer
supported" ephemerally — `retiredCheckButtons.test.ts` pins that. Never reuse a
retired `su:<action>` name for something new.

## Colour and the tests that guard a reply

- Roll and neutral colours mirror `--color-roll-*` / `--color-rust` in
  `packages/component-lib/src/styles/theme.css`; change them together.
  `themeLockstep.test.ts` fails when they diverge.
- `degradedMode.test.ts` — the reference bot must keep working when In The
  Union Now does not answer. Do not let it regress.
- Handlers take the narrow types in `src/commands/interactions.ts` (add a member
  only when a handler reads it); extend the shared fakes in
  `src/__tests__/fakeInteraction.ts` rather than casting.

Run `bun --filter discord-bot test`; `src/http/__tests__/replay.test.ts` drives
the Worker with signed, Discord-shaped payloads. There is no local loop against
real Discord: the Interactions Endpoint URL is application-wide, so only the
deployed Worker receives interactions, and a reply is first seen rendered once
it ships. The tests prove structure; every rule in "What Discord will and will
not render" was learned by looking at a shipped reply.
