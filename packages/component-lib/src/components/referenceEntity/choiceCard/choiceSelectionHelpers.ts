import type { SURefObjectChoice } from 'salvageunion-reference'

/**
 * Canonical selections type (keyed by choice id, each holding the selected
 * option values) — re-exported from salvageunion-reference so the cards and
 * `resolveChoiceView` share one definition.
 */
export type { ChoiceSelections } from 'salvageunion-reference'

/**
 * A single selectable option distilled from a choice. Either a structured
 * `source.options` entry (value/label/description) or a catalog's
 * `source.entities` entry (the entity name doubles as value and label, e.g.
 * Ballistic / Energy).
 */
export type ChoiceCardOption = {
  /** Stable selection value (option.value, or the entity name). */
  value: string
  /** Human-readable label. */
  label: string
  /** Optional descriptive body (may contain `[[trait]]` references). */
  description?: string
  /** The schema this option deep-links into, when it is a catalog option. */
  schema?: string
}

/** The discriminated source kind a choice renders as. */
export type ChoiceSourceKind = 'text' | 'table' | 'options' | 'catalog' | 'systemVariant'

/**
 * The choice's source kind — the ONE axis the renderer switches on. A choice
 * without a `source` is free text.
 */
export function getChoiceSourceKind(choice: SURefObjectChoice): ChoiceSourceKind {
  return choice.source?.kind ?? 'text'
}

/** The named roll table a `table` choice points at (or undefined). */
export function getChoiceTableName(choice: SURefObjectChoice): string | undefined {
  return choice.source?.kind === 'table' ? choice.source.rollTable : undefined
}

/**
 * Whether a choice allows multiple selections: its `cardinality` max is above
 * one, or a `scalesWith` cap.
 */
export function isMultiSelectChoice(choice: SURefObjectChoice): boolean {
  const c = choice.cardinality
  if (!c) return false
  return typeof c.max === 'object' ? true : c.max > 1
}

/**
 * Distil a choice's selectable options into a flat option list from its
 * discriminated `source`: options / systemVariant inline, or a catalog's named
 * entities.
 */
export function getChoiceCardOptions(choice: SURefObjectChoice): ChoiceCardOption[] {
  const source = choice.source
  if (source?.kind === 'options') {
    return source.options.map((option) => ({
      value: option.value,
      label: option.label,
      description: option.description,
    }))
  }
  if (source?.kind === 'systemVariant') {
    return source.options
      .filter((o): o is typeof o & { name: string } => typeof o.name === 'string')
      .map((o) => ({ value: o.name, label: o.name }))
  }
  if (source?.kind === 'catalog') {
    const schema = source.schema?.[0]
    return (source.entities ?? []).map((name) => ({ value: name, label: name, schema }))
  }
  return []
}

/**
 * Resolve the multi-select cap for a choice against its parent entity.
 *
 * - A numeric `cardinality.max` is an explicit cap (a cap only when > 1).
 * - `cardinality.max.scalesWith` resolves a numeric field on the parent entity
 *   (e.g. `techLevel`) to use as the cap.
 *
 * Returns `undefined` when no cap applies (unbounded multi-select).
 */
export function resolveMultiSelectCap(
  choice: SURefObjectChoice,
  parent: Record<string, unknown> | undefined
): number | undefined {
  const cardinality = choice.cardinality
  if (!cardinality) return undefined
  if (typeof cardinality.max === 'number') {
    return cardinality.max > 1 ? cardinality.max : undefined
  }
  if (parent) {
    const fieldValue = parent[cardinality.max.scalesWith]
    if (typeof fieldValue === 'number') return fieldValue
  }
  return undefined
}

/**
 * Compute the next selection set for a choice when `value` is toggled, honouring
 * the choice's selection rules:
 *
 * - Exclusive (`multiSelect` false): selecting replaces any prior selection;
 *   toggling the already-selected option clears it.
 * - Multi-select: toggling adds/removes the value. When a `cap` is provided and
 *   already met, adding a *new* value is rejected (returns the current set
 *   unchanged) — callers should disable at-cap options so this never fires.
 */
export function toggleSelection(
  current: string[],
  value: string,
  multiSelect: boolean,
  cap?: number
): string[] {
  const isSelected = current.includes(value)

  if (!multiSelect) {
    return isSelected ? [] : [value]
  }

  if (isSelected) {
    return current.filter((v) => v !== value)
  }

  if (typeof cap === 'number' && current.length >= cap) {
    return current
  }

  return [...current, value]
}
