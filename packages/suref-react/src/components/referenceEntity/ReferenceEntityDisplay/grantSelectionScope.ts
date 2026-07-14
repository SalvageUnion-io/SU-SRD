/**
 * Per-grant choice-selection namespacing.
 *
 * A granting ability can resolve to identical entities (e.g. Mecha Packmaster
 * grants two Mecha Companions), which share choice ids. To keep each grant
 * instance's selections independent, the granting display's single selection map
 * is namespaced by grant index (`"{idx}:{choiceId}"`). Each nested granted-entity
 * card sees only its own slice, stripped back to bare choice ids; edits merge
 * back under the grant's prefix without touching its siblings.
 */

import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'

const grantSelectionPrefix = (idx: number) => `${idx}:`

/** The bare-choiceId slice of `all` belonging to grant `idx`. */
export function scopeGrantSelections(
  all: ChoiceSelections | undefined,
  idx: number
): ChoiceSelections {
  const prefix = grantSelectionPrefix(idx)
  const scoped: ChoiceSelections = {}
  for (const [key, value] of Object.entries(all ?? {})) {
    if (key.startsWith(prefix)) scoped[key.slice(prefix.length)] = value
  }
  return scoped
}

/**
 * `all` with grant `idx`'s entries replaced by `next` (re-prefixed). Every other
 * grant's (differently-prefixed) entries are preserved untouched.
 */
export function mergeGrantSelections(
  all: ChoiceSelections | undefined,
  idx: number,
  next: ChoiceSelections
): ChoiceSelections {
  const prefix = grantSelectionPrefix(idx)
  const merged: ChoiceSelections = {}
  for (const [key, value] of Object.entries(all ?? {})) {
    if (!key.startsWith(prefix)) merged[key] = value
  }
  for (const [key, value] of Object.entries(next)) {
    merged[`${prefix}${key}`] = value
  }
  return merged
}
