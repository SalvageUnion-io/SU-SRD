/**
 * useStopSign — a Game's Stop Sign, read once per screen (`safety.stopSign`,
 * live), with its two writes: show it (anyone) and lift it (whoever showed
 * it, or the table runner). Drawn by `StopSign.tsx`.
 */

import { useServerAction } from '../lib/connection/useServerAction'
import { playSafetyCopy } from '../messages/play-safety'
import { useSync } from '../replica/syncContext'
import { useTableAct, useTableRead } from '../replica/useTable'

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
  const { status, canWrite } = useSync()
  const read = useTableRead(
    'safety.stopSign',
    gameId !== null && status === 'live' ? { gameId } : 'skip'
  )
  const showStop = useServerAction(useTableAct('safety.showStop', gameId), {
    failure: playSafetyCopy('couldNotShow'),
    toastId: 'stop-sign',
  })
  const liftStop = useServerAction(useTableAct('safety.liftStop', gameId), {
    failure: playSafetyCopy('couldNotResume'),
    toastId: 'stop-sign',
  })
  if (gameId === null || read === undefined || read === null) return null
  return {
    shown: read.stop !== null,
    mine: read.stop?.mine === true,
    mayLift: read.mayLift,
    mayManage: read.mayManage,
    postToChannel: read.postToChannel,
    canWrite,
    show: () => void showStop.run({}),
    lift: () => void liftStop.run({}),
    pending: showStop.pending || liftStop.pending,
  }
}
