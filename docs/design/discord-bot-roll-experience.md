# Discord bot — beautifying the rolling experience

**Status:** proposal · **Date:** 2026-09-01 · **Surface:** `apps/discord-bot`

A design review of `/su roll` and `/su check`, with a prioritised change list.
Every measurement below was executed against this checkout; claims that could
not be verified locally are marked **unverified** and each is a one-message
live test.

---

## 1. The finding

**The bot communicates the roll outcome tier with colour and nothing else, and
on 76 of 96 tables it does not communicate the result at all.**

`buildRollEmbedData` (`apps/discord-bot/src/format.ts:223-232`) titles the embed
`outcome.label ?? \`Roll: ${outcome.roll}\``. Where a table entry has no `label`,
the headline becomes the literal string `Roll: 14` and the actual result is
demoted to body copy.

Measured by running every roll 1–20 through the real `rollOnTable` against
`packages/salvageunion-reference/data/roll-tables.json`:

| | |
|---|---|
| Tables where **every** roll renders `Roll: N` | **76 of 96** |
| Share of all possible rolls that render `Roll: N` | **1,482 / 1,882 = 78.7%** |
| Entries carrying a `label` | 139 of 833 |

This is not confined to name-generator tables. **54 of the 69 `standard`
tables** are unlabelled — including *Crawler Damage*, *Crawler Destruction*,
*Chimerium Exposure*, *Meteor Encounter*. Those are monotone 1→20 outcome
ramps used in ordinary play, where the tier genuinely applies.

Meanwhile the tier *vocabulary already exists and is exported*:

```ts
// packages/salvageunion-reference/lib/rules/coreMechanic.ts:37-68
export const CORE_ROLL_BANDS = {
  nailed:  { label: 'Nailed It',       range: '20',    summary: 'An outstanding success — …' },
  success: { label: 'Success',         range: '11–19', summary: 'You achieve your goal …' },
  tough:   { label: 'Tough Choice',    range: '6–10',  summary: 'You succeed, but …' },
  failure: { label: 'Failure',         range: '2–5',   summary: 'You fail, and face a Setback …' },
  cascade: { label: 'Cascade Failure', range: '1',     summary: 'Something has gone terribly wrong — …' },
}
```

Exported from `lib/rules/index.ts:58-59`. The bot imports none of it — it
hand-duplicates the same thresholds in `getColor()` (`format.ts:45-51`) and
surfaces only the colour. The web pairs colour with a label
(`ActionsDeck.tsx:230-247`); the bot has colour alone, which also breaks the
project's own rule that colour is never the only signal.

**The redesign is mostly a matter of reading data the bot already has.**

---

## 2. What the embed looks like now

### `/su roll` — flat/standard table

| Slot | Value | Source |
|---|---|---|
| author | `Salvage Union` + bot avatar — **only if an avatar resolves** | `roll.ts:67` |
| title | `outcome.label ?? "Roll: N"` — no `url` | `format.ts:224` |
| description | `outcome.value`, omitted when empty | `format.ts:226` |
| colour | `getColor(roll)` — applied to **every** table | `format.ts:45-51` |
| fields | `Table` / `Roll` / `Range`, all `inline` | `format.ts:228-230` |
| footer | `Salvage Union Reference · Powered by Randsum.dev` | `format.ts:196` |
| thumbnail / image | never set | — |

### `/su roll` — columns table (Callsign Table, the only one)

Same, except the result text **is** the title and there is **no description at
all** (`format.ts:208-222`). `outcome.label` is dropped on this branch.

### Problems visible in the layout

1. **The tier is never written.** On 76 tables the headline is a number; on the
   rest it is a flavour label ("Meat and Potatoes") that does not say whether
   you succeeded.
2. **The die result is the smallest text in the embed** — a field value under a
   field name that renders at a similar size.
3. **Three inline fields cost ~6 lines of mobile chrome for ~12 characters.**
   Discord gives an embed ~280–320px on a phone; three inline fields stack.
