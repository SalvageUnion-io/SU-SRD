# The Discord bot and the design refresh

> **Status: built on `design-refresh` (2026-10-12).** The owner chose the
> direction from the mockups
> ([Discord Bot Refresh Mockups](https://claude.ai/artifact/VtfEYMbvPbd6VY3QZqYejq)).
> Component Embeds are the centrepiece. Rules for changing a reply are in
> `.claude/rules/discord-bot.md`; the bot's architecture is in
> [`apps/discord-bot/CLAUDE.md`](../../apps/discord-bot/CLAUDE.md).

## Goals

1. **Readable** at a glance, on a phone and on desktop.
2. **Links back** to the page the content came from.
3. **All the information.** Nothing the book prints for an entry is lost; what
   does not fit moves to a tab, a page or the linked entry, never off a cliff.

Three calls the owner made on the mockups:

- **Component Embeds first.** A salvageunion.io link pasted anywhere in Discord
  renders as our card, with no bot involved.
- **A roll result has one row of buttons:** `↻ Roll again` and `See table`.
- **No "Explain" select and no "Open on salvageunion.io" buttons.** The title
  is the link to the page; a pasted link explains a term.

## One renderer, two surfaces

`packages/salvageunion-reference/lib/view/discordCard.ts` renders an
`EntityModel` (`toEntityModel`, the
[Entity Display Language](../design-system/entity-display-language.md)'s model)
as Discord markdown. It is the only place an entity becomes Discord text, and
it computes no fact. Two consumers:

| Surface | Where | Budget |
| --- | --- | --- |
| `/su lookup` and every bot card of an entry | `apps/discord-bot/src/lookupCard.ts` | 4,000 characters of text, 40 components |
| The Component Embed in every entity and pattern page's head | `apps/srd/src/lib/componentEmbed.ts`, rendered by `BaseLayout` | 3,000 bytes of JSON, one Container |

So a lookup and a pasted link always say the same thing.

`discordCard(parts, { fits })` sheds to fit whole parts at a time: children,
then actions, then table rows (never the marked one), then prose. A card that
shed anything links "the full entry on salvageunion.io". The head (kicker,
title, stat cells, traits) and the cite always stay.

### The book's devices

Discord paints one colour per message (the accent stripe) and none inside
text, so type and punctuation carry the rest.

| Device | In Discord |
| --- | --- |
| Tone fill (EDL E12) | The accent, from `EntityModel.tone` through `DISCORD_TONE_ACCENT`, a mirror of `theme.css` that `discordCard.test.ts` holds in lockstep. `ink` and `ink-2` paint the rules blue (`--color-wk-line`), because near-black vanishes on Discord's dark theme. **Never rust** on a reference card (ruleset §3.1). |
| Seam stamp | A `-#` caps kicker: `-# ABILITY · ADVANCED HACKING TREE · REACTION · \`1 AP\``; a pattern adds its chassis. |
| Head | `## [Name](page)`; an ability's tier numeral first: `## 2 · [Counter-Hacking](…)`. Lower-case glossary names are set in the book's capitals. |
| Value cells | `` `12` STRUCTURE PTS. `` three to a line, in the book's words and order (`bookStats`), then any facet the column lacks. |
| Traits (E17) | Linked tags with their parameter. No "//" line. |
| Actions | `### Name`, a `-#` line of type, cost and facets, traits, rules. |
| Table (E14) | `-# ROLL THE DIE:` over one band per line, highest first; a two-roll table prints each column. |
| Children (E6) | `-# SYSTEMS (7)` over linked names: a link, never a nested card. |
| Cite | `-# Salvage Union Workshop Manual p.100 · also in … (PC) p.12`. |

## The surfaces

### Roll result (`/su roll`)

The headline rule in `apps/discord-bot/src/rollContainer.ts` is unchanged.
Added:

- `-# Lands on 11–19` under the headline (board 08b's "Lands on"), or the column
  and entry on a two-roll table;
- trait references in the outcome as links, never `[[Vulnerable]]`;
- the foot is the table's cite and the Randsum credit;
- one row: `↻ Roll again` (Primary) and `See table`, with `Post to channel`
  between them on a private roll.

**See table** (`su:table:<table>|<rolls>`) answers privately with the whole
table and this roll's row marked (`> ▶`, `ROLLED 14 · Alex`). It carries the
result, so it marks the row on screen, never a new roll. An older message's
Link button and `su:lookup` buttons keep working.

### Lookup (`/su lookup`)

The shared card, plus what only the bot adds:

- **Tabs.** An entry with patterns has `Overview` and `Patterns (n)`.
  `su:view:<key>|<tab>|<page>` answers with UPDATE_MESSAGE, redrawing the card
  for everyone who sees it. The Patterns tab pages two at a time.
- **Pattern picker.** A select (`su:peek:<key>`) answers privately with the
  pattern's Peek: its card, read-only and terminal (E16).
- **Roll buttons** for the entry's own table and each table its actions roll
  on, at most three: one tap to a chained roll.
- **No such entry** is an in-system container, privately.

`<key>` is `schemaName::slug`, also the autocomplete value; a retired slug
resolves to its host (ADR-043).

### Look up in Salvage Union (message context menu)

Right-click a message › Apps. `apps/discord-bot/src/termFinder.ts` finds the
terms the message names, as the book prints them, longest first, at most five.
A roll-table row's label counts ("Reactor Overheat" finds Reactor Overload at
11–19). A single word must be capitalised as a game term, so "take cover" finds
nothing. The answer is private; each row's `Post to channel`
(`su:lookup:<key>`) posts that entry's card.

### Pasted links (Component Embed)

Every entity and pattern page carries `<script id="discord:component-embed"
type="application/json">` with the shared card as one Container. Discord reads
it without running scripts. The OG tags and the OG card image stay as the
fallback for every other unfurler. `componentEmbed.test.ts` holds every page
under 3,000 bytes.

## What Discord offers (October 2026)

From the `discord/discord-api-docs` source. The ones this design uses:

- **Components V2:** Container (accent), Section (text plus a Thumbnail or a
  Button), Text Display (headings, `-#`, masked links), Separator, Action Row,
  String Select. 40 components per message; about 4,000 characters of text
  (the libraries' figure, not in the docs). With the V2 flag a message carries
  no `content`, embeds or poll.
- **UPDATE_MESSAGE** for tabs and pages; **ephemeral** replies for
  everything private.
- **Message context-menu commands:** 15 per app since March 2026; the target
  message arrives under `resolved.messages`.
- **Component Embeds** (October 2026): a page's own V2 Container, at most
  3,000 bytes, link buttons only.

## Not built

Proposed in the brainstorm, not in this change:

- user install (`integration_types` `[0, 1]`);
- a user context menu, "View sheet";
- `?roll=` deep links on the SRD's table pages;
- application emoji;
- Activities.

Two more stay as they are:

- **Game cards** (`apps/discord-bot/src/gameCards.ts`) keep their accents: they
  are sheets, not reference entries.
- **System replies** (errors, invites) stay rust.

Open:

- **Tabs are shared.** A tap redraws a public card for everyone. If that proves
  noisy, answer tabs ephemerally instead.
- **The foot's brand** waits on the ITUN domain move (#1244).
