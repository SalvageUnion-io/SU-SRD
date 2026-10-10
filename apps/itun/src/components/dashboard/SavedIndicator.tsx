/**
 * SavedIndicator — the rail's word on whether play is being saved
 * (docs/architecture/dashboard.md §2): the seat, the rolls and every
 * sheet write go to the Game while connected, and nothing does while offline,
 * when the Dashboard is read-only (ADR-030 §1).
 *
 * It reads `useConnection()`, the one source for the storage mode. Solo has no
 * Dashboard (ADR-038 §1), so it shows nothing there.
 */

import { color, font, fontSize, tracking, weight } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'

const BASE: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const SAVED: CSSProperties = { ...BASE, color: color.ink75 }

const OFFLINE: CSSProperties = { ...BASE, color: color.ink }

export function SavedIndicator({ gameName }: { gameName: string | null }) {
  const { mode } = useConnection()
  if (mode === 'connected') {
    return (
      <span role="status" style={SAVED}>
        {gameName ? `● Saved to ${gameName}` : '● Saved'}
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
