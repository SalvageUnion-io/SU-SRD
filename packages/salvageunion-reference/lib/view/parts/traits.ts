/**
 * The FACETS an entity states after its stats (E17): the action type, the
 * action's range and damage, a crawler tech level's population, a hybrid
 * class's requirement, its traits and its datavalues.
 *
 * `facetCells` keeps them as ONE ordered list tagged by kind, because today's
 * card still prints them as one line; the model splits the list into
 * `actionType`, `facts` and `traits`.
 */

import { getTraits } from '../../actionResolution'
import { resolveDataValueForTechLevel } from '../../contentBlockHelpers'
import { isAbility } from '../../entityGuards'
import type { ChoiceSelections } from '../../resolveChoiceView'
import { resolveChoiceView } from '../../resolveChoiceView'
import type {
  RefMetaEntity,
  RefObjectChoice,
  RefObjectContentBlock,
  RefObjectDamage,
  RefObjectTrait,
} from '../../schemas/index'
import type { StatGroup } from '../types'
import { ACTION_TYPE_LABELS } from './facts'
import { classRequirements } from './kind'

/** The fields an action states about itself. */
export type ActionFacets = {
  actionType?: string
  range?: string[]
  damage?: RefObjectDamage
  traits?: RefObjectTrait[]
  activationCost?: string | number
  actionSource?: string
}

/** One facet, in line order. */
export type FacetCell = {
  key: string
  label: string
  value?: string
  /** An action type, a fact, or a named rule (trait or keyword). */
  kind: 'action-type' | 'fact' | 'trait'
  /** The raw action type, for `action-type` cells. */
  actionType?: string
  /** A fact's short form. */
  short?: string
  /** A fact's part of the stat order (`StatGroup`): an action's, unless it says. */
  group?: StatGroup
  /** A fact's value in short form, for compact cells (`rangeCodes`). */
  shortValue?: string
  /** A named rule's glossary lookup. */
  mention?: { schemaName: 'traits' | 'keywords'; name: string }
  /** Changed by a choice or scaled by the Tech Level. */
  modified?: true
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1)
}

/** An action type as the book prints it (`ACTION_TYPE_LABELS`): "Turn" → "Turn Action". */
export function formatActionType(type: string): string {
  const labels: Partial<Record<string, string>> = ACTION_TYPE_LABELS
  const known = labels[type]
  if (known) return known
  return type.toLowerCase().includes('action') ? type : `${type} Action`
}

/** The cost as a pennant prints it: "2 AP", "1 EP", "X EP". */
export function formatCost(cost: string | number, currency: string | number | undefined): string {
  const displayCost = cost === 'Variable' ? 'X' : cost
  return `${displayCost} ${currency ?? 'AP'}`
}

/** The book's range codes (Salvage Union 2.0a p.23: "C: Close // M: Medium // L: Long // F: Far"). */
const RANGE_CODES: Partial<Record<string, string>> = {
  Close: 'C',
  Medium: 'M',
  Long: 'L',
  Far: 'F',
}

/** Range bands as their codes, for compact cells: ["Close", "Medium"] is "C/M". */
function rangeCodes(range: readonly string[]): string {
  return range.map((band) => RANGE_CODES[band] ?? band).join('/')
}

/** Traits → cells: "Explosive (1)" is name Explosive, value 1. */
function traitFacets(traits: RefObjectTrait[]): FacetCell[] {
  return traits.map((trait) => ({
    key: `trait-${trait.type}`,
    label: capitalize(trait.type),
    ...(trait.amount != null ? { value: String(trait.amount) } : {}),
    kind: 'trait' as const,
    mention: { schemaName: 'traits' as const, name: trait.type },
  }))
}

/**
 * An action's type, range, damage and traits. `mechActionType` splits the type
 * the way the book prints a few abilities — "Turn Action (Mech) // Short
 * Action (Pilot)" (core book p.248-249) — Mech first.
 */
