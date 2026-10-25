/**
 * Who is at a Game's table: the members with a socket open on the
 * Game room as a seat, held in memory by the room, never stored. A watcher
 * (the Play landing) hears presence without counting as here.
 */

import type { ServerMessage } from './protocol'

/** The second Sec-WebSocket-Protocol entry carries the caller's credential. */
export const ROOM_PROTOCOL = 'su-room'

/** The tag on a socket that counts as here; its other tag is the member's id. */
export const SEAT_TAG = 'seat'
export const WATCH_TAG = 'watch'

/** What the room sends every socket whenever who is here changes. */
export type PresenceMessage = Extract<ServerMessage, { type: 'presence' }>

/** The member ids here, once each and sorted, from each open socket's tags. */
export function presentMembers(sockets: readonly (readonly string[])[]): string[] {
  const here = new Set<string>()
  for (const [userId, role] of sockets)
    if (userId !== undefined && role === SEAT_TAG) here.add(userId)
  return [...here].sort()
}