4. **`Roll` and `Range` are the same number** on many tables (`Roll: 20 /
   Range: 20`).
5. **Tier colour is applied to tables that have no tiers.** Rolling a 1 on the
   Callsign Table paints the embed cascade red and implies "Sparkles" is a
   catastrophe. Affects the 21 enumerative tables.
6. **`dramatic` tables have only a `20` key**, so 19 of every 20 rolls return
   `success: false` and render an internal diagnostic string as an error.
7. **Every error path leaves the design system** — plain ephemeral text, no
   embed, no colour, no recovery (`roll.ts:103`, `check.ts:84`,
   `buttons.ts:26-30`, `lookup.ts:143-147`).
8. **Button hierarchy is inverted.** `See table` is `Primary` (blurple, the one
   off-palette colour on the surface); `↻ Roll again` is `Secondary`
   (`customId.ts:96-97`).
9. **Nothing says who rolled.** The author slot spends the only per-roll
   identity on a third brand statement, and button re-rolls attribute weakly.
10. **`/su check` buries the total** — the title echoes your input, the total is
    the second field.

### Two colour defects

- **`0xb7410e` is off-canon**, in three copies (`format.ts:18`,
  `gameEmbed.ts:46`, `lookupEmbed.ts:50`). Canon rust is
  `--color-rust: rgb(168, 82, 34)` = `#a85222`, annotated in `theme.css:207` as
  "THE single action color". `0xb7410e` appears nowhere in the theme. This is
  the most-used embed colour in the bot.
- **`ROLL_COLORS` matches `theme.css:151-155` exactly** — no drift there. But
  nothing enforces the lockstep; `format.test.ts:25-33` only checks `getColor`
  against `ROLL_COLORS` itself, so both sides could drift silently.

---

## 3. Proposed hierarchy

### The exploitable fact

Discord renders `#`/`##`/`###` headers and `-#` subtext **inside embed
descriptions**, and `##` renders *larger than the embed title*. Field values
render markdown but in a ~⅓-width column where a header wraps badly; field
names do not render markdown at all.

**Consequence: all typography lives in the description. The roll embed has zero
fields.** Fields are a columnar primitive; a roll result is a headline with a
body. (`/su sheet` and `/su crew` have genuinely columnar data and keep theirs.)

### The band structure, identical on every roll

```
AUTHOR    <roller> rolled                  ← who
TITLE     █████ · TABLE NAME  (linked)     ← context + colour-free tier
##        ▌20▐ NAILED IT                   ← the shout
BODY      the outcome text
-#        d20 20 · band 20 · Core Book p.232
-#        █ LOGGED TO <GAME>               ← appended post-send, only if bound
FOOTER    Salvage Union Reference · Randsum.dev · timestamp
ACCENT    tier colour
```

### Tier eligibility — derive from `table.type`, don't hand-maintain

| Tiered — ladder, tier word, tier colour | Untiered — no ladder, neutral rust |
|---|---|
| `standard` 69, `bio-chassis` 2, `octet` 2, `alternate` 1, `salvage-cache` 1 | `flat` 16, `duos` 2, `columns` 1, `dramatic` 2 |

75 tiered, 21 untiered. This kills the Callsign-red bug and is derived from
authored data rather than a list that rots.

### Headline rule — three branches, no per-table special-casing

1. Entry has a **label** → label is the headline, value is the body.
2. No label, value **≤ 60 chars** → the value **is** the headline, no body.
3. No label, value **> 60 chars** → headline is the tier word (tiered) or the
   die plate alone (untiered); value is the body.

For the 54 unlabelled `standard` tables this resolves to
`## ▌14▐ SUCCESS` + the outcome text — which is exactly what `CORE_ROLL_BANDS`
was written to supply. It guarantees the `##` slot is never spent on the string
`"Roll: 14"`.

### "No entry" is a result, not an error

For `dramatic` tables, render a miss as a result in neutral rust:

