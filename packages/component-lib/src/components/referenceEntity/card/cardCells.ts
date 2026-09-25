/**
 * The card's pure cell and stat builders: what the sub-header row, the header's
 * stat cluster and the Bonus-per-Tech-Level box say, computed from the entity
 * without rendering anything.
 *
 * Split out of `ReferenceEntityCard.tsx` (audit PK-08). Everything here is a
 * function of its arguments, so it is tested directly rather than through a
 * rendered card.
 */

import type {
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectBonusPerTechLevel,
  SURefObjectChoice,
  SURefObjectContentBlock,
  SURefObjectTrait,
} from 'salvageunion-reference'
import {
  getTraits,
  isAbility,
  resolveChoiceView,
  resolveDataValueForTechLevel,
} from 'salvageunion-reference'
import type { StatItem } from '../../shared/statsBarTypes'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { buildReferenceEntityStats } from '../referenceEntityStatsConfig'
import { crawlerPopulationRange } from './crawlerPopulationRange'
import type { EntityCardSubHeaderCell } from './EntityCardSubHeader'
import { formatClassRequirements, resolveClassRequirements } from './entityCardTone'
import type { ActionFields } from './referenceEntityCardTypes'

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1)
}

/** Entity/action traits → sub-header cells: "Explosive (1)" → label "Explosive"
 * value "1"; "Immobile" → label only. */
export function traitCells(traits: SURefObjectTrait[]): EntityCardSubHeaderCell[] {
  return traits.map((trait) => ({
    key: `trait-${trait.type}`,
    label: capitalize(trait.type),
    value: trait.amount != null ? String(trait.amount) : undefined,
    // The trait line is a glossary of named rules — each name summons its own
    // entry, the same as an in-prose `[[trait]]` reference.
    entityRef: { schemaName: 'traits' as const, name: trait.type },
  }))
}

/** Normalize an action type into its display label: "Turn" → "Turn Action";
 * "Passive"/"Reaction"/anything already containing "action" stays as-is. */
export function formatActionType(type: string): string {
  const lower = type.toLowerCase()
  if (lower.includes('action') || lower === 'passive' || lower === 'reaction') return type
  return `${type} Action`
}

/**
 * An action's classification + range / damage / traits as sub-header cells. The
 * action TYPE leads (a label-only cell), then range/damage/traits. The EP/AP
 * cost is the sub-header's `leading` node, rendered before all of these.
 *
 * `mechActionType` is the SPLIT: a handful of abilities cost a different action
 * depending on whether you perform them in a Mech or on foot, and the book prints
 * both — "Turn Action (Mech) // Short Action (Pilot)" (core book p.248-249). When
 * it is present the single type cell becomes two qualified cells, Mech first, in
 * the book's own order. Without it nothing changes: one unqualified cell, exactly
 * as before, which is every other action in the dataset.
 */
export function actionCells(
  action: ActionFields,
  mechActionType?: string
): EntityCardSubHeaderCell[] {
  const cells: EntityCardSubHeaderCell[] = []
  if (mechActionType && action.actionType) {
    cells.push({ key: 'action-type-mech', label: `${formatActionType(mechActionType)} (Mech)` })
    cells.push({ key: 'action-type', label: `${formatActionType(action.actionType)} (Pilot)` })
  } else if (action.actionType) {
    cells.push({ key: 'action-type', label: formatActionType(action.actionType) })
  }
  if (action.range && action.range.length > 0) {
    cells.push({ key: 'range', label: 'Range', value: action.range.join(' / ') })
  }
  if (action.damage) {
    cells.push({
      key: 'damage',
      label: 'Damage',
      // "4 SP", not "4SP" — the amount and the pool it comes off are two facts,
      // and the sub-header renders this as "Damage: 4 SP".
      value: [action.damage.amount, action.damage.damageType].filter(Boolean).join(' '),
    })
  }
  if (action.traits) cells.push(...traitCells(action.traits))
  return cells
}

/** `bonusPerTechLevel` fields → "+N" vertical stat boxes (zeros/absent dropped).
 * The label splits top/bottom around the value: [field, TOP word, BOTTOM word]
 * (e.g. "Structure" / "Points"), the same two-line treatment as "Tech" / "Level". */
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

