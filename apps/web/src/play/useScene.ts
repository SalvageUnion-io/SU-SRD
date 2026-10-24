/**
 * useScene — the Game's Scene conditions as Play reads them (play.md §10):
 * a Radiation Storm, Freezing, Low Visibility and the rest, which the
 * Mediator sets (`scenes.setConditions`) and every seat follows. Solo play has
 * no Mediator and so no conditions; before the first answer the Scene is clear.
 */

import { useQuery } from 'convex/react'
import type { SceneConditionId } from 'game-domain/schemas/scene'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useConnection } from '../lib/connection/connectionContext'
import { isSignedIn } from '../lib/connection/connectionMode'

export type SceneState = {
  /** In catalogue order, each once. */
  conditions: readonly SceneConditionId[]
  /** Hours passed under them. */
  hours: number
}

export const CLEAR_SCENE: SceneState = { conditions: [], hours: 0 }

export function useScene(gameId: string | null): SceneState {
  const signedIn = isSignedIn(useConnection().mode)
  const scene = useQuery(
    api.scenes.current,
    signedIn && gameId !== null ? { gameId: gameId as Id<'games'> } : 'skip'
  )
  return scene ?? CLEAR_SCENE
}
