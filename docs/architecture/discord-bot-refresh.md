# Discord bot refresh: brainstorm

> **Status: brainstorm, not a decision.** Written on `design-refresh`
> (2026-10-12). It changes no code, no ADR and no canon. It collects options for
> bringing `apps/discord-bot` in line with the brand refresh (#1250) and the
> [ruleset](../design-system/ruleset.md), and with the
> [Entity Display Language](../design-system/entity-display-language.md) (EDL),
> which already names the bot as a consumer of the shared entity model ("OG
> cards, the bot: fed by the model"). Anything picked from here still needs its
> own issue, and an ADR where it changes a decision.

The ask, in three parts:

1. **Readable.** A reply should read at a glance on a phone and on desktop.
2. **Links back to the original.** Every reply should lead to the page it came
   from on salvageunion.io (or ITUN for sheets).
3. **All the information.** Nothing the book prints for an entry should be lost
   in Discord. Where it can't fit, the reply should still reach it.

Then "contextual information": explaining what a reply refers to (a trait, a
linked table, a pattern's systems) without making the reader leave Discord.

Which commands to keep at all is a separate question, measured in the
[D12 usage spike](../spikes/d12-bot-command-usage.md).

---

## 1. Where the bot stands today

Rendered from the current code (`apps/discord-bot/src/lookupCard.ts`, `apps/discord-bot/src/rollContainer.ts`):

**`/su lookup Mule`** (1,136 chars, 8 components)

```text
## [Mule](https://salvageunion.io/schema/chassis/item/mule)      [thumbnail]
The 'M-63' Mule was developed by the Opus Institute … (lore)
__Integrated Cargo Bay__
Increases the Cargo Capacity of The Mule by 10, to 16.
**Patterns**
• **Hauler** ✅ — 7 systems, 2 modules
• **Crusher** — 7 systems, 2 modules   … (6 rows)
**Type** Chassis
**Tech Level** 1
**Salvage Value** 7
**Structure** 12
… (10 stat lines, one per line)
───
-# Salvage Union Workshop Manual · p.100 · Salvage Union Reference
```

**`/su roll Reactor Overload`** on a 14 (340 chars)

```text
-# REACTOR OVERLOAD · rolled by Alex
## 14 — REACTOR OVERHEAT
Your Mech's reactor has overheated. Your Mech shuts down and gains the [[Vulnerable]] Trait. …
───
-# Salvage Union Reference · Powered by Randsum.dev
[↻ Roll again] [See table]
```

**`/su lookup Anomalous Zone`** fills the 4,000-character budget, then stops
mid-entry at row 8 of 20, followed by "Full entry on salvageunion.io".

### Gaps against the three goals and the refresh

| # | Gap | Goal | Where |
| --- | --- | --- | --- |
| G0 | **The bot doesn't use the entity model.** `toEntityModel` (`packages/salvageunion-reference/lib/view/`) already resolves kind, tone, the book's stat column, traits, actions, children, table and cite for every entity. `lookupCard.ts` re-derives a subset by hand. Most gaps below come from that. | all | `apps/discord-bot/src/lookupCard.ts` |
| G1 | **Every lookup card's accent is rust.** Under the refresh, rust means action and only action (ruleset §3.1). A reference card should wear its tone (`EntityModel.tone`; EDL E12). | refresh | `NEUTRAL_ACCENT` in `apps/discord-bot/src/format.ts`, used by `lookupCard.ts` and `gameCards.ts` |
| G2 | **Roll results print raw `[[Vulnerable]]`.** 20 of the 833 roll-table entries carry trait refs. The lookup card links them, but the roll result does not run `linkifyTraitRefs`. | readable, link | `buildRollContainerData` in `apps/discord-bot/src/rollContainer.ts` |
| G3 | **A roll result drops context the web page shows.** It omits the range the roll landed on ("11–19"), the page citation, and the table's own rules text (39 of 96 tables have some). Board 08b's "You rolled" panel shows the range and the outcome. | all info | `rollContainer.ts` vs `apps/srd/src/components/RollTableView.tsx` |
| G4 | **Stats are a ten-line column in the bot's own words.** "Structure", "Heat Cap", one per line. The book's stat column is `14 \| STRUCTURE PTS.` in a fixed order (ruleset, "Framed numeral + ink stamp"), which the model carries as `bookStats`. | readable, refresh | `chassisSections` / `statFields` in `lookupCard.ts` |
| G5 | **Big entries are cut off.** `fit()` sheds description to the budget, so a 20-row table, a chassis with many patterns or a class with three trees loses its tail. Only a link remains. | all info | `fit()` in `lookupCard.ts` |
| G6 | **The thumbnail section swallows the body.** With artwork, the description (lore, abilities, patterns) sits in the section beside the thumbnail, so the whole entry runs down a narrowed column. | readable | `entityCard()` in `apps/discord-bot/src/container.ts` |
| G7 | **Patterns, abilities and nested entities aren't reachable.** A chassis's patterns are a count ("7 systems, 2 modules") with no link or way in. A Bio-Titan's patterns now link to their pages. Actions that roll on a table get a link but no Roll button. | link, all info | `lookupCard.ts` |
| G8 | **Lookup errors are bare strings.** `No entity found for "…"` is plain ephemeral text. The roll command's errors are an in-system container with suggestion buttons. | readable | `lookupCommand.execute` in `apps/discord-bot/src/commands/lookup.ts` |
| G9 | **The bot only appears as `/su`.** It has no context-menu commands, modals, select menus or user install. Every interaction starts from the slash picker. | context | `apps/discord-bot/src/worker/index.ts` handles command, autocomplete and button only |
| G10 | **Branding predates "one union, two tools".** Footers say "Salvage Union Reference" or "In The Union Now". Sheet links go to `intheunionnow.com` (the domain move is #1244). | refresh | `ROLL_ATTRIBUTION` in `apps/discord-bot/src/format.ts`, `ITUN_ORIGIN` in `apps/discord-bot/src/gameCards.ts` |

The roll surface itself is in good shape. The headline rule, the bot-only tier
ramp, Post to channel, the stateless buttons and the Game log line all match the
refresh's intent (ruleset §3.4). Most of the work is on lookup, and on giving
both surfaces more ways in and out.

---

## 2. What Discord gives us

Read from the `discord/discord-api-docs` source at its October 2026 HEAD,
including its changelog. Limits are the docs' own unless marked.

### Message layout (Components V2, already in use)

| Component | What it's for here | Limits |
| --- | --- | --- |
| **Container** | The card. `accent_color` is the only colour in the message. | One per reply today. **40 components per message**, nested ones counted. |
| **Text Display** | All text. Supports `#`/`##`/`###` headings, `-#` subtext, masked links, lists, `>` quotes, inline and block code, `<t:…>` timestamps, application emoji and `</su roll:id>` command mentions. | **About 4,000 chars across all Text Displays.** Not in the official docs, but the major libraries agree, and `V2_LIMIT` already enforces it. |
| **Section** | 1–3 Text Displays plus **one accessory**: a Thumbnail or a **Button**. | A button accessory puts an action beside the line it acts on ("Roll on Reactor Overload"). |
| **Thumbnail** | Artwork beside the identity. | Images only; alt text up to 1,024 chars. |
| **Media Gallery** | 1–10 images or videos, full width. | Takes any https URL. This is where an OG card PNG would go. |
| **Separator** | Rules between blocks. | `divider` on or off; small or large spacing. |
| **Action Row** | Up to 5 buttons or 1 select. | |
| **Button** | Primary / Secondary / Success / Danger / **Link** (opens a URL, no interaction). | Label up to 80 chars, `custom_id` up to 100. |
| **String select** | A picker in the message. | Up to 25 options, each with a label and description up to 100 chars. |

With the V2 flag set, `content`, `embeds`, stickers and **polls** are refused.
So polls can't sit on a card. A deferred reply can carry only the ephemeral
flag; the V2 flag goes on the edit that follows.

### Responses

- `CHANNEL_MESSAGE_WITH_SOURCE` (new message) or `UPDATE_MESSAGE` (redraw the
  message a button sits on). **Update is what makes tabs and paging possible**
  without adding messages to the channel.
- Ephemeral: only the person who acted sees the reply. The right home for
  explanations, errors and "show me more".
- Answer within 3 s; the token then lasts 15 min for edits and follow-ups.
  Autocomplete has the same 3 s budget and **no defer**.

### Modals

A modal holds up to five top-level items: **Label** wrapping a text input,
select, file upload, **radio group**, **checkbox group** or **checkbox**, plus
**Text Display** for explanatory markdown. Radio groups and checkboxes have
been allowed since Feb 2026. A modal can be opened from a slash command or a
button, but not from another modal's submit.

### Entry points

- **Slash commands**: 25 options; choices *or* autocomplete (25 results, 3 s).
  Integer options take `min_value`/`max_value`. Since Sep 2026 the client
  fuzzy-matches command names.
- **Context-menu commands**: right-click a **user** or a **message** → Apps.
  Since Mar 2026 an app can have **15 of each**, and the menu is searchable and
  grouped by app. They take no options.
- **User install**: `integration_types` `[0, 1]` and `contexts` `[0, 1, 2]` let a
  player add the app to their own account and use it in any server or DM. In a
  server that hasn't installed the app, replies are **forced ephemeral** when the
  server denies "Use External Apps". There is also a cap of **5 follow-ups per
  interaction**.
- **Activities**: an iframe web app launched from an Entry Point command. It
  must load through Discord's proxy, under a strict CSP, and handshake with the
  Embedded App SDK. That is a porting project, not a link-out.

### Outside the bot: link previews

When someone pastes a salvageunion.io link, Discord fetches the page once,
without JavaScript, and reads its OG tags, `theme-color` and
`twitter:card`. The SRD already serves all of these, and the image is the
1200×630 OG card.

**New in Oct 2026: Component Embeds.** A page can also put **one V2 Container**
in its `<head>` (`<script id="discord:component-embed"
type="application/json">`, or `<link rel="discord:component-embed">` to a JSON
file on the same host). Discord then renders the pasted link as that container:
text displays, sections, thumbnails, a media gallery and link buttons. The
payload limit is 3,000 bytes; the embed is display-only, and OG tags remain the
fallback. **This would let every SRD link pasted in Discord render as our card
with no bot involved**, built from the same data the bot uses.

### Also available

- **Application emoji**: up to 2,000 per app, usable in any server the app
  reaches, in text, buttons and select options.
- **Linked Roles**: up to 5 metadata records, e.g. "has an ITUN account".
- **App Directory / App Launcher listing**: needs a verified app owned by a
  team.
- Not a fit: polls (incompatible with V2), Premium and monetisation.

---

## 3. The Workshop Manual, translated into a container

### Render from the model

The EDL's pipeline is entity → `toEntityModel` → form + mode. Its forms are
React, but the model is plain, serialisable data and already lives in
`salvageunion-reference`, which the bot depends on. So the bot's job shrinks to
**one more renderer of `EntityModel`**: model → `ContainerData`, through the
existing `entityCard()` seam. Kind, tone, `bookStats`, traits, actions,
children, table and cite then can't disagree with the web, because no fact is
computed twice (the EDL's pipeline rule).

### EDL forms in Discord

| EDL form | Discord equivalent |
| --- | --- |
| **Mention** (E4) | A masked link to the page. Discord has no hover, so the Peek moves to an "Explain…" select or a context menu (§4 R10, §6 N2). |
| **Token** | A string-select option: label `Mule`, description `Chassis · TL 1`. Also an autocomplete choice name. |
| **Row** | One line in a list: `**Hauler** · \`7\` systems · \`2\` modules`. Or a Section with a button accessory when it opens something. |
| **Card** | The container: kicker, title, stat cells, prose, actions as banners, children as Rows, the table as a roll bar, cite. |
| **Page** | The salvageunion.io page, behind a Link button. Discord never imitates the Page (E5). |
| **Peek** | An **ephemeral** compact card: read-only and terminal (E16), so it carries a Page link and nothing else. No further select. |

Nesting follows E6. A Card lists its children as Rows. A third level is a link
or a Peek, never a third container.

### The book's devices

Discord paints **one** colour per message (the container's accent stripe).
Text is always the client's default colour, and buttons come in fixed styles.
So the accent carries the tone, and type, punctuation and layout carry
everything else.

| Book / ruleset device | In a Discord container |
| --- | --- |
| **Tone fill / chapter band** | The accent stripe from `EntityModel.tone`: `pilot` `#ef894f`, `mech` `#7a978a`, `crawler-band` `#b84a86`, `adversary` `#8c4b38`, the TL ramp, and so on. **Never rust.** The bot needs a tone-key → `0xRRGGBB` table with a lockstep test against `theme.css`, as `apps/discord-bot/src/__tests__/themeLockstep.test.ts` does for the roll ramp. **"Do" entities** (abilities, actions: `ink`) are the problem case. `--color-ink` (#282019) nearly vanishes against Discord's dark theme, so they need a decision (§8 Q1). |
| **Seam type stamp** | A `-#` caps kicker from `kind.stamp`: `-# CHASSIS`, `-# ABILITY · HACKING TREE`. |
| **Head: tier, name, cost pennant** | `## Name` as a masked link to the page. For a "do" entity: `## II · Name`, and the cost as an inline-code pennant on the kicker line (`` -# ABILITY · TURN · `2 AP` ``). |
| **Facts as Stats** (E9, E17) | Inline-code value cells, each beside its label in the book's words and order (`bookStats`, then `facts`): `` `12` STRUCTURE PTS. · `4` ENERGY PTS. · `6` HEAT CAP. `` Inline code is the only "frame" Discord draws, and it renders the same on every client. Three cells per line keep a chassis to three lines on a phone. |
| **Traits as Tags** (E17: `[Burn \| 2]`) | One line of linked tags: `[Burn](…) 2 · [Hot](…) 1`. **No "//" line**, which E17 retires. |
| **Actions as bands** | `### Name`, its own stat cells, then its body. Where the action rolls on a table, the band is a Section with a **Roll** button accessory. |
| **Table as a roll bar** (E14) | `-# ROLL THE DIE:` then one row per line, `` `11–19` **Success**: … ``, with the rolled row marked (`▶` and bold). Plus a Roll button. |
| **Cite** (`EntityModel.cite`) | `-# Workshop Manual p.100 · salvageunion.io/chassis/mule`: the citation, then the bare path, as the OG card's foot prints it (`ogAddress` in `apps/srd/src/lib/ogCard.ts`). |
| **Rust = action** | Discord's Primary button style is the one action per message (Roll, Roll again). Everything else is Secondary or a Link button. Masked links draw in Discord's link colour, which stands in for `InlineRef`. |
| **Canon solid, homebrew dashed** (§3.9) | No dashes in Discord. A user-made NPC or pattern (`userMade`) gets a `-# USER-MADE · Made by <name>` line in place of the cite. |
| **Art** (E10) | The section thumbnail, as today, but pinned to the **title and stats only** (fixes G6). Where the model's art is a censor mark, show nothing, or a Media Gallery hero (§5.4). |
| **11px type floor, 44px touch** | The `##` headline is about 27px on a phone. Keep the existing 52-char quote cap and the 60-char inline headline cap. Prefer one select over a second row of buttons. |

### Sketch: a chassis

```text
-# CHASSIS                                                   [art]
## [Mule](https://salvageunion.io/schema/chassis/item/mule)
`1` TECH LEVEL · `7` SALVAGE VALUE
`12` STRUCTURE PTS. · `4` ENERGY PTS. · `6` HEAT CAP.
`16` SYSTEM SLOTS · `2` MODULE SLOTS · `16` CARGO CAP.
───
The 'M-63' Mule was developed by the Opus Institute …
### Integrated Cargo Bay
Increases the Cargo Capacity of The Mule by 10, to 16.
───
-# PATTERNS (6)
**Hauler** · `7` systems · `2` modules · legal starting
**Crusher** · `7` systems · `2` modules   …
[Open a pattern… ▾]
-# Salvage Union Workshop Manual p.100 · salvageunion.io/chassis/mule
[Overview] [Patterns] [Open on salvageunion.io]
```

### Sketch: a roll

```text
-# REACTOR OVERLOAD · rolled by Alex
## 14 — REACTOR OVERHEAT
-# Lands on 11–19
Your Mech's reactor has overheated. Your Mech shuts down and gains the
[Vulnerable](https://salvageunion.io/schema/traits/item/vulnerable) Trait. …
───
-# Salvage Union Workshop Manual p.235 · Powered by Randsum.dev
[↻ Roll again] [Whole table] [Open on salvageunion.io]
[Explain… ▾]
```

An action row holds five buttons **or** one select, so the select gets its own
row. The accent keeps the tier ramp, which is the one sanctioned bot-only
colour (ruleset §3.4) and has already shipped.

---

## 4. Roll tables: ideas

Grouped by goal. Each line is an option, not a commitment.

### Readable

- **R1. Link the trait refs** (G2): run the roll body through the same
  `linkifyTraitRefs` the lookup card uses. Small, and closes a visible defect.
- **R2. Show the range** (G3): `-# Lands on 11–19` under the headline, as board
  08b's "Lands on" does. A tier word already tells Core Mechanic rollers where
  they are. On every other table the range is the only cue.
- **R3. Columns tables** keep `3·14`, and add which column was hit:
  `-# Column 3 · Entry 14`.

### Links back

- **R4. Deep-link the exact result.** The SRD page could read `?roll=14` (and
  `?roll=3-14` for columns) and open with that row marked and the "You rolled"
  panel filled. "See table" would then land on *this* result, not a blank page.
  This is an srd change (`RollTableIsland`), and the URL also works for anyone
  sharing a roll from the web.
- **R5. Rename "See table"** to say where it goes ("Open on salvageunion.io").
  It is a Link button to the web page, not the `lookup` card the `su:lookup`
  customId still supports.

### All the information

- **R6. "Whole table" button** → an ephemeral (or in-place) banded table, all
  rows, with the rolled row marked. It's the d20 map the book prints beside every
  result. 20 rows of up to 462 chars won't fit one container, so the big tables
  page or truncate per row. Anomalous Zone is about 6,200 chars.
- **R7. The table's rules text.** 39 tables have `content` prose explaining
  when and how to roll. Add a `Rules` button that answers ephemerally, or a
  one-line `-#` summary when it is short.
- **R8. Dramatic tables** (`dramatic`, only a 20 does anything) already render
  "No effect". Add the 20's text, so the roller knows what they missed.
- **R9. Chained tables.** An entry that tells you to roll on another table gets
  a Roll button for that table, in a Section accessory beside the line.
  Abilities and systems whose action has `tableName` get the same button on
  their lookup card (G7).

### Contextual

- **R10. "Explain…" select menu** under a result: one option per entity the
  result refers to (traits, other tables, systems). Picking one answers
  ephemerally with that entity's card. Only the person who asked sees it, and
  the channel stays clean. This is the closest Discord gets to the web's
  tooltips. Masked links show only a URL on hover.
- **R11. "Rolled real dice?"** Board 08b has a field for a physical roll.
  Discord can do the same two ways: a `result:` integer option on `/su roll`
  (min 1, max 20), or a button that opens a modal with a number input. Either
  renders the row for that number with no Randsum roll. It's labelled
  "entered", not "rolled", so the log stays honest.
- **R12. Roll history on one message.** The web keeps the last five rolls. In
  Discord, "Roll again" could *update* the message and append an "Earlier rolls"
  line rather than post a new one. **Trade-off:** today's reply-per-roll is
  deliberate (`apps/discord-bot/src/buttons.ts`: every roll stays in channel history, and each
  is logged to the Game). Offer it, if at all, as a private-roll mode only.

---

## 5. Lookup: all the information without the wall

The budget is 4,000 characters and 40 components per message. Five options,
which combine:

### 5.1 Tabs that redraw the card (recommended)

Buttons under the card (`Overview · Abilities · Patterns · Table`) answer with
an `UPDATE_MESSAGE` that redraws the same container on another view. It mirrors
the phone form's unit tabs (ADR-045 §3): one surface, several views, nothing
dropped. Stateless, like every other button here:
`su:view:<schema>::<slug>:<tab>` fits in 100 characters, because the longest
slug is 44. Tabs appear only when the entry has that content.

Open question: on a public message, anyone's tap changes everyone's view. Fine
for reference, but the alternative is to answer a tab ephemerally for the tapper.

### 5.2 Pages inside a tab

Where one tab still overflows (a 20-row table, a class's full trees), add
`‹ 1/3 ›` paging with the same `UPDATE_MESSAGE` and an encoded page number.
Never cut mid-entry. A page break falls between rows or abilities.

### 5.3 Nested entities as a select, never inline

The nesting laws (ruleset §1 Listing, EDL E6): nested entities live inside
the parent as Rows, and the next level down is a link or a Peek. In Discord that is a **string select**
under the card: "Open a pattern… / a system… / a trait…" (25 options max).
Picking one answers ephemerally with that entity's Peek: a compact card,
read-only and terminal (EDL E16), with a Page link and no select of its own. A chassis's patterns, a pattern's systems, a class's abilities and a
crawler's bays all fit this shape. The model already groups them
(`EntityModel.children`). It fixes G7 without growing the parent.

### 5.4 The OG card as a hero image

Every entity page already has a 1200×630 preview card, rendered from the same
components as the page (`OgCard`, issue 1280), at
`/schema/{schemaId}/item/{itemId}.og.png`. A Media Gallery item could show it
at the top of a lookup: the design-refresh card itself, drawn by our own CSS,
inside Discord. Caveats:

- generation is best-effort (`og-srd` in `deploy-cloudflare.yml`), so the bot
  needs a fallback when the PNG didn't land;
- the image is decorative to a screen reader, so the text below stays complete;
- it costs vertical space on phones. Use it on the Overview tab only.

### 5.5 Ephemeral "full entry"

The bluntest option: a button that sends the whole entry as ephemeral
follow-ups, split at section boundaries. Noisy, but complete, and it touches
nothing else.

### Also for lookup

- **L1. Autocomplete that says what each hit is.** `Mule · Chassis · TL1`, not
  `Mule`. The choice name allows 100 chars. Many names repeat across schemas
  (an ability and its action, a system and a module).
- **L2. An optional `type:` filter** on `/su lookup` (chassis, systems,
  abilities…), with fixed choices.
- **L3. Empty-query autocomplete** lists the most-used entries (Core Mechanic,
  Critical Damage, the Keywords) rather than nothing.
- **L4. Errors in the system** (G8): "No such entry" as a container with the
  three closest hits as buttons, the same as `unknownTableContainer`.
- **L5. Book stat labels and order** (G4), and the thumbnail pinned to the
  title alone (G6).

---

## 6. New ways in

- **N1. User install.** Register `integration_types` for guild and user
  install, with `contexts` for guilds, bot DMs and private channels. Players
  could then use `/su lookup` and `/su roll` in any server, or in DMs, with no
  admin adding the bot. In a server without the app, replies may be forced
  ephemeral (when the server denies "Use External Apps"), and an interaction
  gets at most 5 follow-ups. A public roll there may land privately, so the
  reply should say so. The Game commands still need the bot in the server and
  a bound channel, and they say so.
- **N2. Message context menu: "Look up in Salvage Union".** Right-click any
  message → Apps → the bot finds entity names in its text (the search index
  already exists) and answers ephemerally with a select of matches. "What does
  Vulnerable do?" without typing a command. An app may register 15 message and
  15 user commands, so there is room for more later.
- **N3. User context menu: "View sheet".** Right-click a player in a bound
  channel → their sheet in this Game, with the same visibility rules as
  `/su sheet` (ADR-030). Read-only, like everything the bot reads.
- **N4. Link previews become the card (Component Embeds).** A salvageunion.io
  link pasted in chat already unfurls as the OG card, with `theme-color` as
  Discord's side bar. With Component Embeds (§2), each entity page could also
  carry a V2 container in its `<head>`: the kicker, the title, the stat cells,
  the "//" line, a thumbnail and an "Open" link button. Every pasted link would
  then render as our card, for everyone, with no bot involved. If the bot's
  container builders moved to a shared package, the SRD build could emit the
  same JSON the bot sends (within the 3,000-byte cap, so a summary, not the full
  entry), and the two could never drift. The page's OG tags and image stay as
  the fallback.
- **N5. Application emoji** (uploaded to the app, usable in any server the app
  reaches). A small set could stand in for marks Discord can't draw: a d20, the
  TL badges, the cost pennant. **Caution:** emoji render at text size, can't
  meet the 11px floor's intent for labels, and cost alt text. Use them for
  marks, never for words.
- **N6. Activities** (long term). An embedded web app inside a voice channel
  could host the real ITUN Dashboard or SRD pages. It's the biggest lift here,
  and the only one that gives full fidelity. Park it until the bot's text
  surfaces are right.

---

## 7. A possible order

Each phase stands alone. P0 is fixes; the rest is new surface and needs an
explicit go-ahead (CLAUDE.md, "Critical Rules").

| Phase | What | Size |
| --- | --- | --- |
| **P0: fixes** | R1 trait links on rolls · G1 tone accent off rust · R2 range line · cite on roll footer · L4 lookup errors in-system · L5 book stat labels, thumbnail pinned to the title | small, bot only |
| **P1: lookup on the model** | G0 render `toEntityModel` (tone, `bookStats`, traits as tags, actions as banners, cite) · 5.1 tabs · 5.2 pages · 5.3 nested select · L1 autocomplete labels | medium, bot only |
| **P2: roll context** | R6 whole table · R7 rules text · R9 chained-table buttons · R10 Explain select · R11 entered rolls | medium, bot only |
| **P3: new ways in** | N1 user install · N2 message context menu · N3 view sheet | medium, bot + registration |
| **P4: cross-app** | N4 Component Embeds on SRD pages · R4 `?roll=` deep links (srd) · 5.4 OG hero image · N5 emoji · G10 branding with #1244 | larger, touches srd/packages |

## 8. Questions for the owner

1. **Accent.** The entity's tone on every reference card, and rust gone from
   the bot entirely? Two cases have no good tone:
   - **"Do" entities** (abilities, actions) are `ink`, and `--color-ink`
     (#282019) nearly disappears on Discord's dark background. Options: the
     ability's tier tone, `--color-ink-2`, or no accent at all (`null`).
   - **System replies** (errors, invites): rules blue, or no accent?
2. **Tabs: shared or personal?** A tab tap redraws a public message for
   everyone. Is that acceptable, or should tabs answer ephemerally?
3. **Roll history:** one message that grows, or keep a message per roll?
4. **User install:** wanted? It widens where the bot appears, and the Game
   commands then need a clear "not here" reply.
5. **Branding:** what should a reply's foot say once #1244 lands:
   "salvageunion.io", "ITUN", or the Union bar's wording?
6. **Hero image:** is the OG card the right picture of an entry inside
   Discord, or does the artwork thumbnail stay the only image?
7. **Component Embeds:** worth a spike on the SRD? It is the widest-reaching
   item here. Every pasted link benefits, including in servers without the bot.
