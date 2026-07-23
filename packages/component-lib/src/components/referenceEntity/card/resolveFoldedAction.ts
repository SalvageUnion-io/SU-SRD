/**
 * Which action (if any) folds into the entity card's own body/sub-header.
 *
 * The rule: ONLY the SELF-action — an action named like its entity — folds. It
 * folds regardless of how many actions the entity has; its siblings render as
 * their own cards. An entity with no self-action folds nothing.
 *
 * The name match is the whole rule because folding is a claim about identity:
 * the facets it bubbles into the sub-header (Turn Action, Range, Damage) read
 * as the ENTITY's own stats, so they are only true of an action that IS the
 * entity. A lone action used to fold too, on the reasoning that a single
 * action's facets may as well be shown up front — but that put "Iron Claw"'s
 * stats in the Molebear's sub-header as though the creature itself were a Turn
 * Action, and the same for every creature with one differently-named attack.
 * A sole action is still just an action; it renders as its own card.
 */
export function resolveFoldedAction<T extends { name?: string }>(
  foldableActions: T[],
  entityName: string
): T | undefined {
  return foldableActions.find((a) => a.name === entityName)
}
