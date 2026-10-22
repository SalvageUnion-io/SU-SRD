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

const BASE = {
  whiteSpace: 'nowrap',
} satisfies CSSProperties
const CAPS = capsLabel({ size: 'badge' })

/** On the foot's band: its own foreground (`PlayFoot`); the words say the state. */
const SAVED = { ...BASE, color: 'inherit' } satisfies CSSProperties

const OFFLINE = { ...BASE, color: 'inherit' } satisfies CSSProperties

export function SavedIndicator() {
  const { mode } = useConnection()
  if (mode === 'connected') {
    return (
      <span role="status" className={CAPS} style={SAVED}>
        {playCopy('saved')}
      </span>
    )
  }
  if (mode === 'disconnected') {
    return (
      <span role="status" className={CAPS} style={OFFLINE}>
        {playCopy('offlineReadOnly')}
      </span>
    )
  }
  if (mode === 'connecting') {
    return (
      <span role="status" className={CAPS} style={SAVED}>
        {playCopy('connecting')}
      </span>
    )
  }
  return null
}
