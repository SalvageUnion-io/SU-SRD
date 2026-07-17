import type { SURefObjectChoice } from 'salvageunion-reference'

/**
 * Canonical selections type (keyed by choice id, each holding the selected
 * option values) — re-exported from salvageunion-reference so the cards and
 * `resolveChoiceView` share one definition.
 */
export type { ChoiceSelections } from 'salvageunion-reference'

/**
 * A single selectable option distilled from a choice. Either a structured
 * `choiceOption` (value/label/description) or a `schemaEntities` entry (the
 * entity name doubles as value and label, e.g. Ballistic / Energy).
 */
export type ChoiceCardOption = {
  /** Stable selection value (option.value, or the entity name). */
  value: string
  /** Human-readable label. */
  label: string
  /** Optional descriptive body (may contain `[[trait]]` references). */
  description?: string
  /** The schema this option deep-links into, when it is a schemaEntities option. */
  schema?: string
}

/** The discriminated source kind a choice renders as. */
export type ChoiceSourceKind = 'text' | 'table' | 'options' | 'catalog' | 'systemVariant'

/**
 * The choice's source kind — the ONE axis the renderer switches on. Reads the
 * discriminated `source.kind` when present (the unified model); otherwise
 * derives it from the legacy fields (kept during the migration).
 */
export function getChoiceSourceKind(choice: SURefObjectChoice): ChoiceSourceKind {
  if (choice.source) {
    return choice.source.kind
  }
  if (typeof choice.rollTable === 'string') return 'table'
  if (Array.isArray(choice.choiceOptions) && choice.choiceOptions.length > 0) return 'options'
  if (Array.isArray(choice.customSystemOptions) && choice.customSystemOptions.length > 0)
    return 'systemVariant'
  const hasSchema = Array.isArray(choice.schema) && choice.schema.length > 0
  const hasSchemaEntities = Array.isArray(choice.schemaEntities) && choice.schemaEntities.length > 0
  if (hasSchema || hasSchemaEntities) return 'catalog'
  return 'text'
}

/** The named roll table a `table` choice points at (or undefined). */
export function getChoiceTableName(choice: SURefObjectChoice): string | undefined {
  if (choice.source?.kind === 'table') return choice.source.rollTable
  return typeof choice.rollTable === 'string' ? choice.rollTable : undefined
}

/**
 * Whether a choice renders as a free-text field (Name, Appearance, Motto):
 * `source.kind === 'text'`. NOT a table — a table choice cites its table and
 * offers a Roll, it is not a bare input.
 */
export function isFreeTextChoice(choice: SURefObjectChoice): boolean {
  return getChoiceSourceKind(choice) === 'text'
}

/**
 * Whether a choice allows multiple selections. Reads `cardinality` (max > 1, or
 * a `scalesWith` cap) when present; otherwise the legacy `multiSelect`.
 */
export function isMultiSelectChoice(choice: SURefObjectChoice): boolean {
  const c = choice.cardinality
  if (c) {
    return typeof c.max === 'object' ? true : c.max > 1
  }
  return choice.multiSelect === true
}

/**
 * Distil a choice's selectable options into a flat option list. Reads the
 * discriminated `source` (options / systemVariant inline, or a catalog's named
 * entities) when present; otherwise the legacy fields.
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
  // Legacy fallback (source not yet populated).
  if (Array.isArray(choice.choiceOptions) && choice.choiceOptions.length > 0) {
    return choice.choiceOptions.map((option) => ({
      value: option.value,
      label: option.label,
      description: option.description,
    }))
  }
  if (Array.isArray(choice.schemaEntities) && choice.schemaEntities.length > 0) {
    const schema = choice.schema?.[0]
    return choice.schemaEntities.map((name) => ({ value: name, label: name, schema }))
  }
  return []
}

/**
 * Resolve the multi-select cap for a choice against its parent entity.
 *
 * - `constraints.max` is an explicit cap.
 * - `constraints.scalesWithField` resolves a numeric field on the parent entity
 *   (e.g. `techLevel`) to use as the cap.
 *
 * Returns `undefined` when no cap applies (unbounded multi-select).
 */
export function resolveMultiSelectCap(
  choice: SURefObjectChoice,
  parent: Record<string, unknown> | undefined
): number | undefined {
  // Unified model: cardinality.max is a fixed number (a cap only when > 1) or a
  // `{ scalesWith }` field resolved on the parent.
  const cardinality = choice.cardinality
  if (cardinality) {
    if (typeof cardinality.max === 'number') {
      return cardinality.max > 1 ? cardinality.max : undefined
    }
    if (parent) {
      const fieldValue = parent[cardinality.max.scalesWith]
      if (typeof fieldValue === 'number') return fieldValue
    }
    return undefined
  }
  // Legacy fallback.
  const constraints = choice.constraints
  if (!constraints) {
    return undefined
  }
  if (typeof constraints.max === 'number') {
    return constraints.max
  }
  if (typeof constraints.scalesWithField === 'string' && parent) {
    const fieldValue = parent[constraints.scalesWithField]
    if (typeof fieldValue === 'number') {
      return fieldValue
    }
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