export function actionFacets(action: ActionFacets, mechActionType?: string): FacetCell[] {
  const cells: FacetCell[] = []
  if (mechActionType && action.actionType) {
    cells.push({
      key: 'action-type-mech',
      label: `${formatActionType(mechActionType)} (Mech)`,
      kind: 'action-type',
      actionType: mechActionType,
    })
    cells.push({
      key: 'action-type',
      label: `${formatActionType(action.actionType)} (Pilot)`,
      kind: 'action-type',
      actionType: action.actionType,
    })
  } else if (action.actionType) {
    cells.push({
      key: 'action-type',
      label: formatActionType(action.actionType),
      kind: 'action-type',
      actionType: action.actionType,
    })
  }
  if (action.range && action.range.length > 0) {
    cells.push({
      key: 'range',
      label: 'Range',
      short: 'RNG',
      value: action.range.join(' / '),
      shortValue: rangeCodes(action.range),
      kind: 'fact',
    })
  }
  if (action.damage) {
    cells.push({
      key: 'damage',
      label: 'Damage',
      short: 'DMG',
      // "4 SP": the amount and the pool it comes off are two facts.
      value: [action.damage.amount, action.damage.damageType].filter(Boolean).join(' '),
      kind: 'fact',
    })
  }
  if (action.traits) cells.push(...traitFacets(action.traits))
  return cells
}

/** `en-US`, pinned: the SRD's static build must not depend on its machine's locale. */
const GROUPED = new Intl.NumberFormat('en-US')

/**
 * A crawler tech level's population band, as the book's table prints it
 * (p.218). `populationMax` null (or a legacy 0) is open-ended: "25,000+".
 */
export function populationRange(entity: RefMetaEntity): string | undefined {
  if (!('populationMin' in entity) || typeof entity.populationMin !== 'number') return undefined
  const min = entity.populationMin
  const max =
    'populationMax' in entity && typeof entity.populationMax === 'number' ? entity.populationMax : 0
  return max > 0 ? `${GROUPED.format(min)}–${GROUPED.format(max)}` : `${GROUPED.format(min)}+`
}

/** A datavalue as display text, with its unit. */
function formatDataValue(dv: { value?: unknown; unit?: string }): string {
  const v = dv.value == null ? '' : String(dv.value)
  return dv.unit ? `${v}${dv.unit}` : v
}

/**
 * Every facet, in line order: the entity's own action (or its folded
 * self-action's) facets, the population band, a hybrid's requirement, its
 * traits (deduped against the folded action's), any trait a choice added,
 * then every datavalue — scaled by `effTechLevel` and marked `modified` where
 * a choice or the Tech Level changed it.
 */