```
BIO-TALON
## ▌7▐ NO EFFECT
-# d20 7 · this table only triggers on a 20
```

---

## 4. Mockups

### 4a. Core Mechanic, a 20 — before / after

**Before** · accent `#4b86a0`

```
⬤ Salvage Union
Nailed it
You have overcome the odds and managed an outstanding success. You may
achieve an additional bonus of your choice to the action.

Table              Roll               Range
Core Mechanic      20                 20

Salvage Union Reference · Powered by Randsum.dev · Today at 21:04
[ ↻ Roll again ]  [ See table ]        ← See table is blurple
```

**After** · accent `#4b86a0`

```
⬤ Vex Marrow rolled
█████ · CORE MECHANIC                  ← linked to salvageunion.io

## ▌20▐ NAILED IT

You have overcome the odds and managed an outstanding success. You may
achieve an additional bonus of your choice to the action.

-# d20 20 · band 20 · Core Book p.232

Salvage Union Reference · Randsum.dev · Today at 21:04
[ ↻ Roll again ]  [ See table ]        ← Roll again is now Primary
```

### 4b. Core Mechanic, a 1 — before / after

**Before** · accent `#b0432b` — laid out identically to a 14.

```
⬤ Salvage Union
Cascade Failure
Something has gone terribly wrong. You suffer a severe consequence of the
Mediator's choice.

Table              Roll               Range
Core Mechanic      1                  1
```

**After** · accent `#b0432b`

```
⬤ Vex Marrow rolled
█░░░░ · CORE MECHANIC

-# ▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚
## ▌1▐ CASCADE FAILURE

Something has gone terribly wrong. You suffer a severe consequence of the
Mediator's choice.

-# d20 1 · band 1 · Core Book p.232
```

The `▚▚▚▚` hazard tape appears on tier 1 **and nowhere else**. Restraint is
what gives it force. A natural 20 gets no equivalent — a full ladder and the
coolest colour on the ramp is already a crown.

### 4c. The case that actually looks broken — Crawler Damage (`standard`, unlabelled)

This is the 78.7% case, not an edge case.

**Before** · accent `#6f8a4a`

```
⬤ Salvage Union
Roll: 14                               ← the headline is a number
Your Union Crawler is inoperable and grounded. Its Bays are Intact, but
inoperable. You must pay your Union Crawler's Upkeep Cost in order…
                                       ↑ the answer is body copy

Table              Roll      Range
Crawler Damage     14        11-19
```

**After** · accent `#6f8a4a`

```
⬤ Vex Marrow rolled
████░ · CRAWLER DAMAGE

## ▌14▐ SUCCESS

Your Union Crawler is inoperable and grounded. Its Bays are Intact, but
inoperable. You must pay your Union Crawler's Upkeep Cost in order…

-# d20 14 · band 11-19 · Workshop Manual p.219
```

### 4d. Columns table — Callsign

**Before** · accent `#c19a3e` (tough — because the *column* roll was a 3;
meaningless). 80% chrome around one word, no description.

```
⬤ Salvage Union
Scorpion

Table              Column Roll        Entry Roll
Callsign Table     3 (1-4)            17 (#17)
```

**After** · accent `#a85222` (neutral rust — `columns` is untiered)

```
⬤ Vex Marrow rolled
CALLSIGN TABLE

## ▌3▐▌17▐ SCORPION

-# two d20 · column 1-4 (3) · entry 17
```

Two stamped plates make the two-roll mechanic visible instead of explaining it
in a field name.

### 4e. `/su check 2d6+3`

**Before** · accent `#b7410e`

```
⬤ Salvage Union
🎲 2d6+3                               ← echo of the input, largest slot

Notation           Total
2d6+3              11                  ← the answer, third in reading order

Dice
4, 4
```

**After** · accent `#a85222`

```
⬤ Vex Marrow rolled
2d6+3

## ▌11▐

`4` `4`  **+3**
```

Dice as inline code spans render as monospace boxes — small die plates that
wrap naturally at any width, which is what you want for `10d6`.

