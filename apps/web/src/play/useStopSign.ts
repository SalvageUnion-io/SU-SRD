/**
 * useStopSign — a Game's Stop Sign, read once per screen (`safety.stopSign`,
 * live), with its two writes: show it (anyone) and lift it (whoever showed
 * it, or the table runner). Drawn by `StopSign.tsx`.
 */

import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useConnection } from '../lib/connection/connectionContext'
import { useServerAction } from '../lib/connection/useServerAction'
import { playSafetyCopy } from '../messages/play-safety'

export type StopSign = {
  /** True while the game is paused. */
  shown: boolean
  /** The caller showed it. */
  mine: boolean
  /** The caller may lift it: they showed it, or they run the table. */
  mayLift: boolean
  /** The caller may change whether it posts to Discord. */
  mayManage: boolean
  postToChannel: boolean
  /** Writes reach the server. */
  canWrite: boolean
  show: () => void
  lift: () => void
  pending: boolean
}

/** The Game's Stop Sign, or null solo, signed out or while it loads. */
export function useStopSign(gameId: string | null): StopSign | null {
  const { mode, canWrite } = useConnection()
  const read = useQuery(
    api.safety.stopSign,
    gameId !== null && mode === 'connected' ? { gameId: gameId as Id<'games'> } : 'skip'
  )
  const showStop = useServerAction(useMutation(api.safety.showStop), {
    failure: playSafetyCopy('couldNotShow'),
    toastId: 'stop-sign',
  })
  const liftStop = useServerAction(useMutation(api.safety.liftStop), {
    failure: playSafetyCopy('couldNotResume'),
    toastId: 'stop-sign',
  })
  if (gameId === null || read === undefined || read === null) return null
  const id = gameId as Id<'games'>
  return {
    shown: read.stop !== null,
    mine: read.stop?.mine === true,
    mayLift: read.mayLift,
    mayManage: read.mayManage,
    postToChannel: read.postToChannel,
    canWrite,
    show: () => void showStop.run({ gameId: id }),
    lift: () => void liftStop.run({ gameId: id }),
    pending: showStop.pending || liftStop.pending,
  }
}
