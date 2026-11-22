/**
 * useStopSign — a Game's Stop Sign, read once per screen (`safety.stopSign`,
 * live), with its two writes: show it (anyone) and lift it (whoever showed
 * it, or the table runner). Drawn by `StopSign.tsx`.
 *
 * The Stop Sign asks the table to pause; it locks nothing, and sheets stay
 * usable (r5 A8). Whoever showed it is told when it is lifted by someone else
 * (the Mediator): their screen saw it as theirs, then gone, with no lift of
 * its own (`liftedHere`).
 */

import { useEffect, useRef } from 'react'
import { toast } from '../components/index'
import { useServerAction } from '../lib/connection/useServerAction'
import { playSafetyCopy } from '../messages/play-safety'
import { useSync } from '../replica/syncContext'
import { useTableAct, useTableRead } from '../replica/useTable'

export type StopSign = {
  /** True while the table is asked to pause. */
  shown: boolean
  /** The caller showed it. */
  mine: boolean
  /** The caller may lift it: they showed it, or they run the table. */
  mayLift: boolean
  /** Writes reach the server. */
  canWrite: boolean
  show: () => void
  lift: () => void
  pending: boolean
}

/**
 * Whether the viewer's own sign, up since `mineAt`, was lifted by someone
 * else: it is down now, and this browser did not lift that one (`liftedAt`).
 */
export function liftedForMe(
  mineAt: number | null,
  stop: { shownAt: number } | null,
  liftedAt: number | undefined
): boolean {
  return mineAt !== null && stop === null && liftedAt !== mineAt
}

/** Per Game, the sign (by when it went up) this browser lifted itself: every screen's reader shares it. */
const liftedHere = new Map<string, number>()

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
  // The viewer's own sign, last read: gone without their lift, someone else lifted it.
  const mineAt = useRef<number | null>(null)
  const stop = read?.stop
  useEffect(() => {
    if (gameId === null || stop === undefined) return
    const was = mineAt.current
    if (was !== null && liftedForMe(was, stop, liftedHere.get(gameId))) {
      toast(playSafetyCopy('liftedYours'), { id: `stop-lifted-${gameId}-${was}` })
    }
    mineAt.current = stop?.mine === true ? stop.shownAt : null
  }, [gameId, stop])
  if (gameId === null || read === undefined || read === null) return null
  return {
    shown: read.stop !== null,
    mine: read.stop?.mine === true,
    mayLift: read.mayLift,
    canWrite,
    show: () => void showStop.run({}),
    lift: () => {
      if (read.stop !== null) liftedHere.set(gameId, read.stop.shownAt)
      void liftStop.run({})
    },
    pending: showStop.pending || liftStop.pending,
  }
}