**SU-aware special case:** when the notation is exactly `1d20`/`d20` with no
modifier, the player is invoking the Core Mechanic — give it the full ladder
and tier. Scoped to *bare* `1d20` deliberately: Salvage Union reads the die raw
and has no `+N` modifiers, so tiering a modified total would be a rules error
dressed as a feature.

### 4f. Error — unknown table

**Before** — no embed; ephemeral plain text:

```
Could not find table: "criticl damage". Use autocomplete to see available tables.
```

**After** · ephemeral embed, accent `#a85222`

```
⬤ Salvage Union
NO SUCH TABLE

## ▌??▐ "criticl damage"

Nothing in the index matches that name. Closest three:

-# 96 tables indexed · start typing in the `table:` option for autocomplete

[ Critical Damage ]  [ Critical Injury ]  [ Crawler Damage ]
```

Two load-bearing points:

- **Errors are rust, never cascade red.** `--color-roll-cascade` means *you
  rolled a 1 and the fiction went wrong*. Reusing it for *you typed it wrong*
  conflates a game event with an input event.
- **Recovery needs no new plumbing** — the buttons are the existing
  `su:roll:<name>` custom id, and the fuzzy match comes from `search()`, already
  imported in `lookup.ts`.

---

## 5. Ornament system — one Unicode block, six glyphs, zero emoji

The bot already has an ornamental vocabulary: `gauge()` in `gameEmbed.ts` draws
vitals as `██████░░░░ 6/10` using **Block Elements** (U+2580–U+259F). A bot that
renders heat with `██████░░░░` and dice with 🎲 has two systems and belongs to
neither.

> **Every ornament on the roll surface comes from Block Elements. No emoji.**

| Glyph | Code | Job |
|---|---|---|
| `█` | U+2588 | lit segment — ladder, status LED |
| `░` | U+2591 | unlit segment — ladder |
| `▌` `▐` | U+258C / U+2590 | die-plate edges |
| `▚` | U+259A | hazard tape — natural 1 only |
| `▁` | U+2581 | optional hairline rule |

Three composed forms, never overlapping: **`▌20▐`** the die plate (die results
only); **`█████`** the tier ladder (tiers only, always five segments regardless
of band count); **`▚▚▚▚`** hazard tape (natural 1 only). Plus two established
carry-overs: `↻` on the re-roll button, and backtick code spans for `/su check`
dice.

`gauge()` is the shipped proof that this block renders correctly on every
Discord client.

### Rejected alternatives

- **🎲 emoji** — the visual signature of every generic dice bot; full colour
  against an otherwise monochrome panel; renders at wildly different sizes.
- **Custom app emoji per d20 face** — 20 assets to maintain, render at ~22px
  (no larger than a `##` glyph), buy nothing a `##`-scaled plate doesn't.
- **`⚀⚁⚂⚃⚄⚅`** — six faces. This is a d20 game.
- **ANSI code blocks** — tempting (real colour, true monospace) but rejected on
  three counts: it kills markdown *inside* the block, so no links, no headers;
  ANSI rendering is unreliable on mobile, the exact client this optimises for;
  and the accent bar already carries tier colour, so it would be a second
  channel for the same fact.
- **`▰▱`** — prettier, but Geometric Shapes has measurably weaker coverage than
  Block Elements, and consistency with `gauge()` beats the aesthetic delta.

### Accessibility, stated honestly

The ladder announces as "full block, full block, light shade…" to a screen
reader. That is real noise and it is the price of the mobile and colourblind
fix. Three mitigations, all deliberate: the ladder is **pure redundancy** (the
tier is always spelled in words in the `##` headline, so a screen-reader user
loses noise, never information); it appears **once per embed**, five glyphs; and
the die plate wraps a real number, so `▌20▐` announces the digits.

Uppercased tier text is announced letter-by-letter by some configurations. Caps
cannot be applied as a text transform in Discord, so this is a real cost of the
stencil voice — accepted, because the tier vocabulary is five short known
phrases. Body copy stays sentence case.

