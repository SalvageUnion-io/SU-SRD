/**
 * The environmental conditions a Game's Scene can be under, by id: the source
 * of truth for `scenes.conditions` in `apps/web/convex/model/playTables.ts`.
 * What each one does is `rules/sceneConditions.ts`; this file imports nothing,
 * so the Convex schema can read it.
 */
export const SCENE_CONDITION_IDS = [
  'radiation-storm',
  'irradiated',
  'freezing',
  'low-visibility',
  'difficult-terrain',
  'anomalous-zone',
] as const
export type SceneConditionId = (typeof SCENE_CONDITION_IDS)[number]
