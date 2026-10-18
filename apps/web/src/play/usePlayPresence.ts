/**
 * usePlayPresence — while Play is open and connected, beat for its seat
 * (`seats.heartbeat`) at once and every `PRESENCE_HEARTBEAT_MS`, so the crew
 * sees who is here (play.md §7; `isPresent`). Offline, Outdated or signed out
 * it sends nothing; a refused beat is dropped quietly, since being seen is not
 * play state and the next beat tries again.
 */

import { PRESENCE_HEARTBEAT_MS } from 'cantina-domain/schemas/seat'
import { useMutation } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import type { PlayTarget } from './play.model'

export function usePlayPresence(target: Pick<PlayTarget, 'gameId' | 'pilotId'>): void {
  const { mode, canWrite } = useConnection()
  const heartbeat = useMutation(api.seats.heartbeat)
  const live = mode === 'connected' && canWrite
  const { gameId, pilotId } = target

  useEffect(() => {
    if (!live) return
    const beat = () => {
      heartbeat({ gameId: gameId as Id<'games'> | null, pilotId }).catch(() => undefined)
    }
    beat()
    const timer = setInterval(beat, PRESENCE_HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [live, heartbeat, gameId, pilotId])
}
