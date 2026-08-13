/**
 * Pure embed-shaping helpers for the bot's commands — no discord.js
 * interaction objects, so everything here is unit-testable.
 */

import type { RollerRollResult } from '@randsum/roller'
import type { RollOnTableOutcome, SURefEntity } from 'salvageunion-reference'
import { getEntitySlug, srdEntityUrl } from 'salvageunion-reference'

/**
 * Author name stamped on every embed (paired with the bot's own avatar as the
 * icon, resolved at runtime). Consistent branding so replies read as one
 * official app rather than ad-hoc bot output.
 */
export const BRAND_NAME = 'Salvage Union'

/** Neutral SU rust tone for embeds without pass/fail semantics. */
const NEUTRAL_EMBED_COLOR = 0xb7410e

/**
 * Single source for the Core Mechanic roll-outcome embed colors. These mirror
 * the canon `--color-roll-*` ramp in
 * `packages/component-lib/src/styles/theme.css` — the tokens are the authority,
 * and each value here is the same rgb() converted to the 0xRRGGBB integer a
 * Discord embed needs. Keep in lockstep with theme.css; do not introduce
 * off-canon hues.
 */
export const ROLL_COLORS = {
  /** 20 · Nailed It — from `--color-roll-nailed: rgb(75, 134, 160)` (#4b86a0). */
  nailed: 0x4b86a0,
  /** 11–19 · Success — from `--color-roll-success: rgb(111, 138, 74)` (#6f8a4a). */
  success: 0x6f8a4a,
  /** 6–10 · Tough Choice — from `--color-roll-tough: rgb(193, 154, 62)` (#c19a3e). */
  tough: 0xc19a3e,
  /** 2–5 · Failure — from `--color-roll-failure: rgb(192, 122, 47)` (#c07a2f). */
  failure: 0xc07a2f,
  /** 1 · Cascade Failure — from `--color-roll-cascade: rgb(176, 67, 43)` (#b0432b). */
  cascade: 0xb0432b,
} as const

/**
 * Core Mechanic tier color for a d20 roll (20 Nailed It → 1 Cascade Failure),
 * drawn from the canon-mirroring {@link ROLL_COLORS} map.
 */
export function getColor(roll: number): number {
  if (roll === 20) return ROLL_COLORS.nailed
  if (roll >= 11) return ROLL_COLORS.success
  if (roll >= 6) return ROLL_COLORS.tough
  if (roll >= 2) return ROLL_COLORS.failure
  return ROLL_COLORS.cascade
}

