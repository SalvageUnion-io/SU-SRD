/**
 * Which action (if any) folds into the entity card's own body/sub-header: ONLY
 * the SELF-action, named like its entity by `name` or `displayName`. Its
 * siblings render as their own cards. The rule, and why, lives with the entity
 * model (`foldedActionOf` in `salvageunion-reference`,
 * `lib/view/parts/children.ts`).
 */
export { foldedActionOf as resolveFoldedAction } from 'salvageunion-reference'
