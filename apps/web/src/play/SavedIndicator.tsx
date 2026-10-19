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
import { color } from '../design/tokens'
import { useConnection } from '../lib/connection/connectionContext'

const BASE = {
  whiteSpace: 'nowrap',
} satisfies CSSProperties
const CAPS = capsLabel({ size: 'badge' })

const SAVED = { ...BASE, color: color.ink75 } satisfies CSSProperties

const OFFLINE = { ...BASE, color: color.ink } satisfies CSSProperties

export function SavedIndicator() {
  const { mode } = useConnection()
  if (mode === 'connected') {
    return (
      <span role="status" className={CAPS} style={SAVED}>
        ● Saved
      </span>
    )
  }
  if (mode === 'disconnected') {
    return (
      <span role="status" className={CAPS} style={OFFLINE}>
        ○ Offline · read-only
      </span>
    )
  }
  if (mode === 'connecting') {
    return (
      <span role="status" className={CAPS} style={SAVED}>
        Connecting…
      </span>
    )
  }
  return null
}