/** A datavalue as display text, with its unit appended when it has one. */
function fmtDv(dv: { value?: unknown; unit?: string }): string {
  const v = dv.value == null ? '' : String(dv.value)
  return dv.unit ? `${v}${dv.unit}` : v
}

/** What the entity's Tech Level resolves to once a host may be scaling it. */
export type TechScaling = {
  /**
   * EFFECTIVE tech level — the value that scales this entity: the Modification
   * choice cap (`scalesWithField: techLevel`) AND any `perTechLevel` datavalue
   * (e.g. Custom Sniper Rifle damage). The host `scalingParent.techLevel`
   * (controlled from without — the crawler level in ITUN) wins over the
   * entity's own base TL. Floors at the base TL — a granted item is never below
   * its own tech level.
   */
  effTechLevel: number | undefined
  /** The header TL cell: the EFFECTIVE level (base, or bumped by the external
   * `scalingParent` control) on a TL-scalable entity, else the base. */
  techLevelDisplay: number | 'B' | 'N' | undefined
  /** Scaled above base — the TL cell wears the rust `modified` border. */
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
    entityChoices.some((c) => typeof c.constraints?.scalesWithField === 'string')
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
  primaryOnly: boolean
  techLevel: number | 'B' | 'N' | undefined
  techLevelDisplay: number | 'B' | 'N' | undefined
  techLevelModified: boolean
}): StatItem[] {
  const { entity, schemaName, asCompact, none, primaryOnly, techLevel } = options
  const rawHeaderStats: StatItem[] = none
    ? []
    : buildReferenceEntityStats(entity, {
        compact: asCompact,
        primaryOnly,
        // Never 'actions' here — an action takes the `none` branch above.
        schemaName: schemaName === 'actions' ? undefined : schemaName,
        techLevel,
      })
  // TECH LEVEL is a header headline stat (value box), NOT a seam pill — a
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
          // A TL-scalable item shows the EFFECTIVE level; a rust `modified`
          // border when above base (controlled from without via `scalingParent`).
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

/** The "modified stats" colour — a choice-touched or TL-scaled cell gets a rust
 * border (and, for traits, a rust label ground). */
const MODIFIED = 'var(--color-rust)'

/**
 * The SUB-HEADER cells — action type/range/damage/traits, then entity traits,
 * then every datavalue, with anything a choice or the Tech Level changed
 * bordered rust.
 *
 * CHOICE PLACEMENT: EVERYTHING INLINE (choice-plan Stage 7) — every choice
 * renders in the BODY, at its prose, in both modes; no choice is ever hoisted
 * to this row. The old "Choose | <name>" freeform cell is retired.
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
}): EntityCardSubHeaderCell[] {
  const { entity, entityName, action, foldedAction, entityChoices } = options
  // A folded single action surfaces its type/range/damage/traits into the
  // sub-header; entity traits follow, deduped so a shared trait (e.g.
  // "Explosive") isn't listed twice.
  // An ability carries the MECH half of a split action type; the action record
  // carries the Pilot half. Only the ability knows both, so the split is resolved
  // here rather than inside `actionCells`.
  const abilityMechActionType =
    isAbility(entity) && typeof entity.mechActionType === 'string'
      ? entity.mechActionType
      : undefined
  const foldedActionCells = foldedAction ? actionCells(foldedAction, abilityMechActionType) : []
  const entityCells = traitCells(getTraits(entity) ?? [])
  const dedupedEntityCells = entityCells.filter(
    (cell) => !foldedActionCells.some((folded) => folded.key === cell.key)
  )
  // A HYBRID class names the two ability trees it advances from, in the
  // sub-header row and LEADING it (the requirement is the first thing a reader
  // needs off a hybrid). The two trees are joined by "or", never a comma list —
  // a pilot qualifies through ONE of them, not both. Base classes have no
  // requirements entry, so this is empty for them and the row is unchanged.
  const classRequirement = formatClassRequirements(resolveClassRequirements(entity))
  const classRequirementCells: EntityCardSubHeaderCell[] = classRequirement
    ? [{ key: 'class-requires', label: 'Requires', value: classRequirement }]
    : []
  // A Union Crawler TECH LEVEL is a table row in the book (p.218), and the
  // population band is the one fact on that row which is not a number the header
  // can hold: it is a RANGE, so it rides the facet line while Structure Points /
  // Upkeep / Upgrade sit in the header's stat cluster. `populationMax: 0` is the
  // dataset's "unbounded" marker for the top tier, which the book prints open-
  // ended ("25,000+"). Without this the entire crawler-tech-levels catalog
  // rendered as bare name + TL cards.
  const populationRange = crawlerPopulationRange(entity)
  const populationCells: EntityCardSubHeaderCell[] = populationRange
    ? [{ key: 'population', label: 'Population', value: populationRange }]
    : []
  const baseCells: EntityCardSubHeaderCell[] = action
    ? actionCells(action)
    : [...populationCells, ...classRequirementCells, ...foldedActionCells, ...dedupedEntityCells]
  // dvSourceContent — the content whose `datavalues` block (Damage/Range) feeds
  // the resolver's base stats (a self-action's content for a self-action entity).
  const entityContentForDv = 'content' in entity ? entity.content : undefined
  const dvSourceContent =
    (foldedAction && foldedAction.name === entityName
      ? foldedAction.content
      : entityContentForDv) ?? entityContentForDv

  // MODIFIED-STATS LANGUAGE + DATAVALUES BUBBLE. `resolveChoiceView` applies the
  // selected choice effects to the entity's base datavalues + traits; diffing it
  // against the base (no selections) tells us what a choice CHANGED. Anything a
  // choice touched gets a RUST cell BORDER (the "modified" colour) — a choice-ADDED
  // trait (picking "Ballistic" → the Ballistic trait) and any datavalue an effect
  // UPGRADED (Damage 2→3, Range → Far; the value itself updates too). With no
  // selections this is just the base view — so Damage/Range still bubble normally.
  const resolvable = {
    content: dvSourceContent,
    traits: getTraits(entity) ?? [],
    choices: entityChoices,
  }
  const resolvedView = resolveChoiceView(resolvable, options.selections ?? {})
  const baseView = resolveChoiceView(resolvable, {})
  const baseTraitKeys = new Set(baseView.traits.map((t) => String(t.type).toLowerCase()))
  const addedTraitCells: EntityCardSubHeaderCell[] = traitCells(
    resolvedView.traits.filter((t) => !baseTraitKeys.has(String(t.type).toLowerCase()))
  ).map((c) => ({ ...c, borderColor: MODIFIED }))
  const baseDvMap = new Map(
    baseView.datavalues
      .filter((d) => d.label != null)
      .map((d) => [String(d.label).toLowerCase(), fmtDv(d)])
  )
  const existingLabels = new Set(baseCells.map((c) => String(c.label).toLowerCase()))
  const datavalueCells: EntityCardSubHeaderCell[] = resolvedView.datavalues
    .filter((d) => d.label != null && !existingLabels.has(String(d.label).toLowerCase()))
    .map((d) => {
      // TL scaling rides ON TOP of any choice effect already applied by
      // `resolveChoiceView`: the resolved value is the effective TL1 value, and
      // `perTechLevel` adds per tech level above the first. A scaled value is
      // "modified" (rust border), same language as a choice-touched stat.
      const perTechLevel = options.perTechLevelByLabel.get(String(d.label).toLowerCase())
      const scaled =
        perTechLevel !== undefined
          ? resolveDataValueForTechLevel(
              { label: d.label, value: d.value, unit: d.unit, perTechLevel },
              options.effTechLevel
            )
          : { value: d.value, scaled: false }
      const val = fmtDv({ value: scaled.value, unit: d.unit })
      const changed = baseDvMap.get(String(d.label).toLowerCase()) !== val || scaled.scaled
      // A datavalue that IS a named rules term (`type: "trait" | "keyword"`)
      // keeps its glossary hovercard — the legacy sub-header resolved exactly
      // these two types against the traits / keywords schemas.
      const refSchema =
        d.type === 'trait'
          ? ('traits' as const)
          : d.type === 'keyword'
            ? ('keywords' as const)
            : undefined
      return {
        key: `dv-${d.label}`,
        label: String(d.label),
        value: val,
        ...(refSchema ? { entityRef: { schemaName: refSchema, name: String(d.label) } } : {}),
        ...(changed ? { borderColor: MODIFIED } : {}),
      }
    })
  return [...baseCells, ...addedTraitCells, ...datavalueCells]
}
