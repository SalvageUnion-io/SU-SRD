/**
 * usePresenceClock — the time presence is read against (`isPresent`), moved
 * on every `PRESENCE_HEARTBEAT_MS`, so a crewmate who stops beating turns
 * "away" without anything else changing on screen (play.md §7).
 */

import { PRESENCE_HEARTBEAT_MS } from 'game-domain/schemas/seat'
import { useEffect, useState } from 'react'

export function usePresenceClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), PRESENCE_HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [])
  return now
}
