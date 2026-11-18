/**
 * The options chosen on a build's items (a mech's Systems and Modules, a
 * pilot's equipment), as the wizard's form carries them and the unit stores
 * them: by the item's slug, then by choice id (`Mech.itemChoices`,
 * `Pilot.equipmentChoices`). Pure: no store, no React.
 */

import type { ChoiceSelections } from 'salvageunion-reference'

type ItemChoices = Record<string, ChoiceSelections>

/** The form's choices with one item's replaced. */
export function withItemChoice(
  choices: ItemChoices | undefined,
  slug: string,
  next: ChoiceSelections
): ItemChoices {
  return { ...choices, [slug]: next }
}

/**
 * What the unit keeps: the choices made on an item the build still holds. An
 * item taken off the build takes its choices with it, and a choice emptied
 * again is no choice. Undefined when nothing is left, as the unit's field is
 * unset until a choice is made.
 */
export function madeChoices(
  choices: ItemChoices | undefined,
  held: readonly string[]
): ItemChoices | undefined {
  if (!choices) return undefined
  const kept: ItemChoices = {}
  for (const slug of new Set(held)) {
    const made = Object.entries(choices[slug] ?? {}).filter(([, picks]) => picks.length > 0)
    if (made.length > 0) kept[slug] = Object.fromEntries(made)
  }
  return Object.keys(kept).length > 0 ? kept : undefined
}