---

## 6. Interaction design

**Swap the button styles.** `↻ Roll again` → `Primary`, `See table` →
`Secondary`. One line in `customId.ts`. Blurple on the least-used control is
the single thing that makes this read as a generic Discord bot. Do **not** add
a third button — two is right under a three-line embed, and this message gets
posted a dozen times a combat.

**Autocomplete is already the table picker**, and it beats a select menu: 96
tables with substring matching versus a select's hard cap of 25.

**Move the ITUN Game signal out of the footer.** Today it appends to
`ROLL_EMBED_FOOTER`, producing `Salvage Union Reference · Powered by
Randsum.dev · recorded to Tenacity · Today at 21:04` — a real game fact buried
in attribution boilerplate, in the smallest text on the embed, and it is the
first thing to truncate on mobile. Give it its own line:

```
-# d20 20 · band 20 · Core Book p.232
-# █ LOGGED TO TENACITY
```

This satisfies the post-send constraint exactly as the footer does — every part
of an embed is rewritable via `editReply`; the constraint is only that the
content isn't known at send time. It is appended at the *bottom* of the
description, so nothing the player is reading reflows; the embed grows by one
line a few hundred ms after posting, which reads as the log confirming. Failure
stays silent, as `rollAttribution.ts:19-31` argues.

**The author slot → the roller** (`<name> rolled` + their avatar). The message
header already carries the bot's username, avatar and `BOT` tag, and the footer
carries `Salvage Union Reference`. Spending the only per-roll identity slot on
a third brand statement costs the one thing button re-rolls otherwise lose.
*(Verify component-reply attribution once before shipping — the one assumption
not checkable from source.)*

### Deliberately not proposed

- **A `Push` button.** Push is a re-roll costing 1 AP. A button that re-rolls
  without spending it invites the table to treat it as free; one that spends it
  writes another player's sheet — forbidden on every surface (ADR-030 §4, and
  the bot's own "reads widely, writes narrowly"). Needs an ADR-007 read first.
- **A thumbnail.** `su-assets` could serve one, but roll tables have **no
  artwork** (0 of 96 carry `hasArtwork`), and a thumbnail narrows the
  description column by ~80px — and the description is now the entire design.

---

## 7. Platform capabilities — verified against the pinned versions

Pinned: `discord.js` 14.27.0, `@discordjs/builders` 1.14.1, `@discordjs/rest`
2.6.3, `discord-api-types` 0.38.53. Deps live at
`apps/discord-bot/node_modules/`, not hoisted to the root.

| Capability | Status | Works over this Worker as built? |
|---|---|---|
| **Components V2** (`MessageFlags.IsComponentsV2 = 32768`) | ✅ available | ✅ **yes, no adapter change** |
| `Container/Section/TextDisplay/Separator/Thumbnail/MediaGallery` builders | ✅ available, unused | ✅ |
| `setImage` / `setThumbnail` / `setAuthor({url})` | ✅ available, unused | ✅ |
| Markdown `##` / `-#` / `<t:…:R>` as raw strings | ✅ | ✅ |
| `@discordjs/formatters` helpers (`heading`, `subtext`, `time`) | ⚠️ **not resolvable** — add to `package.json` | — |
| Application-owned custom emoji | ✅ available, unused | ✅ |
| `ButtonStyle.Link` + `setURL` | ✅ available, unused | ✅ |
| `ButtonBuilder.setEmoji` | ✅ available, unused | ✅ |
| Select menus | ✅ available, unused | ⚠️ `dispatch` routes all components to the button router |
| Modals | ✅ available, unused | ❌ no `showModal`, no `ModalSubmit` branch |
| Edit-in-place (`UpdateMessage = 7`) | ✅ available, unused | ❌ no `update()` on the contract |
| File attachments (generated dice images) | ✅ at REST layer | ❌ **adapter destroys binary** |
| Polls on `editReply` | ❌ not in the PATCH body type | — |
| `discord.js` as a **value** import | ❌ never — needs `node:child_process` etc. | type-only imports are fine |

