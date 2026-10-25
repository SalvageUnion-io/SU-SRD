/**
 * useClock — the time a screen reads ages against ("2 min ago"), moved every
 * 30 s so they age without anything else changing on screen.
 */

import { useEffect, useState } from 'react'

const TICK_MS = 30_000

export function useClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [])
  return now
}
