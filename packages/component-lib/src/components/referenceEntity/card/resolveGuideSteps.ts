import type {
  SURefEntity,
  SURefMetaEntity,
  SURefObjectGuideStep,
  SURefObjectTable,
} from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'

/**
 * Resolve a guide's `steps` into everything the card needs to RENDER them.
 *
 * A guide keeps almost all of its prose in `steps`, not in its top-level
 * `content` — across the shipped dataset that is 28.7k of 34.2k characters. The
 * legacy `GuideStepsDisplay` rendered them; it was deleted with the rest of the
 * legacy render core and the unified card never grew a replacement, so every
 * guide page rendered its title, one intro paragraph and nothing else (the
 * "Salvaging" page rendered a heading and a source line, no rules at all).
 *
 * This module is the RESOLUTION half only — pure, testable, no JSX. The card
 * renders the result through the same primitives every other section uses
 * (`Slab`, `Content`, `RollTable`, nested cards), so guide steps inherit the
 * card's typography and tone instead of carrying their own.
 */

/** A single guide step, with every reference it names already resolved. */
export type ResolvedGuideStep = {
  step: SURefObjectGuideStep
  /** 1-based position WITHIN its section — restarts at each `section` boundary. */
  number: number
  /** Section label this step opens (absent ⇒ it continues the current one). */
  section?: string
  /** Entities the step selects from (`schema` + `schemaEntities`/`filters`). */
  entities: SURefEntity[]
  /** The step's roll table, resolved by name from the `roll-tables` schema. */
  table?: { name: string; table: SURefObjectTable }
  /** A `sub-guide` step's target guide, resolved by id. */
  subGuide?: SURefEntity
}

/**
 * Check one guide-step filter against an entity.
 *
 * A filter naming a field the entity does not carry is SKIPPED, not failed:
 * filters are written against the richest schema in the step and must not
 * exclude entities that simply lack the field.
 */
export function matchesFilter(
  entity: Record<string, unknown>,
  filter: {
    field: string
    operator?: 'eq' | 'ne'
    value?: string | number | boolean
    min?: number
    max?: number
  }
): boolean {
  const fieldValue = entity[filter.field]
  if (fieldValue === undefined) return true
  if (filter.value !== undefined) {
    const op = filter.operator ?? 'eq'
    return op === 'ne' ? fieldValue !== filter.value : fieldValue === filter.value
  }
  if (filter.min !== undefined && (typeof fieldValue !== 'number' || fieldValue < filter.min))
    return false
  if (filter.max !== undefined && (typeof fieldValue !== 'number' || fieldValue > filter.max))
    return false
  return true
}

/** Core ability-tree names, read once from class data. */
let coreTreeNames: Set<string> | null = null
function getCoreTreeNames(): Set<string> {
  if (!coreTreeNames) {
    coreTreeNames = new Set(
      SalvageUnionReference.Classes.all().flatMap(
        (c) => ((c as Record<string, unknown>).coreTrees as string[]) ?? []
      )
    )
  }
  return coreTreeNames
}

/**
 * Add the COMPUTED fields guide filters are written against — they are not
 * stored on the entities themselves:
 *
 * - `hasDamage` (systems/modules) — does any resolved action deal damage.
 *   "Choose Weapons Systems" in Create a Crawler filters on it.
 * - `treeType` (abilities) — core / advanced / legendary / generic.
 *   "Choose your first Ability" filters on it; without this the step would
 *   list all 103 abilities instead of the level-1 core ones.
 */
export function enrichForFiltering(
  entity: Record<string, unknown>,
  schemaName: string
): Record<string, unknown> {
  if ((schemaName === 'systems' || schemaName === 'modules') && Array.isArray(entity.actions)) {
    const hasDamage = (entity.actions as string[]).some((name) => {
      const action = SalvageUnionReference.Actions.getByName(name)
      return action?.damage !== undefined
    })
    return { ...entity, hasDamage }
  }
  if (schemaName === 'abilities' && typeof entity.tree === 'string') {
    const { tree } = entity
    const treeType =
      tree === 'Generic'
        ? 'generic'
        : getCoreTreeNames().has(tree)
          ? 'core'
          : tree.startsWith('Legendary')
            ? 'legendary'
            : 'advanced'
    return { ...entity, treeType }
  }
  return entity
}

/**
 * The entities a step selects from.
 *
 * `schemaEntities` (an explicit name list) preserves the DATA's order — the
 * book lists a step's options in a deliberate order, and re-sorting them would
 * silently disagree with the page it is transcribed from. Without that list the
 * step means "everything in the schema matching `filters`".
 *
 * `actions` is not a real schema (it is a virtual one on the step type), so a
 * step naming it resolves to no entities and renders as prose only.
 */
function resolveStepEntities(step: SURefObjectGuideStep): SURefEntity[] {
  const schemaName = step.schema?.[0]
  if (!schemaName || schemaName === 'actions') return []

  const filters = step.filters ?? []
  const passes = (entity: SURefEntity): boolean =>
    filters.length === 0 ||
    filters.every((filter) =>
      matchesFilter(enrichForFiltering(entity as Record<string, unknown>, schemaName), filter)
    )

  if (!step.schemaEntities || step.schemaEntities.length === 0) {
    return SalvageUnionReference.findAllIn(schemaName, passes) as SURefEntity[]
  }

  const wanted = new Set(step.schemaEntities)
  const found = SalvageUnionReference.findAllIn(
    schemaName,
    (entity) => wanted.has(entity.name) && passes(entity as SURefEntity)
  ) as SURefEntity[]
  const byName = new Map(found.map((entity) => [entity.name, entity]))
  return step.schemaEntities
    .map((name) => byName.get(name))
    .filter((entity): entity is SURefEntity => entity !== undefined)
}

/**
 * Resolve every step of a guide. Returns `[]` for any entity that is not a
 * guide (or a guide with no steps), so the caller can render unconditionally.
 */
export function resolveGuideSteps(entity: SURefMetaEntity): ResolvedGuideStep[] {
  if (!('steps' in entity) || !Array.isArray(entity.steps)) return []
  const steps = entity.steps as SURefObjectGuideStep[]

  let number = 0
  return steps.map((step) => {
    if (step.section) number = 0
    number += 1

    const table = step.rollTable
      ? SalvageUnionReference.RollTables.getByName(step.rollTable)
      : undefined
    const subGuide = step.guideRef
      ? SalvageUnionReference.findIn('guides', (g) => g.id === step.guideRef)
      : undefined

    return {
      step,
      number,
      section: step.section,
      entities: resolveStepEntities(step),
      table:
        table && 'table' in table && table.table
          ? { name: table.name, table: table.table as SURefObjectTable }
          : undefined,
      subGuide: (subGuide as SURefEntity | undefined) ?? undefined,
    }
  })
}