export function facetCells(options: {
  entity: RefMetaEntity
  entityName: string
  /** The entity's own fields, when it IS an action. */
  action: ActionFacets | undefined
  /** The self-action folded into it. */
  foldedAction: (ActionFacets & { name?: string; content?: RefObjectContentBlock[] }) | undefined
  choices: RefObjectChoice[]
  selections?: ChoiceSelections
  /** Datavalue label (lowered) → per-level increment. */
  perTechLevelByLabel: ReadonlyMap<string, number>
  effTechLevel: number | undefined
}): FacetCell[] {
  const { entity, entityName, action, foldedAction, choices } = options
  const mechActionType =
    isAbility(entity) && typeof entity.mechActionType === 'string'
      ? entity.mechActionType
      : undefined
  const foldedCells = foldedAction ? actionFacets(foldedAction, mechActionType) : []
  const entityTraitCells = traitFacets(getTraits(entity) ?? []).filter(
    (cell) => !foldedCells.some((folded) => folded.key === cell.key)
  )
  const requirements = classRequirements(entity)
  const requirementCells: FacetCell[] =
    requirements.length > 0
      ? [
          {
            key: 'class-requires',
            label: 'Requires',
            group: 'provenance',
            short: 'REQ',
            // A disjunction: a pilot advances from ONE of the trees.
            value: requirements.join(' or '),
            kind: 'fact',
          },
        ]
      : []
  const population = populationRange(entity)
  const populationCells: FacetCell[] = population
    ? [
        {
          key: 'population',
          label: 'Population',
          short: 'POP',
          value: population,
          kind: 'fact',
          group: 'capacity',
        },
      ]
    : []
  const baseCells = action
    ? actionFacets(action)
    : [...populationCells, ...requirementCells, ...foldedCells, ...entityTraitCells]

  // The datavalues come from the folded self-action's content when it IS the
  // entity, else the entity's own.
  const ownContent = 'content' in entity ? entity.content : undefined
  const dvContent =
    (foldedAction && foldedAction.name === entityName ? foldedAction.content : ownContent) ??
    ownContent
  const resolvable = { content: dvContent, traits: getTraits(entity) ?? [], choices }
  const resolved = resolveChoiceView(resolvable, options.selections ?? {})
  const base = resolveChoiceView(resolvable, {})
  const baseTraits = new Set(base.traits.map((t) => String(t.type).toLowerCase()))
  const addedTraitCells = traitFacets(
    resolved.traits.filter((t) => !baseTraits.has(String(t.type).toLowerCase()))
  ).map((cell) => ({ ...cell, modified: true as const }))
  const baseValues = new Map(
    base.datavalues
      .filter((d) => d.label != null)
      .map((d) => [String(d.label).toLowerCase(), formatDataValue(d)])
  )
  const taken = new Set(baseCells.map((c) => c.label.toLowerCase()))
  const datavalueCells = resolved.datavalues
    .filter((d) => d.label != null && !taken.has(String(d.label).toLowerCase()))
    .map((d): FacetCell => {
      const label = String(d.label)
      const perTechLevel = options.perTechLevelByLabel.get(label.toLowerCase())
      const scaled =
        perTechLevel !== undefined
          ? resolveDataValueForTechLevel(
              { label: d.label, value: d.value, unit: d.unit, perTechLevel },
              options.effTechLevel
            )
          : { value: d.value, scaled: false }
      const value = formatDataValue({ value: scaled.value, unit: d.unit })
      const changed = baseValues.get(label.toLowerCase()) !== value || scaled.scaled
      const schemaName =
        d.type === 'trait'
          ? ('traits' as const)
          : d.type === 'keyword'
            ? ('keywords' as const)
            : undefined
      return {
        key: `dv-${d.label}`,
        label,
        value,
        ...(schemaName
          ? { kind: 'trait' as const, mention: { schemaName, name: label } }
          : { kind: 'fact' as const, short: label }),
        ...(changed ? { modified: true as const } : {}),
      }
    })
  return orderTraits([...baseCells, ...addedTraitCells, ...datavalueCells])
}

/**
 * The trait order: alphabetical, as the book mostly
 * prints them, with Uses last (".50 Cal Machine Gun: Ballistic // Jamming //
 * Pinning", Workshop Manual p.164; "… // Missile // Uses (6)", p.175). The
 * other cells keep their order, ahead of the traits.
 */
function orderTraits(cells: FacetCell[]): FacetCell[] {
  const rank = (cell: FacetCell) => (cell.label.toLowerCase() === 'uses' ? 1 : 0)
  const traits = cells
    .filter((cell) => cell.kind === 'trait')
    .sort(
      (a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, 'en', { sensitivity: 'base' })
    )
  return [...cells.filter((cell) => cell.kind !== 'trait'), ...traits]
}

/**
 * The datavalues that scale with Tech Level (`perTechLevel`), by lowered label:
 * Custom Sniper Rifle damage "+1 SP per Tech Level".
 */
export function perTechLevelByLabel(entity: RefMetaEntity): Map<string, number> {
  const out = new Map<string, number>()
  for (const block of 'content' in entity ? (entity.content ?? []) : []) {
    if (!Array.isArray(block.value)) continue
    for (const dv of block.value) {
      if (typeof dv.perTechLevel === 'number' && dv.label != null) {
        out.set(String(dv.label).toLowerCase(), dv.perTechLevel)
      }
    }
  }
  return out
}
