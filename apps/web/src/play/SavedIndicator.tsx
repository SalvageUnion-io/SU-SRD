/**
 * SavedIndicator — the foot's word on whether play is being saved (play.md
 * §2): the seat, the rolls and every sheet write go to the server while
 * connected, and nothing does while offline, when Play is read-only (ADR-030
 * §1).
 *
 * It reads `useConnection()`, the one source for the storage mode. Signed out
 * there is no Play, so it shows nothing there.
 */

import type { CSSProperties } from 'react'
import { capsLabel } from '../components/atoms/capsLabel'
import { useConnection } from '../lib/connection/connectionContext'
import { playCopy } from '../messages/play'

/** On the foot's band: its own foreground (`PlayFoot`); the words say the state. */
const WORDS = { whiteSpace: 'nowrap', color: 'inherit' } satisfies CSSProperties
const CAPS = capsLabel({ size: 'badge' })

export function SavedIndicator() {
  const { mode } = useConnection()
  // Signed out there is no Play, so the foot says nothing.
  if (mode === 'solo') return null
  return (
    <span role="status" className={CAPS} style={WORDS}>
      {mode === 'connected'
        ? playCopy('saved')
        : mode === 'disconnected'
          ? playCopy('offlineReadOnly')
          : playCopy('connecting')}
    </span>
  )
}
