/**
 * The card's pure cell and stat builders: what the sub-header row, the header's
 * stat cluster and the Bonus-per-Tech-Level box say, computed from the entity
 * without rendering anything.
 *
 * Split out of `ReferenceEntityCard.tsx`. Everything here is a
 * function of its arguments, so it is tested directly rather than through a
 * rendered card.
 */

import type {
  FacetCell,
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectBonusPerTechLevel,
  SURefObjectChoice,
  SURefObjectContentBlock,
} from 'salvageunion-reference'
import { facetCells } from 'salvageunion-reference'
import type { StatItem } from '../../containers/statsBarTypes'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { buildReferenceEntityStats } from '../referenceEntityStatsConfig'
import type { CardFacetCell } from './facetSplit'
import type { ActionFields } from './referenceEntityCardTypes'

/** The "modified stats" colour — a choice-touched or TL-scaled cell's border.
 * Ink, not rust: rust is an action's colour (ruleset §3.1), and a player's
 * change reads as `Stat`'s heavier solid `modified` frame, never the pencil
 * dash (pencil means the dash, ruleset §1, §3.9; ADR-026 §5). The sub-header
 * renders its cells as text today, so this marks the data
 * and draws nothing yet. */
const MODIFIED = 'var(--color-ink)'

/**
 * A facet of the entity model (`facetCells` in `salvageunion-reference`) as a
 * sub-header cell: a named rule keeps its glossary hovercard, and a facet a
 * choice or the Tech Level changed wears the modified border.
 */
function toSubHeaderCell(cell: FacetCell): CardFacetCell {
  return {
    key: cell.key,
    label: cell.label,
    ...(cell.value !== undefined ? { value: cell.value } : {}),
    ...(cell.mention ? { entityRef: cell.mention } : {}),
    ...(cell.modified ? { borderColor: MODIFIED } : {}),
    facet: {
      kind: cell.kind,
      ...(cell.short ? { short: cell.short } : {}),
      ...(cell.shortValue ? { shortValue: cell.shortValue } : {}),
      ...(cell.group ? { group: cell.group } : {}),
      ...(cell.actionType ? { actionType: cell.actionType } : {}),
      ...(cell.mention ? { mention: cell.mention } : {}),
      ...(cell.modified ? { modified: true as const } : {}),
    },
  }
}

/** `bonusPerTechLevel` fields → "+N" label-first chips (zeros/absent dropped).
 * Each entry is [field, first word, second word]; the chip's label joins the
 * two ("Structure Points"), and a Damage cell carries the second as its unit. */
const BONUS_LABELS: [keyof SURefObjectBonusPerTechLevel, string, string][] = [
  ['structurePoints', 'Structure', 'Points'],
  ['energyPoints', 'Energy', 'Points'],
  ['heatCapacity', 'Heat', 'Capacity'],
  ['systemSlots', 'System', 'Slots'],
  ['moduleSlots', 'Module', 'Slots'],
  ['cargoCapacity', 'Cargo', 'Capacity'],
  ['salvageValue', 'Salvage', 'Value'],
]

export type BonusCell = { key: string; label: string; bottomLabel: string; value: string }

export function bonusCells(bonus: SURefObjectBonusPerTechLevel): BonusCell[] {
  return BONUS_LABELS.flatMap(([field, top, bottom]) => {
    const amount = bonus[field]
    return typeof amount === 'number' && amount !== 0
      ? [{ key: `bonus-${field}`, label: top, bottomLabel: bottom, value: `+${amount}` }]
      : []
  })
}

/** What the entity's Tech Level resolves to once a host may be scaling it. */
export type TechScaling = {
  /**
   * EFFECTIVE tech level — the value that scales this entity: the Modification
   * choice cap (`cardinality.max.scalesWith: techLevel`) AND any `perTechLevel` datavalue
   * (e.g. Custom Sniper Rifle damage). The host `scalingParent.techLevel`
   * (controlled from without — the crawler level in the Cantina) wins over the
   * entity's own base TL. Floors at the base TL — a granted item is never below
   * its own tech level.
   */
  effTechLevel: number | undefined
  /** The header TL cell: the EFFECTIVE level (base, or bumped by the external
   * `scalingParent` control) on a TL-scalable entity, else the base. */
  techLevelDisplay: number | 'B' | 'N' | undefined
  /** Scaled above base — the TL cell wears the heavier solid `modified` frame. */
  techLevelModified: boolean
  /** A `perTechLevel` map (datavalue label, lowered → per-level increment) from
   * the entity's OWN datavalues, so a scaled value is highlighted as modified. */
  perTechLevelByLabel: Map<string, number>
  /** A datavalue that scales per Tech Level (e.g. Custom Sniper/Missile Damage
   * "+1 SP per Tech Level") is ALSO a Bonus-per-Tech-Level box (label / +N / unit). */
  dataValueBonuses: BonusCell[]
}