/** Truncate to Discord's limits without splitting mid-word when possible. */
export function truncate(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max - 1)}…`
}

/**
 * Discord's embed limits, per the API.
 *
 * Lives here rather than in one builder because there are two of them —
 * `lookupEmbed.ts` and `gameEmbed.ts` — and only the first had these. The
 * second omitted `footer` and `total` entirely and enforced nothing beyond a
 * per-field truncate, which was harmless only for as long as its embeds stayed
 * three fields long. `total` is the one that bites: an embed over 6000 rendered
 * characters is rejected outright with a 400, so the reply fails rather than
 * degrading.
 */
export const EMBED_LIMIT = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
  footer: 2048,
  total: 6000,
} as const

/**
 * Any embed shape these helpers can trim. Both builders' types structurally
 * satisfy it, which is why this is a constraint rather than a shared base —
 * neither builder has to change its own exported type to be enforceable.
 */
export type EnforceableEmbed = {
  title: string
  url?: string
  description?: string
  fields: { name: string; value: string; inline?: boolean }[]
  footer: string
}

/**
 * `truncate` cuts at a character count and knows nothing about markdown, so a
 * cut can land inside `[label](url)` and Discord then renders the broken syntax
 * literally. If the tail holds an unterminated link (a trailing `[` with no
 * complete `](url)` after it), drop back to before that `[`.
 *
 * Was private to `lookupEmbed.ts`. Shared because collection fields on a sheet
 * embed are lists of links and are exactly the thing that hits a cap.
 */
export function stripDanglingLink(text: string): string {
  const lastOpen = text.lastIndexOf('[')
  if (lastOpen === -1) return text
  const tail = text.slice(lastOpen)
  // A complete link at the tail is fine; anything else is a dangling cut.
  if (/^\[[^\]]*\]\([^)]*\)/.test(tail)) return text
  return text.slice(0, lastOpen).trimEnd()
}

/** Rendered length as Discord counts it: title + description + fields + footer. */
export function embedLength(embed: EnforceableEmbed): number {
  const fields = embed.fields.reduce((n, f) => n + f.name.length + f.value.length, 0)
  return embed.title.length + (embed.description?.length ?? 0) + embed.footer.length + fields
}

/**
 * Apply every per-element cap: title, description, footer, field names/values,
 * and the 25-field count. Mutates and returns the same object.
 *
 * Field values are link-aware — a value trimmed to `fieldValue` runs through
 * {@link stripDanglingLink}, because a collection field is a list of markdown
 * links and truncating one mid-URL is how you ship visible `[Name](https://`.
 */
export function enforceElementLimits<T extends EnforceableEmbed>(embed: T): T {
  embed.title = truncate(embed.title, EMBED_LIMIT.title)
  embed.footer = truncate(embed.footer, EMBED_LIMIT.footer)
  if (embed.description !== undefined) {
    embed.description = truncate(embed.description, EMBED_LIMIT.description)
  }
  embed.fields = embed.fields.slice(0, EMBED_LIMIT.fields).map((f) => ({
    name: truncate(f.name, EMBED_LIMIT.fieldName),
    value:
      f.value.length > EMBED_LIMIT.fieldValue
        ? stripDanglingLink(truncate(f.value, EMBED_LIMIT.fieldValue))
        : f.value,
    inline: f.inline,
  }))
  return embed
}

/**
 * Trim an embed to fit Discord's 6000-character total, shedding whole fields
 * from the end until it does.
 *
 * Fields rather than description, because that is where a sheet keeps its
 * content — the opposite of `lookupEmbed`, whose body is one long description
 * and which therefore sheds the other way. Dropping a whole field is
 * deliberate: half a collection with no indication it was cut is worse than a
 * sheet that visibly stops, so the last surviving field is replaced with a
 * marker naming how many sections were dropped.
 *
 * The title and footer are never shed. If those alone exceeded the budget the
 * embed would be unfixable, and they cannot: 256 + 2048 leaves headroom.
 */
export function enforceEmbedLimits<T extends EnforceableEmbed>(embed: T): T {
  enforceElementLimits(embed)
  if (embedLength(embed) <= EMBED_LIMIT.total) return embed

  const dropped: string[] = []
  while (embed.fields.length > 0 && embedLength(embed) > EMBED_LIMIT.total) {
    const last = embed.fields.pop()
    if (last !== undefined) dropped.push(last.name)
  }
  if (dropped.length > 0) {
    const notice = {
      name: 'Trimmed',
      value: `${dropped.length} section${dropped.length === 1 ? '' : 's'} omitted — open the sheet for the rest.`,
      inline: false,
    }
    embed.fields.push(notice)
    // Adding the notice can itself re-cross the line on a pathological embed.
    while (embed.fields.length > 1 && embedLength(embed) > EMBED_LIMIT.total) {
      embed.fields.splice(embed.fields.length - 2, 1)
    }
  }
  return embed
}

type EmbedData = {
  title: string
  color: number
  description?: string
  url?: string
  fields: { name: string; value: string; inline: boolean }[]
}

/**
 * Footer for /su roll embeds. Rolls are powered by @randsum/roller, so the
 * roll output carries a "Powered by Randsum.dev" attribution (Discord embed
 * footers are plain text — not clickable — so the URL reads as bare text).
 */
export const ROLL_EMBED_FOOTER = 'Salvage Union Reference · Powered by Randsum.dev'

/** Shape a /roll outcome into embed data (works for flat + columns tables). */
export function buildRollEmbedData(tableName: string, outcome: RollOnTableOutcome): EmbedData {
  if (!outcome.success) {
    return {
      title: `Error rolling on "${tableName}"`,
      color: NEUTRAL_EMBED_COLOR,
      description: outcome.error,
      fields: [],
    }
  }
  if (outcome.kind === 'columns') {
    return {
      title: truncate(outcome.value, 256),
      color: getColor(outcome.entryRoll),
      fields: [
        { name: 'Table', value: tableName, inline: true },
        {
          name: 'Column Roll',
          value: `${outcome.columnRoll} (${outcome.columnKey})`,
          inline: true,
        },
        { name: 'Entry Roll', value: `${outcome.entryRoll} (#${outcome.entryKey})`, inline: true },
      ],
    }
  }
  return {
    title: truncate(outcome.label ?? `Roll: ${outcome.roll}`, 256),
    color: getColor(outcome.roll),
    description: outcome.value ? truncate(outcome.value, 4096) : undefined,
    fields: [
      { name: 'Table', value: tableName, inline: true },
      { name: 'Roll', value: String(outcome.roll), inline: true },
      { name: 'Range', value: outcome.key, inline: true },
    ],
  }
}

/**
 * The most individual dice we spell out in a `/su check` embed. Randsum is the
 * source of truth for what notation is *valid* (it parsed the string fine), but
 * `999d20` is valid and would blow past Discord's field limits — so we cap the
 * rendered dice list, not the roll itself. The total stays exact.
 */
const CHECK_MAX_SHOWN_DICE = 100

/**
 * Shape a free-form `/su check` roll (raw notation passed straight to
 * @randsum/roller) into embed data: echo the parsed notation, list the
 * individual dice, and show the total. Pure — takes the roller result, no
 * discord.js. Uses the neutral tone (2d6 has no d20 pass/fail semantics).
 */
export function buildCheckEmbedData(input: string, result: RollerRollResult<unknown>): EmbedData {
  const notation = result.rolls.map((r) => r.notation).join(', ') || input
  const values = result.values.map((v) => String(v))
  const shown = values.slice(0, CHECK_MAX_SHOWN_DICE)
  const overflow = values.length - shown.length
  const diceLine = shown.length
    ? `${shown.join(', ')}${overflow > 0 ? `, …(+${overflow} more)` : ''}`
    : '—'
  const descriptions = result.rolls.flatMap((r) => r.description)
  return {
    title: truncate(`🎲 ${input}`, 256),
    color: NEUTRAL_EMBED_COLOR,
    description: descriptions.length ? truncate(descriptions.join('\n'), 4096) : undefined,
    fields: [
      { name: 'Notation', value: truncate(notation, 1024), inline: true },
      { name: 'Total', value: String(result.total), inline: true },
      { name: 'Dice', value: truncate(diceLine, 1024), inline: false },
    ],
  }
}

/**
 * Item-page URL on the reference site. The host and the route grammar both
 * come from `srdEntityUrl` (salvageunion-reference), which is where the SRD's
 * path shape is defined — this is only the entity→slug step.
 */
export function entityUrl(schemaName: string, entity: SURefEntity): string {
  return srdEntityUrl(schemaName, getEntitySlug(entity))
}