Two results measured by executing the bot's own adapter code:

```
V2 container -> {"flags":32768,"components":[{"type":17,"accent_color":4949664,…}]}   ← intact
binary file  -> {"files":[{"name":"a.png","data":{"0":1,"1":2,"2":3}}]}               ← destroyed
```

**Components V2 is free** — a container passes through `toPlainPayload`
(`adapter.ts:174-184`) unchanged. **Generated dice images are not** — a
`Uint8Array` is JSON-walked into an object, so attachments need a `files`
passthrough that bypasses `toPlainPayload`, *plus* a defer, which collides with
the no-defer rule below. That is the dividing line between cheap and expensive.

**Unverified (Discord runtime, not encoded in any installed package):** the V2
content/embeds prohibition and its 40-component / 4000-char ceilings; that the
V2 flag cannot be toggled on an existing message; header/`-#`/ANSI rendering
*inside embed fields specifically*; masked-link rendering inside a V2
`TextDisplay`; the app-emoji cross-guild rendering guarantee. Each is one
throwaway message to confirm.

---

## 8. Constraints any implementation must respect

- **No deferring on roll commands.** `adapter.ts:26-29` rejects it deliberately
  — "the roll commands answer in microseconds — making every one of them
  flicker through a spinner would be a visible regression". Pinned by
  `soloMode.test.ts:26-38` and `http/__tests__/replay.test.ts:263-280`. Anything
  needing I/O to build the first embed forfeits this.
- **The footer edit flow.** `rollAttribution.ts:47-67` mutates `embeds[0]` only,
  edits with `{ embeds }` only (adding `components: []` would nuke the buttons),
  and must never throw. Moving the recorded signal into the description is
  compatible; going multi-embed is not.
- **Roll/check embeds bypass limit enforcement entirely.** They call bare
  `truncate` inline and have no total-length guard — fine today because payloads
  are small, but anything that inlines table rows must route through a real
  enforcer or hit a 400 (`EMBED_LIMIT.total = 6000`).
- **Solo mode must not regress** — roll/check/lookup behave identically with
  `ITUN_*` unset (`apps/discord-bot/CLAUDE.md`).
- **`customId` is capped at 100 chars**, payload unescaped and unversioned. The
  longest table name is 47 chars, so ~45 chars of headroom exist.
- **`setURL` throws on a malformed URL** (shapeshift `urlPredicate`) — a live
  hazard already documented at `config.ts:45`.
- **Tests pinning current shape** that must move: `format.test.ts:45-91`,
  `customId.test.ts:50-90`, `check.test.ts:39-84`, `roll.test.ts:31-71`,
  `connectedMode.test.ts:421-482`, `soloMode.test.ts:26-38`.

---

## 9. Prioritised changes

Impact per unit of effort, highest first. Items 1–10 are all **S** and live in
`format.ts` + `customId.ts`.

