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

/**
 * Whether a choice is a free-text choice (Name, Appearance, A.I. Personality):
 * it presents no structured options to pick from, so it renders as an editable
 * field rather than a set of option cards. A `choiceType: 'freeform'` marker or
 * the absence of any option source both qualify.
 */
export function isFreeTextChoice(choice: SURefObjectChoice): boolean {
  if (choice.choiceType === 'freeform') {
    return true
  }
  const hasSchemaEntities = Array.isArray(choice.schemaEntities) && choice.schemaEntities.length > 0
  const hasChoiceOptions = Array.isArray(choice.choiceOptions) && choice.choiceOptions.length > 0
  const hasCustomSystemOptions =
    Array.isArray(choice.customSystemOptions) && choice.customSystemOptions.length > 0
  return !hasSchemaEntities && !hasChoiceOptions && !hasCustomSystemOptions
}

/**
 * Whether a choice allows multiple selections.
 */
export function isMultiSelectChoice(choice: SURefObjectChoice): boolean {
  return choice.multiSelect === true
}

/**
 * Distil a choice's selectable options into a flat option list. `choiceOptions`
 * win when present (Modification); otherwise `schemaEntities` (Weapon Type),
 * which keeps each option's entity linkage so the card can deep-link to the
 * Ballistic / Energy trait detail.
 */
export function getChoiceCardOptions(choice: SURefObjectChoice): ChoiceCardOption[] {
  if (Array.isArray(choice.choiceOptions) && choice.choiceOptions.length > 0) {
    return choice.choiceOptions.map((option) => ({
      value: option.value,
      label: option.label,
      description: option.description,
    }))
  }
  if (Array.isArray(choice.schemaEntities) && choice.schemaEntities.length > 0) {
    const schema = choice.schema?.[0]
    return choice.schemaEntities.map((name) => ({
      value: name,
      label: name,
      schema,
    }))
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