export function resolveTechScaling(
  entity: SURefMetaEntity,
  techLevel: number | 'B' | 'N' | undefined,
  entityChoices: SURefObjectChoice[],
  scalingParent: Record<string, unknown> | undefined
): TechScaling {
  const baseTechLevel = typeof techLevel === 'number' ? techLevel : undefined
  const scalingTechLevel =
    typeof scalingParent?.techLevel === 'number' ? scalingParent.techLevel : undefined
  const resolvedTechLevel = scalingTechLevel ?? baseTechLevel
  const effTechLevel =
    resolvedTechLevel !== undefined && baseTechLevel !== undefined
      ? Math.max(baseTechLevel, resolvedTechLevel)
      : resolvedTechLevel
  const perTechLevelByLabel = new Map<string, number>()
  const dataValueBonuses: BonusCell[] = []
  for (const block of 'content' in entity ? (entity.content ?? []) : []) {
    if (Array.isArray(block.value)) {
      for (const dv of block.value) {
        if (typeof dv.perTechLevel === 'number' && dv.label != null) {
          const label = String(dv.label)
          perTechLevelByLabel.set(label.toLowerCase(), dv.perTechLevel)
          dataValueBonuses.push({
            key: `dvbonus-${label.toLowerCase()}`,
            label,
            bottomLabel: typeof dv.unit === 'string' ? dv.unit : '',
            value: `+${dv.perTechLevel}`,
          })
        }
      }
    }
  }
  const isTechScalable =
    perTechLevelByLabel.size > 0 ||
    entityChoices.some((c) => typeof c.cardinality?.max === 'object')
  const techLevelDisplay = isTechScalable ? (effTechLevel ?? techLevel) : techLevel
  const techLevelModified =
    isTechScalable &&
    baseTechLevel !== undefined &&
    effTechLevel !== undefined &&
    effTechLevel > baseTechLevel
  return {
    effTechLevel,
    techLevelDisplay,
    techLevelModified,
    perTechLevelByLabel,
    dataValueBonuses,
  }
}

/**
 * The header's stat cluster.
 *
 * Stat LABELS are size-aware: `asCompact` abbreviates (SP, Cargo, …) for a
 * compact/nested/listing card, while a non-compact card keeps the full labels
 * (which may wrap two lines, which is fine). The card builds this TWICE for a
 * non-compact card, because the header measures itself and falls back to the
 * compact cells when it is too narrow to seat its value boxes (see
 * `narrowStats` on EntityCardHeader) — and those read "SV / SYS / MODS", not
 * the two-line long form.
 */
export function buildHeaderStats(options: {
  entity: SURefMetaEntity
  schemaName: SURefEnumSchemaName | 'actions'
  asCompact: boolean
  /** Actions and pattern LISTING rows carry no header stats at all. */
  none: boolean
  techLevel: number | 'B' | 'N' | undefined
  techLevelDisplay: number | 'B' | 'N' | undefined
  techLevelModified: boolean
}): StatItem[] {
  const { entity, schemaName, asCompact, none, techLevel } = options
  const rawHeaderStats: StatItem[] = none
    ? []
    : buildReferenceEntityStats(entity, {
        compact: asCompact,
        // Never 'actions' here — an action takes the `none` branch above.
        schemaName: schemaName === 'actions' ? undefined : schemaName,
        techLevel,
      })
  // TECH LEVEL is a header headline stat (value box), NOT a label pill — a
  // size-aware label ("Tech Level" full / "TL" compact), placed first in the
  // top-right cluster. `buildReferenceEntityStats` doesn't emit it, so add it.
  const techLevelStat: StatItem | undefined =
    !none && techLevel != null
      ? {
          key: 'tech-level',
          // Compact (horizontal) renders the SHORT form "TL" — the same
          // shortLabel treatment SP / EP / SV get, and the abbreviation players
          // actually use. Bare "Tech" was neither the full name nor the short
          // one. The full-size vertical value box keeps two-line "Tech" / "Level".
          label: asCompact ? 'TL' : 'Tech',
          bottomLabel: asCompact ? undefined : 'Level',
          value: String(options.techLevelDisplay),
          group: 'provenance' as const,
          // A TL-scalable item shows the EFFECTIVE level; a heavier solid `modified`
          // frame when above base (controlled from without via `scalingParent`).
          ...(options.techLevelModified ? { state: 'modified' as const } : {}),
        }
      : undefined
  return [
    ...(techLevelStat ? [techLevelStat] : []),
    // ATOM MODEL: compact = horizontal cells + SHORTFORM labels (SP, TL, Cargo, …).
    // Non-compact = the vertical value box with FULL two-line labels — the
    // slotsRequired stat reads "Slots" / "Required".
    ...rawHeaderStats,
  ]
}

/**
 * The SUB-HEADER cells — action type/range/damage/traits, then entity traits,
 * then every datavalue, with anything a choice or the Tech Level changed
 * marked "modified". The facets and their order are the entity model's
 * (`facetCells`, E17); this shapes them for the sub-header.
 *
 * CHOICE PLACEMENT: EVERYTHING INLINE — every choice
 * renders in the BODY, at its prose, in both modes; no choice is ever hoisted
 * to this row.
 */
export function resolveSubHeaderCells(options: {
  entity: SURefMetaEntity
  entityName: string
  /** The entity's own action fields, when the card IS an action. */
  action: ActionFields | undefined
  /** The lone action that folds into this entity's body, if any. */
  foldedAction: (ActionFields & { name?: string; content?: SURefObjectContentBlock[] }) | undefined
  entityChoices: SURefObjectChoice[]
  selections: ChoiceSelections | undefined
  perTechLevelByLabel: ReadonlyMap<string, number>
  effTechLevel: number | undefined
}): CardFacetCell[] {
  return facetCells({
    entity: options.entity,
    entityName: options.entityName,
    action: options.action,
    foldedAction: options.foldedAction,
    choices: options.entityChoices,
    selections: options.selections,
    perTechLevelByLabel: options.perTechLevelByLabel,
    effTechLevel: options.effTechLevel,
  }).map(toSubHeaderCell)
}