| # | Change | Effort | Impact |
|---|---|---|---|
| 1 | **Adopt the `## ▌die▐ TIER — LABEL` headline** with the three-branch rule, sourcing tier words from `CORE_ROLL_BANDS`. | S | **Fixes 78.7% of rolls.** The tier becomes unmissable; the die ~3× larger. |
| 2 | **Delete the three inline fields**; fold Table/Roll/Range into one `-#` line. | S | Removes ~6 lines of mobile chrome; ends `Roll: 20 / Range: 20`. |
| 3 | **Gate the tier ramp on `table.type`** — untiered types get neutral rust, no ladder. | S | Kills the "Callsign 1 = cascade red" misinformation on 21 tables. |
| 4 | **Swap button styles** — `Roll again` → Primary. | S | Removes blurple from the loudest control. One line. |
| 5 | **Fix `0xb7410e` → `0xa85222`** in all three copies. | S | Puts the bot's most-used colour back on canon. |
| 6 | **Add the `█████` ladder** to the title. | S | Colour-independent tier read; the a11y + mobile fix. |
| 7 | **Author slot → the roller.** | S | Restores identity on button re-rolls. |
| 8 | **Move the Game signal** to its own `-# █ LOGGED TO <GAME>` line. | S | Un-buries a game fact from boilerplate; survives truncation. |
| 9 | **`/su check`: total into `## ▌11▐`**, dice as code spans, drop 🎲 and the two fields. | S | The answer becomes the headline. |
| 10 | **Page citation** in the provenance line via `getPageReference`; link the title via `srdEntityUrl` (`entityUrl` in `format.ts:275` is currently dead code). | S | New capability at near-zero cost. |
| 11 | **Hazard tape on a natural 1.** | S | Makes the game's most dramatic beat look like it. |
| 12 | **Error embeds** in-system, with three fuzzy-matched recovery buttons reusing `su:roll:<name>`. | M | Turns the surface's only dead end into one tap. |
| 13 | **"No entry" → `NO EFFECT`**, not an error, on the two `dramatic` tables. | M | Stops an internal diagnostic leaking on 19 of 20 rolls. |
| 14 | **Bare-`1d20` tiering** in `/su check`. | M | Game-aware touch no generic dice bot has. |
| 15 | **`private: true`** + `Post to channel`, encoding the *result* in the custom id (`su:post:Core Mechanic:20`, 24 chars) so the shared roll is provably the one you saw. | M | Serves Mediator rolls and solo prep without a second command. |
| 16 | **`/su panel`** — a pinnable table console with a select of ~12 combat-facing tables. | L | A new play artifact rather than a restyle. |

**If only three ship: 1, 2, 3** — hierarchy, density, correctness. That alone
makes the surface read like a damage report instead of a dice bot.

Items 1–11 need **no** Components V2, no attachments, and no adapter changes.
V2 is available and free if a later pass wants containers; generated dice images
are the one genuinely expensive idea and are not recommended.

---

## 10. Open questions

1. **Is `DISCORD_BOT_AVATAR` actually set in production?** It is referenced only
   in a `wrangler.jsonc` comment (line 69) and is absent from `vars`. If it was
   never set via `wrangler secret put`, `client.user` is null and **no embed the
   bot emits carries the `Salvage Union` author at all** — the branding in
   `format.ts:10-15` would be aspirational. One check settles it. Change #7
   makes this moot for roll embeds by using the roller's avatar instead.
2. **Should `getColor` call `coreRollBand`** rather than duplicating the
   thresholds? Same numbers today; nothing prevents drift.
3. **Should the `ROLL_COLORS` ↔ `theme.css` lockstep be enforced by a check?**
   `tools/check-styling-ownership.ts` exists and already polices theme
   ownership.
4. **Does the Core Mechanic tier vocabulary fit outcome tables?** This is the
   biggest open risk in the proposal, and the Crawler Damage mockup above shows
   it: an 11–19 there means *"your Union Crawler is inoperable and grounded"*,
   which `CORE_ROLL_BANDS` would label **SUCCESS**. The colour ramp is
   defensible (20 = survives undamaged, 1 = destroyed, so higher is genuinely
   better), but the *word* "Success" over a grounded Crawler reads wrong.

   Three options, in preference order:
   - **Tier word only where the table is the Core Mechanic** (or an explicit
     allowlist), and elsewhere show the ladder + die plate with no tier noun.
     Keeps every gain from change #1 — the headline stops being `Roll: 14` —
     without asserting a judgement the table doesn't make.
   - Use a neutral positional vocabulary for non-Core tables (`BEST CASE` …
     `WORST CASE`), which is true of any monotone ramp.
   - Author `label`s into the 54 unlabelled `standard` tables in the dataset.
     Correct but expensive, and a data change rather than a bot change.

   **Recommendation: option 1**, and resolve this before implementing #1 — it
   changes what the headline says on 54 tables.
