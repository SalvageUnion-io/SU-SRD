/**
 * Which action (if any) folds into the entity card's own body/sub-header.
 *
 * The rule (choice-plan Stage 6, data-proven): the SELF-action — an action
 * named like its entity — folds regardless of how many actions the entity has;
 * its siblings render as their own cards. If there is no self-action, a lone
 * action still folds its facets (the single differently-named case, e.g. a
 * creature whose one action is "Bite"). Two-or-more differently-named actions
 * with no self-action → nothing folds.
 *
 * This replaced a `foldableActions.length === 1` gate that refused to fold a
 * self-action whenever the entity had other actions too — which dropped the
 * self-action's choices/content on multi-action entities (Holo Companion,
 * Bionic Arms) and disagreed with `getChoices`.
 */
export function resolveFoldedAction<T extends { name?: string }>(
  foldableActions: T[],
  entityName: string
): T | undefined {
  const selfAction = foldableActions.find((a) => a.name === entityName)
  const loneAction = foldableActions.length === 1 ? foldableActions[0] : undefined
  return selfAction ?? loneAction
}
