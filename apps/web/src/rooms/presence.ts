/**
 * Who is at a Game's table: the members whose socket on the Game room says
 * they sit at it (`HERE_ACT`), held on the socket (its hibernation
 * attachment), never stored. Every member's socket hears presence; one that
 * never sat (the Play landing's Game card) does not count as here.
 */

import type { ServerMessage } from './protocol'

/** The room socket's Sec-WebSocket-Protocol; the session cookie signs it in. */
export const ROOM_PROTOCOL = 'su-room'

/** The act a socket sends to sit at the table (`{ here: true }`) or leave it; sent again on reconnect. */
export const HERE_ACT = 'presence.here'

/** What a Game room's socket carries across hibernation: whether its member sits at the table. */
export type SocketSeat = { here: boolean }

/** A socket's seat, from its attachment: none (never sat) is not here. */
export function seatOf(attachment: unknown): boolean {
  return (attachment as Partial<SocketSeat> | null)?.here === true
}

/** What the room sends every socket whenever who is here changes. */
export type PresenceMessage = Extract<ServerMessage, { type: 'presence' }>

/** The member ids here, once each and sorted, from each open socket's member and seat. */
export function presentMembers(
  sockets: readonly { member: string | undefined; here: boolean }[]
): string[] {
  const here = new Set<string>()
  for (const socket of sockets)
    if (socket.member !== undefined && socket.here) here.add(socket.member)
  return [...here].sort()
}
