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
import { color, font, fontSize, tracking, weight } from '../../design/tokens'
import { useConnection } from '../../lib/connection/connectionContext'

const BASE = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const SAVED = { ...BASE, color: color.ink75 } satisfies CSSProperties

const OFFLINE = { ...BASE, color: color.ink } satisfies CSSProperties

export function SavedIndicator() {
  const { mode } = useConnection()
  if (mode === 'connected') {
    return (
      <span role="status" style={SAVED}>
        ● Saved
      </span>
    )
  }
  if (mode === 'disconnected') {
    return (
      <span role="status" style={OFFLINE}>
        ○ Offline · read-only
      </span>
    )
  }
  if (mode === 'connecting') {
    return (
      <span role="status" style={SAVED}>
        Connecting…
      </span>
    )
  }
  return null
}
