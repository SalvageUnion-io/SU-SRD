/**
 * The `/su roll` and `/su check` surfaces, as Components V2 containers.
 *
 * Replaces `buildRollEmbedData` / `buildCheckEmbedData` in `format.ts`, which
 * are kept for now only until the other surfaces move across.
 *
 * ## The problem this fixes
 *
 * The embed builder titled every result `outcome.label ?? \`Roll: ${roll}\``,
 * and 76 of the 96 roll tables carry no labels at all. Simulated across every
 * roll 1–20 on every table, **1,482 of 1,882 outcomes — 78.7% — rendered a
 * headline of "Roll: 14"**, with the actual result demoted to body copy. That
 * includes 54 of the 69 `standard` tables: Crawler Damage, Crawler Destruction,
 * Chimerium Exposure. Ordinary play tables, not name generators.
 *
 * ## The headline rule
 *
 * Three branches, no per-table special-casing, and the `##` slot is never spent
 * on a number that is already on the provenance line:
 *
 * 1. The entry has a `label` → the label is the headline, the value is the body.
 * 2. No label, value ≤ {@link INLINE_HEADLINE_MAX} → **the value is the
 *    headline**, and there is no body. This is what rescues an unlabelled
 *    table: "Red Mesa Mutants" becomes the headline rather than body copy under
 *    the word "Roll: 14".
 * 3. No label, longer value → quote the entry's own leading sentence as the
 *    headline when it already reads as a name ({@link deriveLabel}); otherwise
 *    the tier word where one applies, else the die plate alone. The value is
 *    the body either way.
 *
 * ## Why the tier word is Core-Mechanic-only
 *
 * `CORE_ROLL_BANDS` names the bands of *the Core Mechanic*. Those words do not
 * always survive the move to an outcome table: an 11–19 on Crawler Damage means
 * "your Union Crawler is inoperable and grounded", which the band vocabulary
 * would label **SUCCESS**. The colour ramp is defensible there — 20 survives
 * undamaged, 1 is destroyed, so higher genuinely is better — but the word is
 * not, so it is withheld.
 *
 * This is the shape that becomes fully correct once the 54 unlabelled
 * `standard` tables gain authored labels: branch 1 then covers them, and the
 * label says what actually happened instead of a borrowed tier noun.
 */

import type { RollerRollResult } from '@randsum/roller'
import type { RollOnTableOutcome, SURefRollTable } from 'salvageunion-reference'
import { getEntitySlug, getPageReference, srdEntityUrl } from 'salvageunion-reference'
import type { CoreRollBand } from 'salvageunion-reference/rules'
import { CORE_ROLL_BANDS, coreRollBand } from 'salvageunion-reference/rules'
import type { ContainerBlock, ContainerData } from './container.js'
import { deriveLabel } from './derivedLabel.js'
import { NEUTRAL_EMBED_COLOR, ROLL_ATTRIBUTION, ROLL_COLORS, truncate } from './format.js'
import { diePlate, STATUS_LED, tierBanner } from './ornament.js'

/** Longest value that reads as a headline rather than as body copy. */
const INLINE_HEADLINE_MAX = 60

/** The name the Core Mechanic table is published under. */
const CORE_MECHANIC = 'Core Mechanic'

/**
 * Table shapes whose 1→20 ramp carries an outcome tier.
 *
 * Derived from the authored `table.type` rather than a hand-kept list of table
 * names, so it cannot rot. The excluded shapes — `flat`, `duos`, `columns`,
 * `dramatic` — are enumerative: rolling a 1 on the Callsign Table means
 * "Sparkles", not a catastrophe, and painting it cascade red (which the embed
 * builder did, unconditionally) was active misinformation on 21 tables.
 */
const TIERED_TABLE_TYPES = new Set([
  'standard',
  'bio-chassis',
  'octet',
  'alternate',
  'salvage-cache',
])

export function isTieredTable(table: SURefRollTable): boolean {
  return TIERED_TABLE_TYPES.has(table.table.type)
}

/** Optional context a caller can stamp onto a roll. */
export type RollContext = {
  /** Display name of whoever rolled, for the context line. */
  roller?: string
  /** Game name, when the roll was recorded. Rendered as a status line. */
  loggedTo?: string
}

/** Uppercase for the stencil voice, and normalise the dataset's mixed casing. */
function stencil(text: string): string {
  return text.toUpperCase()
}

/** `-# TABLE NAME · rolled by X` — the context line above the headline. */
function contextLine(tableName: string, roller?: string): string {
  const name = stencil(tableName)
  return roller ? `-# ${name} · rolled by ${roller}` : `-# ${name}`
}

/** `-# d20 14 · band 11-19 · Workshop Manual p.219` */
function provenanceLine(table: SURefRollTable, dice: string, band: string): string {
  const parts = [dice, band]
  const source = typeof table.source === 'string' ? table.source : undefined
  const page = getPageReference(table)
  if (source && typeof page === 'number') parts.push(`${source} p.${page}`)
  else if (source) parts.push(source)
  return `-# ${parts.join(' · ')}`
}

function loggedLine(game: string): string {
  return `-# ${STATUS_LED} LOGGED TO ${stencil(game)}`
}

/**
 * Headline + optional body, per the three-branch rule above.
 *
 * `band` is null on an untiered table, which is also what withholds the tier
 * word from branch 3.
 */
