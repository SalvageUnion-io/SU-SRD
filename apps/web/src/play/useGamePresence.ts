/**
 * useGamePresence — who is at a Game's table (play.md §7): the member ids
 * with a seat open on the Game's room (`rooms/presence.ts`). One socket per
 * Game and role per tab, shared by every caller and reopened after a drop; a
 * `seat` caller (a Cockpit) counts its player as here, a watcher (the
 * landing) only hears. null until the room answers, offline or signed out.
 */

import { useAuthToken } from '@convex-dev/auth/react'
import { useCallback, useSyncExternalStore } from 'react'
import { useConnection } from '../lib/connection/connectionContext'
import type { PresenceMessage } from '../rooms/presence'
import { ROOM_PROTOCOL } from '../rooms/presence'
import { gameSocketPath } from '../rooms/routes'

type Here = ReadonlySet<string> | null

type Channel = { here: Here; listeners: Set<() => void>; users: number; close: () => void }

const channels = new Map<string, Channel>()

/** Waits before reopening a dropped socket: doubling, at most 30 s. */
const RETRY_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000]

function openChannel(key: string, url: string, token: string): Channel {
  const channel: Channel = { here: null, listeners: new Set(), users: 0, close: () => undefined }
  const tell = (here: Here) => {
    channel.here = here
    for (const listener of channel.listeners) listener()
  }
  let socket: WebSocket | null = null
  let retry: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let closed = false
  const connect = () => {
    socket = new WebSocket(url, [ROOM_PROTOCOL, token])
    socket.onopen = () => {
      attempt = 0
    }
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as PresenceMessage
      if (message.type === 'presence') tell(new Set(message.here))
    }
    socket.onclose = () => {
      if (closed) return
      tell(null)
      retry = setTimeout(connect, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)])
    }
  }
  connect()
  channel.close = () => {
    closed = true
    clearTimeout(retry)
    socket?.close(1000)
    channels.delete(key)
  }
  return channel
}

export function useGamePresence(gameId: string | null, role: 'seat' | 'watch'): Here {
  const { mode } = useConnection()
  const token = useAuthToken()
  const seat = role === 'seat' ? '1' : '0'
  const key =
    mode === 'connected' && gameId !== null && token !== null ? `${gameId}:${seat}:${token}` : null

  const subscribe = useCallback(
    (listener: () => void) => {
      if (key === null || gameId === null || token === null) return () => undefined
      const url = new URL(`${gameSocketPath(gameId)}?seat=${seat}`, window.location.href)
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      const channel = channels.get(key) ?? openChannel(key, url.href, token)
      channels.set(key, channel)
      channel.users++
      channel.listeners.add(listener)
      return () => {
        channel.listeners.delete(listener)
        if (--channel.users === 0) channel.close()
      }
    },
    [key, gameId, seat, token]
  )
  return useSyncExternalStore(subscribe, () =>
    key === null ? null : (channels.get(key)?.here ?? null)
  )
}
