/**
 * The `/su roll` surface, as a Components V2 container. Unlike the entity
 * cards (`container.ts#entityCard`), a roll authors its own blocks: a headline
 * and a body are not an entity's shape.
 *
 * Most tables carry no labels, so an unlabelled entry must never get a bare
 * `Roll: N` headline with the actual result demoted to body copy.
 *
 * ## The headline rule
 *
 * Three branches, no per-table special-casing. The die leads the headline in
 * all three — it is the one number a roller looks for:
 *
 * 1. The entry has a `label` → the label is the headline, the value is the body.
 * 2. No label, value ≤ {@link INLINE_HEADLINE_MAX} → **the value is the
 *    headline**, and there is no body. This is what rescues an unlabelled
 *    table: "Red Mesa Mutants" becomes the headline rather than body copy under
 *    the word "Roll: 14".
 * 3. No label, longer value → quote the entry's own leading sentence as the
 *    headline when it already reads as a name ({@link deriveLabel}); otherwise
 *    the tier word where one applies, else the die number alone. The value is
 *    the body either way.
 *
 * ## Why the tier word is Core-Mechanic-only
 *
 * `coreRollBandLabel` names the bands of *the Core Mechanic*. On an outcome
 * table an 11–19 can mean "your Union Crawler is inoperable and grounded",
 * which the band vocabulary would label **SUCCESS**, so the word is withheld
 * there while the colour ramp stays.
 */

import type { RefRollTable, RollOnTableOutcome } from 'salvageunion-reference'
import {
  DISCORD_NEUTRAL_ACCENT,
  DISCORD_ROLL_ACCENT,
  discordCiteLine,
  linkTraitReferences,
  plainTraitText,
  rangeLabel,
  toEntityModel,
  truncate,
} from 'salvageunion-reference'
import type { CoreRollBand } from 'salvageunion-reference/rules'
import { coreRollBand, coreRollBandLabel } from 'salvageunion-reference/rules'
import type { ContainerBlock, ContainerData } from './container'
import { deriveLabel } from './derivedLabel'
import { ROLL_ATTRIBUTION } from './format'

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
 * "Sparkles", not a catastrophe, and painting it cascade red would be active
 * misinformation on 21 tables.
 */
const TIERED_TABLE_TYPES = new Set([
  'standard',
  'bio-chassis',
  'octet',
  'alternate',
  'salvage-cache',
])

export function isTieredTable(table: RefRollTable): boolean {
  return TIERED_TABLE_TYPES.has(table.table.type)
}

/** Optional context a caller can stamp onto a roll. */
export type RollContext = {
  /** Display name of whoever rolled, for the context line. */
  roller?: string
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

/**
 * `## 14 — SUCCESS`, or `## 14` when there is nothing to say beside the die.
 *
 * ## Why an em dash
 *
 * A TextDisplay has no colour and a heading is already bold, so punctuation is
 * the only break between the die and the outcome; an em dash is the widest one
 * that renders identically everywhere.
 *
 * One choke point deliberately: every headline on every roll surface comes
 * through here, so the separator cannot drift between them. `errorContainer.ts`
 * imports it for the same reason.
 */
export function rollHeadline(die: string, rest?: string): string {
  return rest !== undefined && rest.length > 0 ? `## ${die} — ${rest}` : `## ${die}`
}

/**
 * Headline + optional body, per the three-branch rule above.
 *
 * `band` is null on an untiered table, which is also what withholds the tier
 * word from branch 3.
 */
function headlineAndBody(
  die: string,
  label: string | undefined,
  value: string,
  band: CoreRollBand | null,
  isCoreMechanic: boolean
): { headline: string; body?: string } {
  if (label !== undefined && label.length > 0) {
    return { headline: rollHeadline(die, stencil(label)), body: value || undefined }
  }
  // A headline is a heading: it prints a trait's name, never its markup.
  if (value.length > 0 && value.length <= INLINE_HEADLINE_MAX) {
    return { headline: rollHeadline(die, stencil(plainTraitText(value))) }
  }
  // The entry's own words, where they already read as a name. Never a
  // truncation and never a paraphrase — see derivedLabel.ts.
  const quoted = deriveLabel(value)
  if (quoted !== undefined) {
    // The remainder, not the whole value — the quoted sentence has been
    // promoted to the headline and must not be repeated beneath it.
    return {
      headline: rollHeadline(die, stencil(plainTraitText(quoted.label))),
      body: quoted.rest,
    }
  }
  const tier = band !== null && isCoreMechanic ? stencil(coreRollBandLabel(band)) : undefined
  return { headline: rollHeadline(die, tier), body: value || undefined }
}

/**
 * Where the die landed, as board 08b's "Lands on" readout: the band's range
 * ("11–19"), or on a two-roll table the column and the entry. The tier word
 * and the label say what happened; this says which row of the book it is.
 */
function landsOn(outcome: Extract<RollOnTableOutcome, { kind: 'flat' | 'columns' }>): string {
  return outcome.kind === 'columns'
    ? `Column ${rangeLabel(outcome.columnKey)} · entry ${rangeLabel(String(outcome.entryKey))}`
    : `Lands on ${rangeLabel(outcome.key)}`
}

/**
 * Shape a table roll into container data.
 *
 * Pure: takes the resolved table, the outcome and optional context, and returns
 * blocks.
 */
export function buildRollContainerData(
  table: RefRollTable,
  outcome: Extract<RollOnTableOutcome, { kind: 'flat' | 'columns' }>,
  context: RollContext = {}
): ContainerData {
  const tiered = isTieredTable(table)
  const isCoreMechanic = table.name === CORE_MECHANIC

  // The tier reads off the entry roll on a columns table — the column roll only
  // selects which sub-table you are on and carries no outcome meaning.
  const tierRoll = outcome.kind === 'columns' ? outcome.entryRoll : outcome.roll
  const band = tiered ? coreRollBand(tierRoll) : null

  // Bare numbers. A columns table rolls twice, so both are shown separated by
  // a middot.
  const die =
    outcome.kind === 'columns' ? `${outcome.columnRoll}·${outcome.entryRoll}` : String(outcome.roll)

  const { headline, body } = headlineAndBody(
    die,
    outcome.label,
    outcome.value,
    band,
    isCoreMechanic
  )

  const blocks: ContainerBlock[] = [
    { kind: 'text', content: contextLine(table.name, context.roller) },
  ]

  blocks.push({ kind: 'text', content: headline })
  blocks.push({ kind: 'text', content: `-# ${landsOn(outcome)}` })
  // Cut first, then link: a cut can never land inside a link it made.
  if (body !== undefined) {
    blocks.push({ kind: 'text', content: linkTraitReferences(truncate(body, 1800)) })
  }

  blocks.push({ kind: 'separator' })
  blocks.push({
    kind: 'text',
    content: `-# ${discordCiteLine(toEntityModel(table))} · ${ROLL_ATTRIBUTION}`,
  })

  return {
    accent: band !== null ? DISCORD_ROLL_ACCENT[band] : DISCORD_NEUTRAL_ACCENT,
    blocks,
  }
}