function headlineAndBody(
  plate: string,
  label: string | undefined,
  value: string,
  band: CoreRollBand | null,
  isCoreMechanic: boolean
): { headline: string; body?: string } {
  if (label !== undefined && label.length > 0) {
    return { headline: `## ${plate} ${stencil(label)}`, body: value || undefined }
  }
  if (value.length > 0 && value.length <= INLINE_HEADLINE_MAX) {
    return { headline: `## ${plate} ${stencil(value)}` }
  }
  // The entry's own words, where they already read as a name. Never a
  // truncation and never a paraphrase — see derivedLabel.ts.
  const quoted = deriveLabel(value)
  if (quoted !== undefined) {
    // The remainder, not the whole value — the quoted sentence has been
    // promoted to the headline and must not be repeated beneath it.
    return { headline: `## ${plate} ${stencil(quoted.label)}`, body: quoted.rest }
  }
  const tier = band !== null && isCoreMechanic ? ` ${stencil(CORE_ROLL_BANDS[band].label)}` : ''
  return { headline: `## ${plate}${tier}`, body: value || undefined }
}

/**
 * Shape a table roll into container data.
 *
 * Pure: takes the resolved table, the outcome and optional context, and returns
 * blocks. Re-invoking it with `loggedTo` set is how the Game signal is added
 * after the reply — see `rollAttribution.ts`.
 */
export function buildRollContainerData(
  table: SURefRollTable,
  outcome: Extract<RollOnTableOutcome, { success: true }>,
  context: RollContext = {}
): ContainerData {
  const tiered = isTieredTable(table)
  const isCoreMechanic = table.name === CORE_MECHANIC

  // The tier reads off the entry roll on a columns table — the column roll only
  // selects which sub-table you are on and carries no outcome meaning.
  const tierRoll = outcome.kind === 'columns' ? outcome.entryRoll : outcome.roll
  const band = tiered ? coreRollBand(tierRoll) : null

  const plate =
    outcome.kind === 'columns'
      ? `${diePlate(outcome.columnRoll)}${diePlate(outcome.entryRoll)}`
      : diePlate(outcome.roll)

  const dice =
    outcome.kind === 'columns'
      ? `two d20 · column ${outcome.columnKey} (${outcome.columnRoll})`
      : `d20 ${outcome.roll}`
  // "band" is the Core Mechanic's noun for a range of the d20. A columns table
  // has no bands — the second roll picks an entry — so name it accordingly.
  const bandKey = outcome.kind === 'columns' ? `entry ${outcome.entryKey}` : `band ${outcome.key}`

  const { headline, body } = headlineAndBody(
    plate,
    outcome.label,
    outcome.value,
    band,
    isCoreMechanic
  )

  const blocks: ContainerBlock[] = [
    { kind: 'text', content: contextLine(table.name, context.roller) },
  ]

  const banner = band !== null ? tierBanner(band) : null
  if (banner !== null) blocks.push({ kind: 'text', content: `-# ${banner}` })

  blocks.push({ kind: 'text', content: headline })
  if (body !== undefined) blocks.push({ kind: 'text', content: truncate(body, 1800) })

  blocks.push({ kind: 'separator' })
  blocks.push({ kind: 'text', content: provenanceLine(table, dice, bandKey) })
  blocks.push({ kind: 'text', content: `-# ${ROLL_ATTRIBUTION}` })
  if (context.loggedTo !== undefined) {
    blocks.push({ kind: 'text', content: loggedLine(context.loggedTo) })
  }

  return {
    accent: band !== null ? ROLL_COLORS[band] : NEUTRAL_EMBED_COLOR,
    blocks,
  }
}

/** The reference-site page for a roll table, for the `See table` link button. */
export function rollTableUrl(table: SURefRollTable): string {
  return srdEntityUrl('roll-tables', getEntitySlug(table))
}

/**
 * A bare `1d20` is the player invoking the Core Mechanic, so it earns the full
 * treatment. Deliberately *bare*: Salvage Union reads the die raw and has no
 * `+N` modifiers, so tiering `1d20+5` would be a rules error dressed as a
 * feature.
 */
export function isBareD20(notation: string): boolean {
  return /^\s*1?d20\s*$/i.test(notation)
}

/** Shape a `/su check` roll into container data. */
export function buildCheckContainerData(
  notation: string,
  result: RollerRollResult<unknown>,
  context: RollContext = {}
): ContainerData {
  const values = result.values.map((v) => String(v))
  const total = result.total

  const bare = isBareD20(notation) && values.length === 1
  const band = bare ? coreRollBand(total) : null

  const blocks: ContainerBlock[] = [
    { kind: 'text', content: contextLine(notation, context.roller) },
  ]

  const banner = band !== null ? tierBanner(band) : null
  if (banner !== null) blocks.push({ kind: 'text', content: `-# ${banner}` })

  const tier = band !== null ? ` ${stencil(CORE_ROLL_BANDS[band].label)}` : ''
  blocks.push({ kind: 'text', content: `## ${diePlate(total)}${tier}` })

  // Individual dice as inline code spans: each renders in a monospace box, so
  // the run reads as a row of small plates and wraps naturally at any width —
  // which is what 10d6 needs and a comma-joined field value never gave.
  if (!bare && values.length > 0) {
    const shown = values.slice(0, 40)
    const overflow = values.length - shown.length
    const dice = shown.map((v) => `\`${v}\``).join(' ')
    blocks.push({
      kind: 'text',
      content: overflow > 0 ? `${dice} -# +${overflow} more` : dice,
    })
  }

  blocks.push({ kind: 'separator' })
  if (band !== null) {
    blocks.push({ kind: 'text', content: `-# Core Mechanic · ${CORE_ROLL_BANDS[band].summary}` })
  }
  blocks.push({ kind: 'text', content: `-# ${ROLL_ATTRIBUTION}` })

  if (context.loggedTo !== undefined) {
    blocks.push({ kind: 'text', content: loggedLine(context.loggedTo) })
  }

  return { accent: band !== null ? ROLL_COLORS[band] : NEUTRAL_EMBED_COLOR, blocks }
}
