/**
 * useScene — the Game's Scene conditions as Play reads them (play.md §10):
 * a Radiation Storm, Freezing, Low Visibility and the rest, which the
 * Mediator sets (`scenes.setConditions`) and every seat follows. Solo play has
 * no Mediator and so no conditions; before the first answer the Scene is clear.
 */

import { sceneConditionsOf } from 'game-domain/rules/sceneConditions'
import type { SceneConditionId } from 'game-domain/schemas/scene'
import { isSignedIn } from '../replica/sync'
import { useSync } from '../replica/syncContext'
import { useTableRead } from '../replica/useTable'

export type SceneState = {
  /** In catalogue order, each once. */
  conditions: readonly SceneConditionId[]
  /** Hours passed under them. */
  hours: number
  /** The pilot the Mediator marked as up now; absent with none. */
  upNow?: string
  /** The Group Initiative round and the side acting (r8 A3); absent with none kept. */
  round?: { n: number; acting: 'pilots' | 'opposition' | null }
}

export const CLEAR_SCENE: SceneState = { conditions: [], hours: 0 }

/** The conditions that are on, by name in catalogue order ("Radiation Storm, Freezing"); empty with none. */
export function sceneConditionNames(conditions: readonly string[]): string {
  return sceneConditionsOf(conditions)
    .map((condition) => condition.name)
    .join(', ')
}

export function useScene(gameId: string | null): SceneState {
  const signedIn = isSignedIn(useSync().status)
  const scene = useTableRead('scenes.current', signedIn && gameId !== null ? { gameId } : 'skip')
  return scene ?? CLEAR_SCENE
}
