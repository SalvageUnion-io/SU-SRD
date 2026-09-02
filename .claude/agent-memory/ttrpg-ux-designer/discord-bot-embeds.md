# Discord bot — embed surface

Verified 2026-09-01 by reading `apps/discord-bot/src/`. Facts about the data
and the plumbing, not a component roster.

## Where things live

- `src/format.ts` — `buildRollEmbedData`, `buildCheckEmbedData`, `ROLL_COLORS`,
  `getColor`, `EMBED_LIMIT`, `enforceEmbedLimits`, `truncate`,
  `stripDanglingLink`, `entityUrl`, `ROLL_EMBED_FOOTER`, `BRAND_NAME`.
  `NEUTRAL_EMBED_COLOR = 0xb7410e` (rust) is module-private.
- `src/gameEmbed.ts` — **already owns the bot's only ornamental idiom**:
  `gauge(current, max, glyph='█')` → `██████░░░░ 6/10`, capped at 10 segments,
  proportional font so it does not align across fields. Any new dice typography
  must extend this block-element vocabulary, not add a second one.
- `src/lookupEmbed.ts` — the rich entity embed; sheds *description* under the
  6000-char cap where `gameEmbed` sheds *fields*.
- `src/customId.ts` — `su:<action>:<payload>`, 100-char cap, actions are
  `roll | check | lookup`. `rollResultRow(tableName)` = `↻ Roll again`
  (Secondary) + `See table` (Primary). `REROLL_SYMBOL = '↻'`, deliberately not
  an emoji.
- `src/commands/rollAttribution.ts` — records to a bound ITUN Game **after** the
  reply, then `editReply`s the footer to `… · recorded to <Game>`. Silent on
  failure by design. Any post-send signal must therefore live in an editable
  slot (all of them are; the constraint is only "not decided at send time").

## Roll-table data shapes (packages/salvageunion-reference/data/roll-tables.json)

96 tables. `table.type` is authored and is the reliable discriminator:

| type | n | shape |
|---|---|---|
| `standard` | 69 | exactly `1 / 2-5 / 6-10 / 11-19 / 20`; **54 of the 69 carry no labels** |
| `flat` | 16 | 20 singleton keys, **no labels** (Keepsake, Callsign-ish name tables) |
| `bio-chassis` | 2 | finer monotone bands, labelled, ALL-CAPS labels |
| `duos` | 2 | `1-2 … 19-20`, no labels, enumerative (Faction Encounter) |
| `octet` | 2 | `1 / 2-4 … 17-19 / 20`, no labels, monotone |
| `dramatic` | 2 | **only a `20` key** — 19/20 rolls hit the error path |
| `columns` | 1 | Callsign Table only — two d20s, no labels |
| `alternate` | 1 | `1 / 2-5 / 6-10 / 11-18 / 19-20` |
| `salvage-cache` | 1 | 11 monotone bands |

Consequences that bite:
- `getColor()` is applied to **every** table, so a 1 on the Callsign Table
  renders in cascade red. Tier colour only means something on monotone tables.
- Unlabelled tables fall into `buildRollEmbedData`'s flat branch with
  `outcome.label ?? 'Roll: N'` → the **title becomes "Roll: 14"** and the actual
  result is body text. **Measured: 76 of the 96 tables have zero labelled
  entries** (only 139 of 833 entries carry one), so this is the majority case,
  not an edge case. It is NOT confined to the name-table types — 54 of the 69
  `standard` tables are unlabelled too (e.g. Meteor Encounter, p.9), and those
  are monotone outcome ramps where the tier genuinely applies. `CORE_ROLL_BANDS`
  (`salvageunion-reference/lib/rules/coreMechanic.ts`) already supplies the
  label/range/summary the title should be using.
- `columns` results carry no description at all (title + 3 fields only).
- Critical Damage / Mech Salvage / Area Salvage are `standard`, NOT `columns` —
  a common mis-assumption.

## Discord rendering facts the design depends on

- Embed **descriptions** render `#`/`##`/`###` headers and `-#` subtext.
  `##` is visually LARGER than the embed title. Field **values** render them too
  but in a ~1/3-width column, so they wrap badly; field **names** do not render
  markdown. Rule: all typography in the description, fields only for short
  label:value pairs.
- Inline fields collapse/stack on mobile; three inline fields cost ~6 lines of
  chrome for ~12 characters of payload.
- Embed footers are plain text — never clickable.
